'use strict';
// 구글 캘린더 양방향 동기화 (기본 캘린더 'primary')
//  - 로그인: OAuth 2.0 데스크톱 앱 방식 (브라우저 + 127.0.0.1 루프백 + PKCE)
//  - 동기화: 앱에서 바뀐 일정 올리기 → 구글 일정 내려받기 → 구글에서 지운 일정 정리
// 네트워크는 fetch 를 주입받아 쓰므로 테스트에서는 가짜 API 로 바꿀 수 있다.

const crypto = require('crypto');

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const GOOGLE_COLOR = '#4285f4';
const DAY = 86400000;
const WINDOW = { pastDays: 90, futureDays: 400 };

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const pad = (n) => String(n).padStart(2, '0');
const ymdLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hmLocal = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
function addDaysYmd(ymd, n) {
  const [y, m, d] = ymd.split('-').map(Number);
  const u = new Date(Date.UTC(y, m - 1, d + n));
  return `${u.getUTCFullYear()}-${pad(u.getUTCMonth() + 1)}-${pad(u.getUTCDate())}`;
}
const localIso = (d) => `${ymdLocal(d)}T${hmLocal(d)}:00`;

/* ───── OAuth ───── */
function pkcePair() {
  const verifier = b64url(crypto.randomBytes(48));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

function authUrl({ clientId, redirectUri, challenge, state }) {
  const q = new URLSearchParams({
    client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: SCOPE,
    code_challenge: challenge, code_challenge_method: 'S256', state,
    access_type: 'offline', prompt: 'consent',
  });
  return `${AUTH_URL}?${q}`;
}

async function postForm(fetchFn, url, params) {
  const res = await fetchFn(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error_description || data.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.code = data.error;
    throw err;
  }
  return data;
}

function exchangeCode(fetchFn, { clientId, clientSecret, code, verifier, redirectUri }) {
  return postForm(fetchFn, TOKEN_URL, {
    client_id: clientId, client_secret: clientSecret, code, code_verifier: verifier,
    grant_type: 'authorization_code', redirect_uri: redirectUri,
  });
}

function revoke(fetchFn, token) {
  return postForm(fetchFn, REVOKE_URL, { token }).catch(() => {});
}

/* ───── API 클라이언트 ───── */
class GoogleCalendar {
  constructor({ clientId, clientSecret, refreshToken, fetch: fetchFn }) {
    Object.assign(this, { clientId, clientSecret, refreshToken, fetchFn });
    this.at = null;
    this.exp = 0;
  }

  async accessToken(force) {
    if (!force && this.at && Date.now() < this.exp - 60000) return this.at;
    try {
      const t = await postForm(this.fetchFn, TOKEN_URL, {
        client_id: this.clientId, client_secret: this.clientSecret,
        refresh_token: this.refreshToken, grant_type: 'refresh_token',
      });
      this.at = t.access_token;
      this.exp = Date.now() + (Number(t.expires_in) || 3600) * 1000;
      return this.at;
    } catch (e) {
      if (e.code === 'invalid_grant') e.reauth = true; // 토큰 만료/취소 → 다시 연결 필요
      throw e;
    }
  }

  async request(method, url, body) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const token = await this.accessToken(attempt > 0);
      const res = await this.fetchFn(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.status === 401 && attempt === 0) continue;
      if (res.status === 204) return null;
      const text = await res.text();
      const data = text ? JSON.parse(text) : null;
      if (!res.ok) {
        const err = new Error((data && data.error && data.error.message) || `HTTP ${res.status}`);
        err.status = res.status;
        throw err;
      }
      return data;
    }
    throw new Error('구글 인증에 실패했어요.');
  }

  async list(timeMin, timeMax) {
    const items = [];
    let pageToken = '';
    let calendar = '';
    do {
      const q = new URLSearchParams({ timeMin, timeMax, singleEvents: 'true', maxResults: '2500', showDeleted: 'false' });
      if (pageToken) q.set('pageToken', pageToken);
      const data = await this.request('GET', `${API}?${q}`);
      calendar = data.summary || calendar;
      items.push(...(data.items || []));
      pageToken = data.nextPageToken || '';
    } while (pageToken);
    return { items, calendar };
  }

  insert(body) { return this.request('POST', API, body); }
  patch(id, body) { return this.request('PATCH', `${API}/${encodeURIComponent(id)}`, body); }
  remove(id) { return this.request('DELETE', `${API}/${encodeURIComponent(id)}`); }
}

/* ───── 변환 ───── */
function toGoogle(e, timeZone) {
  const body = { summary: e.title, description: e.memo || '' };
  if (!e.time) {
    body.start = { date: e.date, dateTime: null, timeZone: null };
    body.end = { date: addDaysYmd(e.endDate || e.date, 1), dateTime: null, timeZone: null };
  } else {
    const [y, m, d] = e.date.split('-').map(Number);
    const [hh, mm] = e.time.split(':').map(Number);
    const s = new Date(y, m - 1, d, hh, mm);
    const en = new Date(s.getTime() + (Number(e.gDur) > 0 ? Number(e.gDur) : 60) * 60000);
    body.start = { dateTime: localIso(s), timeZone, date: null };
    body.end = { dateTime: localIso(en), timeZone, date: null };
  }
  return body;
}

function fromGoogle(g) {
  if (!g || !g.start) return null;
  const base = {
    title: (g.summary || '(제목 없음)').slice(0, 200),
    memo: (g.description || '').slice(0, 5000),
    gid: g.id, gEtag: g.etag || '', recurring: !!g.recurringEventId, source: 'google',
  };
  if (g.start.date) {
    const date = g.start.date;
    const last = g.end && g.end.date ? addDaysYmd(g.end.date, -1) : date;
    return { ...base, date, endDate: last > date ? last : '', time: '', gDur: 0 };
  }
  if (g.start.dateTime) {
    const s = new Date(g.start.dateTime);
    const en = new Date((g.end && g.end.dateTime) || g.start.dateTime);
    if (Number.isNaN(s.getTime())) return null;
    return { ...base, date: ymdLocal(s), endDate: '', time: hmLocal(s), gDur: Math.max(0, Math.round((en - s) / 60000)) };
  }
  return null;
}

const SYNCED_FIELDS = ['title', 'memo', 'date', 'endDate', 'time'];
const sameContent = (a, b) => SYNCED_FIELDS.every((k) => (a[k] || '') === (b[k] || ''));

/**
 * 앱에서 renderer 가 보낸 새 목록(next)을 저장된 목록(stored)과 비교해
 * 구글 관련 필드를 유지하고, 바뀐 일정은 dirty, 지운 일정은 tombstone(deleted) 으로 남긴다.
 */
function mergeLocalEdit(stored, next) {
  const old = new Map(stored.map((e) => [e.id, e]));
  const seen = new Set();
  const out = next.map((n) => {
    seen.add(n.id);
    const o = old.get(n.id);
    if (!o) return { ...n, dirty: true, deleted: false, source: n.source || 'local' };
    const keep = { gid: o.gid, gEtag: o.gEtag, gDur: o.gDur, recurring: o.recurring, source: o.source };
    return { ...o, ...n, ...keep, deleted: false, dirty: o.dirty || !sameContent(o, n) };
  });
  for (const o of stored) {
    if (seen.has(o.id)) continue;
    if (o.deleted) out.push(o); // 아직 구글에서 못 지운 것
    else if (o.gid) out.push({ ...o, deleted: true, dirty: true }); // 구글에서도 지워야 함
  }
  return out;
}

let idSeq = 0;
const newId = () => `g${Date.now().toString(36)}${(idSeq++).toString(36)}${crypto.randomBytes(3).toString('hex')}`;

/** 한 번 동기화. local 은 저장된 전체 목록(tombstone 포함). 결과 목록을 돌려준다. */
async function syncOnce(args) {
  const track = { list: null };
  try {
    return await syncInner(args, track);
  } catch (err) {
    // 중간에 실패해도 이미 구글에 올라간 일정의 ID는 남겨야 중복 생성을 막는다
    if (track.list) err.partial = track.list.filter((e) => !e.dropped);
    throw err;
  }
}

async function syncInner({ local, api, timeZone, now = Date.now(), window = WINDOW }, track) {
  const stats = { uploaded: 0, deletedRemote: 0, downloaded: 0, deletedLocal: 0 };
  let list = local.map((e) => ({ ...e }));
  track.list = list;

  // 1) 앱에서 바뀐 것 올리기
  for (const e of list) {
    if (e.deleted) {
      if (e.gid) {
        try { await api.remove(e.gid); } catch (err) { if (![404, 410].includes(err.status)) throw err; }
        stats.deletedRemote++;
      }
      e.dropped = true;
      continue;
    }
    if (!e.dirty) continue;
    const body = toGoogle(e, timeZone);
    let g;
    if (e.gid) {
      try { g = await api.patch(e.gid, body); } catch (err) {
        if (![404, 410].includes(err.status)) throw err;
        g = await api.insert(body); // 구글에서 이미 지워졌으면 새로 만든다
      }
    } else {
      g = await api.insert(body);
    }
    Object.assign(e, { gid: g.id, gEtag: g.etag || '', recurring: !!g.recurringEventId, dirty: false });
    stats.uploaded++;
  }
  list = list.filter((e) => !e.dropped);
  track.list = list;

  // 2) 구글 일정 내려받기
  const minMs = now - window.pastDays * DAY;
  const maxMs = now + window.futureDays * DAY;
  const { items, calendar } = await api.list(new Date(minMs).toISOString(), new Date(maxMs).toISOString());
  const byGid = new Map(list.filter((e) => e.gid).map((e) => [e.gid, e]));
  const seen = new Set();
  for (const g of items) {
    if (g.status === 'cancelled') continue;
    const conv = fromGoogle(g);
    if (!conv) continue;
    seen.add(g.id);
    const cur = byGid.get(g.id);
    if (cur) {
      if (!cur.dirty && cur.gEtag !== conv.gEtag) {
        Object.assign(cur, conv, { id: cur.id, color: cur.color, source: cur.source });
        stats.downloaded++;
      }
    } else {
      list.push({ id: newId(), color: GOOGLE_COLOR, updatedAt: now, dirty: false, deleted: false, ...conv });
      stats.downloaded++;
    }
  }

  // 3) 구글에서 지운 일정 정리 (동기화 범위 안에 있는 것만, 경계는 하루 여유)
  list = list.filter((e) => {
    if (!e.gid || e.dirty || seen.has(e.gid)) return true;
    const t = Date.parse(`${e.date}T12:00:00`);
    const inside = t > minMs + DAY && t < maxMs - DAY;
    if (inside) stats.deletedLocal++;
    return !inside;
  });
  return { events: list, stats, calendar };
}

module.exports = {
  SCOPE, GOOGLE_COLOR, pkcePair, authUrl, exchangeCode, revoke, GoogleCalendar,
  toGoogle, fromGoogle, mergeLocalEdit, syncOnce, addDaysYmd,
};
