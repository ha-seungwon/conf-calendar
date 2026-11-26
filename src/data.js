// 학회 데이터 정규화: ccfddl(https://github.com/ccfddl/ccf-deadlines) YAML -> 앱에서 쓰는 JSON
'use strict';

const yaml = require('js-yaml');

const SOURCE_URL = 'https://ccfddl.github.io/conference/allconf.yml';

// BK21 FOUR 인정 IF(1~4) + 한국정보과학회 2024 등급, DBLP 키 기준 (data/grades.json 참고)
const GRADES = require('../data/grades.json').grades;

// 논문이 저널(PACM 등)에 실리는 "저널형" 학회. DBLP 키 → 저널 이름
const JOURNAL_FIRST = {
  vldb: 'PVLDB', sigmod: 'PACMMOD', pods: 'PACMMOD', sigmetrics: 'POMACS', cscw: 'PACM HCI',
  oopsla: 'PACMPL', popl: 'PACMPL', pldi: 'PACMPL', icfp: 'PACMPL', huc: 'IMWUT',
  conext: 'PACMNET', sigsoft: 'PACMSE', siggraph: 'ACM TOG', siggrapha: 'ACM TOG',
};

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

function monthOf(word) {
  const w = word.toLowerCase().replace(/\.$/, '');
  if (w.length < 3) return null;
  const i = MONTH_NAMES.findIndex((m) => m.startsWith(w) || (w.length > 3 && w.startsWith(m)));
  return i >= 0 ? i : null;
}

const pad = (n) => String(n).padStart(2, '0');
const ymd = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

/**
 * "July 7-9, 2027", "February 27-March 2, 2025", "Dec 30, 2026 - Jan 2, 2027",
 * "14-16 July 2026" 같은 자유 형식 날짜를 { start, end } (YYYY-MM-DD)로 바꾼다.
 * 일(day)이 없으면(예: "Dec, 2025", "TBD") null.
 */
function parseDateRange(text) {
  if (!text || typeof text !== 'string') return null;
  const s = text.replace(/[–—~]/g, '-').replace(/(\d)(st|nd|rd|th)\b/gi, '$1');
  const tokens = s.match(/[A-Za-z]+\.?|\d+/g) || [];

  const points = [];
  let pending = [];
  let curMonth = null;
  for (const t of tokens) {
    if (/^\d+$/.test(t)) {
      const n = Number(t);
      if (t.length === 4 && n > 1900 && n < 2200) {
        for (const p of points) if (p.y == null) p.y = n;
      } else if (t.length <= 2 && n >= 1 && n <= 31) {
        const p = { d: n, m: curMonth, y: null };
        if (curMonth == null) pending.push(p);
        points.push(p);
      }
    } else {
      const m = monthOf(t);
      if (m != null) {
        curMonth = m;
        for (const p of pending) p.m = m;
        pending = [];
      }
    }
  }

  const ok = points.filter((p) => p.m != null && p.y != null);
  if (!ok.length) return null;
  const a = { ...ok[0] };
  const b = { ...ok[ok.length - 1] };
  let start = Date.UTC(a.y, a.m, a.d);
  let end = Date.UTC(b.y, b.m, b.d);
  if (start > end && a.y === b.y) {
    // "Dec 30 - Jan 2, 2027" 처럼 연도가 한 번만 적힌 경우
    a.y -= 1;
    start = Date.UTC(a.y, a.m, a.d);
  }
  if (start > end || end - start > 45 * 86400000) end = start;
  const ds = new Date(start);
  const de = new Date(end);
  return {
    start: ymd(ds.getUTCFullYear(), ds.getUTCMonth(), ds.getUTCDate()),
    end: ymd(de.getUTCFullYear(), de.getUTCMonth(), de.getUTCDate()),
  };
}

const IANA_ALIASES = {
  PT: 'America/Los_Angeles', PST: 'America/Los_Angeles', PDT: 'America/Los_Angeles',
  ET: 'America/New_York', EST: 'America/New_York', EDT: 'America/New_York',
  CT: 'America/Chicago', CST: 'America/Chicago', CDT: 'America/Chicago',
  CET: 'Europe/Berlin', CEST: 'Europe/Berlin',
  BST: 'Europe/London', KST: 'Asia/Seoul', JST: 'Asia/Tokyo',
};

function ianaOffsetMinutes(zone, utcMs) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: zone, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date(utcMs)).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute, +parts.second);
  return Math.round((asUtc - utcMs) / 60000);
}

/** 시간대 문자열 -> (해당 시각 기준) UTC 오프셋(분). 알 수 없으면 AoE(UTC-12). */
function tzOffsetMinutes(tz, approxUtcMs) {
  const s = String(tz || '').trim();
  if (!s || /^aoe$/i.test(s) || /anywhere/i.test(s)) return -720;
  const m = s.match(/^(?:UTC|GMT)\s*([+-])\s*(\d{1,2})(?::?(\d{2}))?$/i);
  if (m) {
    const sign = m[1] === '-' ? -1 : 1;
    return sign * (Number(m[2]) * 60 + Number(m[3] || 0));
  }
  if (/^(UTC|GMT|Z)$/i.test(s)) return 0;
  const zone = IANA_ALIASES[s.toUpperCase()] || (s.includes('/') ? s : null);
  if (zone) {
    try { return ianaOffsetMinutes(zone, approxUtcMs); } catch { /* fallthrough */ }
  }
  return -720;
}

/** '2026-12-08 22:59:59' + 'UTC-8' -> UTC epoch ms. 날짜가 아니면(TBD 등) null. */
function toUtcMs(value, tz) {
  if (value == null) return null;
  const s = String(value).trim();
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  const hasTime = m[4] != null;
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3],
    hasTime ? +m[4] : 23, hasTime ? +m[5] : 59, hasTime ? +(m[6] || 0) : 59);
  let off = tzOffsetMinutes(tz, wall);
  let utc = wall - off * 60000;
  const off2 = tzOffsetMinutes(tz, utc); // DST 경계 보정
  if (off2 !== off) { off = off2; utc = wall - off * 60000; }
  return utc;
}

const TIMELINE_KEYS = {
  abstract: 'abstract_deadline',
  deadline: 'deadline',
  rebuttal: 'rebuttal_deadline',
  decision: 'decision_deadline',
};

function normalizeEdition(ed) {
  const tz = ed.timezone || 'AoE';
  const timeline = (Array.isArray(ed.timeline) ? ed.timeline : []).map((t) => {
    const out = { comment: t.comment ? String(t.comment) : '' };
    for (const [k, src] of Object.entries(TIMELINE_KEYS)) {
      out[k] = toUtcMs(t[src], tz);
      if (out[k] != null) out[`${k}Raw`] = String(t[src]);
      if (out[k] == null && t[src] != null && /tbd/i.test(String(t[src]))) out[`${k}Tbd`] = true;
    }
    if (out.abstract != null && out.abstract === out.deadline) out.abstract = null;
    return out;
  });
  const range = parseDateRange(ed.date);
  return {
    year: Number(ed.year) || null,
    id: String(ed.id || `${ed.year}`),
    link: typeof ed.link === 'string' ? ed.link : '',
    place: ed.place ? String(ed.place) : '',
    dateText: ed.date ? String(ed.date) : '',
    start: range ? range.start : null,
    end: range ? range.end : null,
    timezone: String(tz),
    timeline,
  };
}

function normalize(yamlText) {
  const doc = yaml.load(yamlText);
  if (!Array.isArray(doc)) throw new Error('학회 데이터 형식이 예상과 다릅니다.');
  const conferences = [];
  for (const c of doc) {
    if (!c || !c.title || !Array.isArray(c.confs)) continue;
    const rank = c.rank || {};
    conferences.push({
      key: String(c.conference_key || `${c.sub}/${c.dblp || c.title}`),
      title: String(c.title),
      description: c.description ? String(c.description) : '',
      sub: String(c.sub || 'MX'),
      rank: {
        ccf: rank.ccf ? String(rank.ccf) : 'N',
        core: rank.core ? String(rank.core) : 'N',
        thcpl: rank.thcpl ? String(rank.thcpl) : 'N',
      },
      dblp: c.dblp ? String(c.dblp) : '',
      grade: (() => {
        const g = GRADES[String(c.dblp || '')] || {};
        return { bk: Number(g.bk) || 0, kiise: g.kiise || '' };
      })(),
      journal: JOURNAL_FIRST[String(c.dblp || '')] || '',
      editions: c.confs.map(normalizeEdition).sort((a, b) => (a.year || 0) - (b.year || 0)),
    });
  }
  if (conferences.length < 10) throw new Error('학회 데이터가 너무 적습니다. 원본을 확인하세요.');
  return conferences;
}

module.exports = { SOURCE_URL, normalize, parseDateRange, toUtcMs, tzOffsetMinutes };
