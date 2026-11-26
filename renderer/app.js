'use strict';

/* ════════════════ 상수 ════════════════ */
const DAY = 86400000;

const CATS = {
  ML: { name: '머신러닝', color: '#7c5cff', group: 'ai' },
  CV: { name: '컴퓨터 비전', color: '#d946ef', group: 'ai' },
  NLP: { name: '자연어처리', color: '#4f46e5', group: 'ai' },
  ROB: { name: '로보틱스', color: '#0f766e', group: 'ai' },
  AIG: { name: 'AI 일반·기타', color: '#a78bfa', group: 'ai' },
  OS: { name: 'OS·분산·클라우드·스토리지', color: '#f08c00', group: 'sys' },
  ARCH: { name: '아키텍처·하드웨어·임베디드', color: '#2563eb', group: 'sys' },
  HPC: { name: '병렬·HPC·성능', color: '#059669', group: 'sys' },
  NW: { name: '네트워크·모바일', color: '#0ea5c6', group: 'sys' },
  PL: { name: 'SW공학·프로그래밍 언어', color: '#ca8a04', group: 'sys' },
  SC: { name: '보안', color: '#e5484d', group: 'etc' },
  DB: { name: '데이터베이스·마이닝', color: '#14b8a6', group: 'etc' },
  MX: { name: '교차·신흥 분야', color: '#e93d82', group: 'etc' },
  HI: { name: 'HCI', color: '#b45309', group: 'etc' },
  CG: { name: '그래픽스·멀티미디어', color: '#65a30d', group: 'etc' },
  CT: { name: '계산 이론', color: '#64748b', group: 'etc' },
};
// DBLP 키로 세부 분야를 정한다. 목록에 없으면 원래 분류(sub)에서 기본값을 쓴다.
const SUBCAT = {
  ML: 'nips icml iclr aistats colt uai acml alt cpal probml log esann icann ijcnn iconip icmla',
  CV: 'cvpr iccv eccv wacv bmvc accv fg icb icpr icdar cvc euvip',
  NLP: 'acl emnlp naacl coling eacl conll colm ijcnlp nlpcc',
  ROB: 'icra iros rss corl',
  OS: 'osdi sosp eurosys usenix hotos cloud middleware apsys systor vee lisa icdcs netys IEEEcloud mlsys fast hotstorage mss ieeesec',
  ARCH: 'isca micro hpca asplos pact ics iiswc hotchips cf hipeac dac iccad date aspdac codes fpga fccm fpt glvlsi iscas ispd itc itc-asia ets ats asap iccd ispass rtss rtas emsoft lctrts',
  HPC: 'sc ppopp hpdc ipps icpp spaa podc cluster ccgrid europar hpcc ica3pp icpads pdcat ispa appt performance sigmetrics N',
  PL: 'cgo',
};
const SUBCAT_OF = new Map(Object.entries(SUBCAT).flatMap(([cat, keys]) => keys.split(' ').map((k) => [k, cat])));
const SUB_FALLBACK = { AI: 'AIG', DS: 'ARCH', NW: 'NW', SE: 'PL', SC: 'SC', DB: 'DB', MX: 'MX', HI: 'HI', CG: 'CG', CT: 'CT' };
const GROUPS = [
  { id: 'ai', name: 'AI' },
  { id: 'sys', name: '시스템' },
  { id: 'etc', name: '기타 분야' },
];
// 등급 기준. 하나를 고르면 그 기준의 세부 등급이 필터·배지로 보인다.
//  get(c) → 그 학회의 등급 값 ('' = 목록에 없음)
const CRITERIA = {
  bk: {
    name: 'BK21', full: '4단계 BK21 우수 국제학술대회 인정 IF (1~4점)',
    tiers: [['4', '4점'], ['3', '3점'], ['2', '2점'], ['1', '1점']], top: '4',
    get: (c) => (c.grade.bk ? String(c.grade.bk) : ''), badge: (v) => `BK ${v}점`,
  },
  kiise: {
    name: '정보과학회', full: '한국정보과학회 2024 우수학술대회',
    tiers: [['최우수', '최우수'], ['우수', '우수']], top: '최우수',
    get: (c) => c.grade.kiise || '', badge: (v) => `정보과학회 ${v}`,
  },
  ccf: {
    name: 'CCF', full: '중국컴퓨터학회(CCF) 추천 목록',
    tiers: [['A', 'A'], ['B', 'B'], ['C', 'C']], top: 'A',
    get: (c) => (['A', 'B', 'C'].includes(c.rank.ccf) ? c.rank.ccf : ''), badge: (v) => `CCF ${v}`,
  },
  core: {
    name: 'CORE', full: 'CORE 학회 등급 (호주·뉴질랜드)',
    tiers: [['A*', 'A*'], ['A', 'A'], ['B', 'B'], ['C', 'C']], top: 'A*',
    get: (c) => (['A*', 'A', 'B', 'C'].includes(c.rank.core) ? c.rank.core : ''), badge: (v) => `CORE ${v}`,
  },
};
const CRIT_KEYS = Object.keys(CRITERIA);
const NONE = '-'; // 목록에 없는 학회
const DEFAULT_TIERS = { bk: ['4', '3'], kiise: ['최우수'], ccf: ['A'], core: ['A*'] };
const gradeOf = (c, k = state.crit) => CRITERIA[k].get(c) || NONE;
const TYPES = {
  deadline: { name: '논문 마감', tag: '마감' },
  abstract: { name: '초록 마감', tag: '초록' },
  rebuttal: { name: '리버틀', tag: '리버틀' },
  decision: { name: '결과 발표', tag: '발표' },
  conf: { name: '학회 개최', tag: '개최' },
  mine: { name: '내 일정', tag: '내 일정' },
};
const MINE_COLORS = ['#ff6b3d', '#6d5dfc', '#e5484d', '#f0a000', '#2f9e44', '#0ea5c6', '#e93d82', '#6b7a90'];
const TYPE_FILTERS = [
  { types: ['mine'], name: '내 일정', swatch: 'sw-mine' },
  { types: ['deadline'], name: '논문 마감', swatch: 'sw-deadline' },
  { types: ['abstract'], name: '초록 마감', swatch: 'sw-abstract' },
  { types: ['conf'], name: '학회 개최 기간', swatch: 'sw-conf' },
  { types: ['rebuttal', 'decision'], name: '리버틀 · 결과 발표', swatch: 'sw-notice' },
];
const POINT_TYPES = ['abstract', 'deadline', 'rebuttal', 'decision'];
// 등급 필터(CCF/CORE)에는 안 걸리지만 시스템 연구자가 챙겨 보는 학회. 제목으로 찾는다.
const SYS_EXTRAS = ['MLSys', 'SoCC', 'HotOS'];
const WD = ['일', '월', '화', '수', '목', '금', '토'];

const ICON = {
  pin: '<svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
  cal: '<svg viewBox="0 0 24 24"><rect x="3" y="4.5" width="18" height="16" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg>',
  link: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  book: '<svg viewBox="0 0 24 24"><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19"/></svg>',
  dl: '<svg viewBox="0 0 24 24"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  note: '<svg viewBox="0 0 24 24"><path d="M5 4h14v16H5zM9 9h6M9 13h6M9 17h3"/></svg>',
  flag: '<svg viewBox="0 0 24 24"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>',
  sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon: '<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>',
  auto: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17a8.5 8.5 0 0 0 0-17z" fill="currentColor" stroke="none"/></svg>',
};

/* ════════════════ 유틸 ════════════════ */
const $ = (s, el = document) => el.querySelector(s);
const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC_MAP[c]);
const pad = (n) => String(n).padStart(2, '0');
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

const dayNum = (y, m, d) => Math.round(Date.UTC(y, m, d) / DAY);
const dayNumOfDate = (d) => dayNum(d.getFullYear(), d.getMonth(), d.getDate());
const dayNumOfMs = (ms) => dayNumOfDate(new Date(ms));
const dayNumOfYmd = (s) => dayNum(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const partsOfDay = (n) => {
  const u = new Date(n * DAY);
  return { y: u.getUTCFullYear(), m: u.getUTCMonth(), d: u.getUTCDate(), w: u.getUTCDay() };
};
const ymdOfDay = (n) => { const p = partsOfDay(n); return `${p.y}-${pad(p.m + 1)}-${pad(p.d)}`; };
const todayNum = () => dayNumOfDate(new Date());
const firstOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);

const LOCAL_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
const TZ_LABEL = (() => {
  if (LOCAL_TZ === 'Asia/Seoul') return 'KST';
  const off = -new Date().getTimezoneOffset();
  const h = Math.trunc(Math.abs(off) / 60);
  const mm = Math.abs(off) % 60;
  return `UTC${off >= 0 ? '+' : '−'}${h}${mm ? `:${pad(mm)}` : ''}`;
})();

const fmtDate = (ms) => { const d = new Date(ms); return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WD[d.getDay()]})`; };
const fmtTime = (ms) => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const fmtFull = (ms) => `${new Date(ms).getFullYear()}년 ${fmtDate(ms)} ${fmtTime(ms)}`;
const fmtDay = (n, withYear) => { const p = partsOfDay(n); return `${withYear ? `${p.y}년 ` : ''}${p.m + 1}월 ${p.d}일 (${WD[p.w]})`; };
function fmtRange(ed) {
  const a = partsOfDay(dayNumOfYmd(ed.start));
  const b = partsOfDay(dayNumOfYmd(ed.end));
  if (ed.start === ed.end) return fmtDay(dayNumOfYmd(ed.start), true);
  if (a.y !== b.y) return `${a.y}년 ${a.m + 1}월 ${a.d}일 – ${b.y}년 ${b.m + 1}월 ${b.d}일`;
  if (a.m !== b.m) return `${a.y}년 ${a.m + 1}월 ${a.d}일 – ${b.m + 1}월 ${b.d}일`;
  return `${a.y}년 ${a.m + 1}월 ${a.d}일 – ${b.d}일`;
}
function fmtRelative(ms) {
  const s = (Date.now() - ms) / 1000;
  if (s < 60) return '방금';
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < DAY / 1000) return `${Math.floor(s / 3600)}시간 전`;
  return `${Math.floor(s / 86400)}일 전`;
}
function remain(ms) {
  let diff = Math.max(0, ms - Date.now());
  const d = Math.floor(diff / DAY); diff -= d * DAY;
  const h = Math.floor(diff / 3600000); diff -= h * 3600000;
  const m = Math.floor(diff / 60000); diff -= m * 60000;
  return { d, h, m, s: Math.floor(diff / 1000) };
}
function remainText(ms) {
  if (ms <= Date.now()) return '마감됨';
  const r = remain(ms);
  return r.d > 0 ? `${r.d}일 ${r.h}시간 남음` : `${r.h}시간 ${r.m}분 남음`;
}
function ddayInfo(ev) {
  const n = ev.d0 - state.today;
  if (ev.type === 'mine' && !ev.mine.time) {
    if (state.today > ev.d1) return { text: '지남', cls: 'done' };
    if (state.today >= ev.d0) return { text: ev.d1 > ev.d0 ? '진행 중' : 'D-DAY', cls: 'hot' };
    return { text: `D-${n}`, cls: n <= 3 ? 'hot' : n <= 14 ? 'warm' : '' };
  }
  if (ev.type === 'conf') {
    if (state.today > ev.d1) return { text: '종료', cls: 'done' };
    if (state.today >= ev.d0) return { text: '진행 중', cls: 'hot' };
    return { text: `D-${n}`, cls: '' };
  }
  if (ev.at <= Date.now()) return { text: '지남', cls: 'done' };
  if (n <= 0) return { text: 'D-DAY', cls: 'hot' };
  return { text: `D-${n}`, cls: n <= 3 ? 'hot' : n <= 14 ? 'warm' : '' };
}
const isPast = (ev) => ((ev.type === 'conf' || (ev.type === 'mine' && !ev.mine.time))
  ? ev.d1 < state.today : ev.at < Date.now());
const colorOf = (ev) => (ev.type === 'mine' ? ev.mine.color : CATS[ev.conf.cat].color);
const isHttp = (u) => /^https?:\/\//i.test(u || '');

/* ════════════════ 저장소 (이 PC에만 저장) ════════════════ */
const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  },
  set(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* 저장 불가 환경 */ }
  },
};
const PREF_KEY = 'confcal.prefs.v1';
const STAR_KEY = 'confcal.stars.v1';
const NOTI_KEY = 'confcal.notified.v1';

/* ════════════════ 상태 ════════════════ */
const prefs = store.get(PREF_KEY, {});
const state = {
  conferences: [],
  confByKey: new Map(),
  events: [],
  byId: new Map(),
  visible: [],
  visibleConfCount: 0,
  view: prefs.view === 'list' ? 'list' : 'month',
  cursor: firstOfMonth(new Date()),
  q: '',
  // v1.2에서 분야·등급 체계가 바뀌어서, 예전 설정이면 새 기본값으로
  subs: new Set(prefs.v12 && prefs.subs ? prefs.subs
    : Object.keys(CATS).filter((k) => CATS[k].group !== 'etc')),
  crit: CRIT_KEYS.includes(prefs.crit) ? prefs.crit : 'kiise',
  tiers: Object.fromEntries(CRIT_KEYS.map((k) => [k, new Set(
    prefs.tiers && Array.isArray(prefs.tiers[k]) ? prefs.tiers[k] : DEFAULT_TIERS[k])])),
  types: new Set([...(prefs.types || ['deadline', 'abstract', 'conf']), ...(prefs.typesV2 ? [] : ['mine'])]),
  myEvents: [],
  mine: [],
  starredOnly: !!prefs.starredOnly,
  etcOpen: !!prefs.etcOpen,
  sysExtras: prefs.sysExtras !== false,
  theme: ['light', 'dark'].includes(prefs.theme) ? prefs.theme : 'system',
  stars: new Set(store.get(STAR_KEY, [])),
  fetchedAt: null,
  source: null,
  status: 'idle',
  drawer: null,
  today: todayNum(),
};
function savePrefs() {
  store.set(PREF_KEY, {
    view: state.view, subs: [...state.subs], crit: state.crit, tiers: Object.fromEntries(CRIT_KEYS.map((k) => [k, [...state.tiers[k]]])), types: [...state.types], typesV2: true, v12: true,
    starredOnly: state.starredOnly, etcOpen: state.etcOpen, sysExtras: state.sysExtras, theme: state.theme,
  });
}

/* ════════════════ 데이터 ════════════════ */
function buildEvents(confs) {
  const evs = [];
  for (const c of confs) {
    c.cat = SUBCAT_OF.get(c.dblp) || SUB_FALLBACK[c.sub] || 'MX';
    c.grade = c.grade || { bk: 0, kiise: '' };
    for (const ed of c.editions) {
      ed.timeline.forEach((t, i) => {
        for (const type of POINT_TYPES) {
          const at = t[type];
          if (at == null) continue;
          const d = dayNumOfMs(at);
          evs.push({ id: `${c.key}|${ed.id}|${i}|${type}`, type, at, d0: d, d1: d, conf: c, ed, t });
        }
      });
      if (ed.start && ed.end) {
        const d0 = dayNumOfYmd(ed.start);
        const p = partsOfDay(d0);
        evs.push({
          id: `${c.key}|${ed.id}|conf`, type: 'conf', at: new Date(p.y, p.m, p.d).getTime(),
          d0, d1: dayNumOfYmd(ed.end), conf: c, ed,
        });
      }
    }
  }
  return evs.sort((a, b) => a.at - b.at);
}

function setData(payload) {
  state.conferences = payload.conferences || [];
  state.fetchedAt = payload.fetchedAt || null;
  state.source = payload.source;
  state.confByKey = new Map(state.conferences.map((c) => [c.key, c]));
  state.events = buildEvents(state.conferences);
  state.byId = new Map(state.events.map((e) => [e.id, e]));
  buildMine();
  renderSidebar();
  render();
  if (state.drawer && state.drawer.mode !== 'mine') {
    if (state.confByKey.has(state.drawer.key)) renderDrawer(); else closeDrawer();
  }
  notifyUpcoming();
}

function confMatches(c) {
  const q = state.q.trim().toLowerCase();
  const starred = state.stars.has(c.key);
  if (state.starredOnly && !starred) return false;
  // 검색어가 있으면 분야·등급 필터와 상관없이 전체에서 찾는다
  if (q) return `${c.title} ${c.description} ${c.dblp}`.toLowerCase().includes(q);
  if (starred) return true;
  if (state.sysExtras && SYS_EXTRAS.includes(c.title)) return true;
  if (!state.subs.has(c.cat)) return false;
  const sel = state.tiers[state.crit];
  if (sel.size && !sel.has(gradeOf(c))) return false;
  return true;
}

function computeVisible() {
  const ok = new Map();
  let n = 0;
  for (const c of state.conferences) {
    const m = confMatches(c);
    ok.set(c, m);
    if (m) n++;
  }
  state.visibleConfCount = n;
  const confEvs = state.events.filter((e) => ok.get(e.conf) && state.types.has(e.type));
  const q = state.q.trim().toLowerCase();
  const mineEvs = state.types.has('mine')
    ? state.mine.filter((e) => !q || `${e.mine.title} ${e.mine.memo}`.toLowerCase().includes(q))
    : [];
  state.visible = mineEvs.length ? [...confEvs, ...mineEvs].sort((a, b) => a.at - b.at) : confEvs;
}

/* ════════════════ 내 일정 ════════════════ */
function buildMine() {
  state.mine = state.myEvents.map((m) => {
    const d0 = dayNumOfYmd(m.date);
    const d1 = m.endDate && m.endDate > m.date ? dayNumOfYmd(m.endDate) : d0;
    const p = partsOfDay(d0);
    const [hh, mm] = m.time ? m.time.split(':').map(Number) : [0, 0];
    return { id: `mine|${m.id}`, type: 'mine', at: new Date(p.y, p.m, p.d, hh, mm).getTime(), d0, d1, mine: m };
  }).sort((a, b) => a.at - b.at);
  for (const e of state.mine) state.byId.set(e.id, e);
}

function setMine(list) {
  for (const id of [...state.byId.keys()]) if (id.startsWith('mine|')) state.byId.delete(id);
  state.myEvents = Array.isArray(list) ? list : [];
  buildMine();
  render();
}

async function persistMine(next) {
  setMine(await window.api.saveMine(next));
}

function mineWhen(m) {
  const d0 = dayNumOfYmd(m.date);
  if (m.endDate && m.endDate > m.date) return `${fmtDay(d0, true)} – ${fmtDay(dayNumOfYmd(m.endDate))}`;
  return `${fmtDay(d0, true)} ${m.time || '하루 종일'}`;
}

function openMineEditor(m, dayN) {
  const editing = !!m;
  const base = m || {
    id: '', title: '', date: ymdOfDay(dayN ?? state.today), endDate: '', time: '', color: MINE_COLORS[0], memo: '',
  };
  state.drawer = { mode: 'mine', id: base.id };
  const swatches = MINE_COLORS.map((c) => `<label class="sw-pick" style="--c:${c}">
      <input type="radio" name="color" value="${c}" ${c === base.color ? 'checked' : ''}><span></span></label>`).join('');
  $('#drawerPanel').innerHTML = `
    <form id="mineForm" class="mine-form" autocomplete="off">
      <div class="d-head" style="--c:${esc(base.color)}">
        <div class="d-cat"><span class="dot"></span>내 일정${m && m.synced ? ' · 구글 캘린더와 동기화됨' : ''}</div>
        <div class="d-titlerow">
          <h2>${editing ? '일정 수정' : '새 일정'}</h2>
          <button type="button" class="icon-btn" data-close title="닫기 (Esc)">${ICON.close}</button>
        </div>
      </div>
      <div class="d-body">
        <label class="field"><span>제목</span>
          <input name="title" required maxlength="200" placeholder="예: OSDI 제출 전 내부 리뷰" value="${esc(base.title)}"></label>
        <div class="field-row">
          <label class="field"><span>날짜</span><input type="date" name="date" required value="${esc(base.date)}"></label>
          <label class="field"><span>종료일 <em>여러 날일 때</em></span><input type="date" name="endDate" value="${esc(base.endDate)}"></label>
        </div>
        <label class="field"><span>시간 <em>비우면 하루 종일</em></span><input type="time" name="time" value="${esc(base.time)}" ${base.endDate ? 'disabled' : ''}></label>
        <div class="field"><span>색</span><div class="sw-row">${swatches}</div></div>
        <label class="field"><span>메모</span><textarea name="memo" rows="5" maxlength="5000" placeholder="장소, 링크, 할 일 등">${esc(base.memo)}</textarea></label>
        ${m && m.recurring ? '<p class="form-note">구글의 반복 일정이에요. 여기서 바꾸거나 지우면 이 날짜 하나만 바뀌어요.</p>' : ''}
        ${m && m.synced ? '<p class="form-note">색은 이 앱에서만 바뀌고, 나머지는 구글 캘린더에도 반영돼요.</p>' : ''}
        <p class="form-error" hidden></p>
      </div>
      <div class="d-actions">
        <button type="submit" class="btn primary">${editing ? '저장' : '추가'}</button>
        <button type="button" class="btn ghost" data-close>취소</button>
        ${editing ? `<button type="button" class="btn ghost danger" data-mine-delete>${ICON.trash}삭제</button>` : ''}
      </div>
    </form>`;
  const d = $('#drawer');
  d.classList.add('open');
  d.setAttribute('aria-hidden', 'false');
  hideTooltip();
  closePopover();
  setTimeout(() => $('#mineForm [name=title]')?.focus(), 50);
}

async function submitMine(form) {
  const f = new FormData(form);
  const title = String(f.get('title') || '').trim();
  const date = String(f.get('date') || '');
  let endDate = String(f.get('endDate') || '');
  const err = $('.form-error', form);
  if (!title || !date) { err.textContent = '제목과 날짜를 입력해 주세요.'; err.hidden = false; return; }
  if (endDate && endDate < date) { err.textContent = '종료일이 시작일보다 빨라요.'; err.hidden = false; return; }
  if (endDate === date) endDate = '';
  const id = state.drawer.id || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const item = {
    id, title, date, endDate, time: endDate ? '' : String(f.get('time') || ''),
    color: String(f.get('color') || MINE_COLORS[0]), memo: String(f.get('memo') || ''), updatedAt: Date.now(),
  };
  const wasEditing = !!state.drawer.id;
  const next = state.myEvents.filter((m) => m.id !== id).concat(item);
  try {
    await persistMine(next);
  } catch (e) {
    err.textContent = `저장하지 못했어요: ${cleanErr(e)}`; err.hidden = false; return;
  }
  closeDrawer();
  toast(wasEditing ? '일정을 수정했어요' : `‘${title}’ 일정을 추가했어요`);
  const ev = state.byId.get(`mine|${id}`);
  if (ev) jumpTo(ev);
}

async function deleteMine(btn) {
  if (!btn.dataset.armed) {
    btn.dataset.armed = '1';
    btn.innerHTML = `${ICON.trash}한 번 더 누르면 삭제`;
    setTimeout(() => { if (btn.isConnected) { delete btn.dataset.armed; btn.innerHTML = `${ICON.trash}삭제`; } }, 3000);
    return;
  }
  const id = state.drawer.id;
  const removed = state.myEvents.find((m) => m.id === id);
  await persistMine(state.myEvents.filter((m) => m.id !== id));
  closeDrawer();
  toast('일정을 삭제했어요', {
    action: '되돌리기', ms: 6000,
    onAction: () => removed && persistMine(state.myEvents.concat(removed)),
  });
}

/* ════════════════ 렌더링 ════════════════ */
function render() {
  computeVisible();
  renderHeader();
  $('#monthView').hidden = state.view !== 'month';
  $('#listView').hidden = state.view !== 'list';
  if (state.view === 'month') renderMonth(); else renderList();
  renderUpcoming();
  renderStars();
  renderStatus();
}

function renderHeader() {
  const y = state.cursor.getFullYear();
  const m = state.cursor.getMonth() + 1;
  $('#period').textContent = state.view === 'month' ? `${y}년 ${m}월` : `${y}년 ${m}월부터`;
  for (const b of document.querySelectorAll('#viewSeg button')) b.classList.toggle('on', b.dataset.view === state.view);
}

function gradeBadge(c, k) {
  const cr = CRITERIA[k];
  const v = cr.get(c);
  if (!v) return '';
  const lvl = cr.tiers.findIndex(([id]) => id === v); // 0 = 최상위
  return `<span class="rank lv${lvl}" title="${esc(cr.full)}">${esc(cr.badge(v))}</span>`;
}
// 목록·툴팁: 지금 고른 기준의 등급만
function rankBadges(c, { venue = true } = {}) {
  return gradeBadge(c, state.crit) + (venue ? venueBadge(c) : '');
}
// 상세 화면: 모든 기준
function allGradeBadges(c) {
  const parts = CRIT_KEYS.map((k) => gradeBadge(c, k)).filter(Boolean);
  return (parts.length ? parts.join('') : '<span class="rank muted-rank">등급 목록에 없음</span>') + venueBadge(c);
}
function venueBadge(c) {
  return c.journal
    ? `<span class="venue journal" title="논문이 ${esc(c.journal)} 저널에 실려요">저널형 · ${esc(c.journal)}</span>`
    : '<span class="venue">컨퍼런스</span>';
}

function chipHtml(e, opt = {}) {
  const pos = opt.col ? `grid-column:${opt.col};grid-row:${opt.row};` : '';
  const cls = ['ev', e.type, isPast(e) && 'past', opt.cl && 'cl', opt.cr && 'cr'].filter(Boolean).join(' ');
  if (e.type === 'mine') {
    const m = e.mine;
    const time = m.time ? `<span class="time">${esc(m.time)}</span>` : '';
    return `<div class="${cls}" style="--c:${esc(m.color)};${pos}" data-ev="${esc(e.id)}">${time}<span class="t">${esc(m.title)}</span></div>`;
  }
  const c = e.conf;
  const color = CATS[c.cat].color;
  const star = state.stars.has(c.key) ? '<span class="star">★</span>' : '';
  let inner;
  if (e.type === 'conf') {
    inner = `${ICON.flag}<span class="t">${esc(c.title)} ${e.ed.year}${e.ed.place ? ` · ${esc(e.ed.place)}` : ''}</span>`;
  } else {
    inner = `<span class="t">${esc(c.title)}</span><span class="tag">${TYPES[e.type].tag}</span>`
      + (opt.time ? `<span class="time">${fmtTime(e.at)}</span>` : '');
  }
  return `<div class="${cls}" style="--c:${color};${pos}" data-ev="${esc(e.id)}">${star}${inner}</div>`;
}

function laneSort(a, b) {
  const sa = a.d1 > a.d0 ? 0 : 1;
  const sb = b.d1 > b.d0 ? 0 : 1;
  return sa - sb || a.d0 - b.d0 || (b.d1 - b.d0) - (a.d1 - a.d0) || a.at - b.at;
}

function renderMonth() {
  const el = $('#monthView');
  if (!el.querySelector('.weeks')) {
    el.innerHTML = `<div class="dow">${WD.map((d) => `<div>${d}</div>`).join('')}</div><div class="weeks"></div>`;
  }
  const weeksEl = $('.weeks', el);
  const y = state.cursor.getFullYear();
  const m = state.cursor.getMonth();
  const first = dayNum(y, m, 1);
  const start = first - partsOfDay(first).w;
  const last = dayNum(y, m + 1, 0);
  const end = last + (6 - partsOfDay(last).w);
  const weeks = Math.round((end - start + 1) / 7);
  weeksEl.style.gridTemplateRows = `repeat(${weeks}, minmax(0, 1fr))`;

  const LANE_H = 24; // 칩 21px + 간격 3px
  const weekH = (weeksEl.clientHeight || 640) / weeks;
  const maxLanes = Math.max(1, Math.floor((weekH - 33 - 2 + 3) / LANE_H));
  const evs = state.visible.filter((e) => e.d1 >= start && e.d0 <= end);

  let html = '';
  for (let w = 0; w < weeks; w++) {
    const ws = start + w * 7;
    const we = ws + 6;
    let cells = '';
    for (let i = 0; i < 7; i++) {
      const n = ws + i;
      const p = partsOfDay(n);
      const cls = ['cell', p.m !== m && 'other', n === state.today && 'today', i === 0 && 'sun', i === 6 && 'sat']
        .filter(Boolean).join(' ');
      const label = p.d === 1 && p.m !== m ? `<span class="month-label">${p.m + 1}월</span>` : '';
      cells += `<div class="${cls}" data-day="${n}"><span class="num">${p.d}</span>${label}</div>`;
    }

    const items = evs.filter((e) => e.d1 >= ws && e.d0 <= we).sort(laneSort);
    const lanes = [];
    const placed = items.map((e) => {
      const c0 = Math.max(e.d0, ws) - ws;
      const c1 = Math.min(e.d1, we) - ws;
      let lane = lanes.findIndex((l) => !l.slice(c0, c1 + 1).some(Boolean));
      if (lane < 0) { lane = lanes.length; lanes.push(new Array(7).fill(false)); }
      for (let c = c0; c <= c1; c++) lanes[lane][c] = true;
      return { e, lane, c0, c1 };
    });
    const overflow = lanes.length > maxLanes;
    const show = overflow ? maxLanes - 1 : lanes.length;
    const hidden = new Array(7).fill(0);
    let laneHtml = '';
    for (const p of placed) {
      if (p.lane >= show) {
        for (let c = p.c0; c <= p.c1; c++) hidden[c]++;
        continue;
      }
      laneHtml += chipHtml(p.e, {
        col: `${p.c0 + 1} / ${p.c1 + 2}`, row: p.lane + 1, cl: p.e.d0 < ws, cr: p.e.d1 > we,
      });
    }
    if (overflow) {
      hidden.forEach((h, c) => {
        if (h) laneHtml += `<button class="more" data-day="${ws + c}" style="grid-column:${c + 1};grid-row:${show + 1}">+${h}개 더</button>`;
      });
    }
    html += `<div class="week"><div class="cells">${cells}</div><div class="lanes">${laneHtml}</div></div>`;
  }
  const inMonth = evs.some((e) => e.d1 >= first && e.d0 <= last);
  if (!inMonth) {
    const msg = state.visibleConfCount === 0
      ? (state.q ? `‘${esc(state.q)}’와 일치하는 학회가 없어요` : '필터에 맞는 학회가 없어요. 왼쪽에서 분야나 등급을 켜 보세요.')
      : '이 달에는 표시할 일정이 없어요';
    html += `<div class="empty-hint"><span>${msg}</span></div>`;
  }
  weeksEl.innerHTML = html;
}

function renderList() {
  const el = $('#listView');
  const y = state.cursor.getFullYear();
  const m = state.cursor.getMonth();
  const from = dayNum(y, m, 1);
  const to = dayNum(y, m + 18, 0);
  const evs = state.visible.filter((e) => e.d0 >= from && e.d0 <= to)
    .sort((a, b) => a.d0 - b.d0 || a.at - b.at);
  if (!evs.length) {
    el.innerHTML = `<div class="list-empty"><b>표시할 일정이 없어요</b>${state.q ? `‘${esc(state.q)}’ 검색 결과가 없습니다.` : '왼쪽 필터에서 분야·등급·일정 종류를 조정해 보세요.'}</div>`;
    return;
  }
  const groups = new Map();
  for (const e of evs) {
    const p = partsOfDay(e.d0);
    const k = `${p.y}-${p.m}`;
    if (!groups.has(k)) groups.set(k, { y: p.y, m: p.m, items: [] });
    groups.get(k).items.push(e);
  }
  let html = '';
  for (const g of groups.values()) {
    html += `<section class="lg"><div class="lg-head"><h2>${g.y}년 ${g.m + 1}월</h2><span>${g.items.length}개 일정</span></div>`;
    for (const e of g.items) {
      const p = partsOfDay(e.d0);
      const dd = ddayInfo(e);
      if (e.type === 'mine') {
        const m = e.mine;
        const when = m.endDate ? `${fmtDay(e.d0)} – ${fmtDay(e.d1)}` : (m.time || '하루 종일');
        html += `<div class="lrow mine ${isPast(e) ? 'past' : ''}" style="--c:${esc(m.color)}" data-ev="${esc(e.id)}">
          <div class="ld ${p.w === 0 ? 'sun' : p.w === 6 ? 'sat' : ''}"><b>${p.d}</b><span>${WD[p.w]}요일</span></div>
          <div class="bar"></div>
          <div class="lt">
            <div class="name">${esc(m.title)} <span class="type-pill mine">내 일정</span></div>
            <div class="sub">${esc(when)}${m.memo ? ` · ${esc(m.memo.split('\n')[0])}` : ''}</div>
          </div>
          <div class="dd ${dd.cls}">${dd.text}</div>
        </div>`;
        continue;
      }
      const c = e.conf;
      const star = state.stars.has(c.key) ? '<span style="color:#f5b400">★</span>' : '';
      const sub = e.type === 'conf'
        ? `${fmtRange(e.ed)}${e.ed.place ? ` · ${esc(e.ed.place)}` : ''}`
        : `${fmtTime(e.at)} ${TZ_LABEL}${e.t.comment ? ` · ${esc(e.t.comment)}` : ''} · ${esc(c.description)}`;
      html += `<div class="lrow ${e.type} ${isPast(e) ? 'past' : ''}" style="--c:${CATS[c.cat].color}" data-ev="${esc(e.id)}">
        <div class="ld ${p.w === 0 ? 'sun' : p.w === 6 ? 'sat' : ''}"><b>${p.d}</b><span>${WD[p.w]}요일</span></div>
        <div class="bar"></div>
        <div class="lt">
          <div class="name">${star}${esc(c.title)} <span class="muted" style="font-weight:600">${e.ed.year}</span>
            <span class="type-pill ${e.type}">${TYPES[e.type].name}</span>${rankBadges(c)}</div>
          <div class="sub">${sub}</div>
        </div>
        <div class="dd ${dd.cls}">${dd.text}</div>
      </div>`;
    }
    html += '</section>';
  }
  el.innerHTML = html;
}

function renderUpcoming() {
  const now = Date.now();
  const ups = [];
  for (const e of state.visible) {
    if ((e.type === 'deadline' || e.type === 'abstract' || e.type === 'mine') && e.at > now) {
      ups.push(e);
      if (ups.length >= 80) break;
    }
  }
  $('#upCount').textContent = ups.length ? `${ups.length >= 80 ? '80+' : ups.length}개` : '';

  const hero = ups[0];
  if (!hero) {
    $('#hero').innerHTML = '<div class="hero-empty">앞으로 남은 마감이 없어요.<br>필터를 넓혀 보세요.</div>';
  } else {
    const isMine = hero.type === 'mine';
    const c = hero.conf;
    const head = isMine
      ? `<div class="h-label"><span>다음 일정</span><span>내 일정</span></div>
         <div class="h-title">${esc(hero.mine.title)}</div>
         <div class="h-type">${hero.mine.time ? '' : '하루 종일 · '}${esc((hero.mine.memo || '').split('\n')[0])}</div>`
      : `<div class="h-label"><span>다음 마감</span><span>${esc(CATS[c.cat].name)}</span></div>
         <div class="h-title">${state.stars.has(c.key) ? '★ ' : ''}${esc(c.title)}<small>${hero.ed.year}</small></div>
         <div class="h-type">${TYPES[hero.type].name}${hero.t.comment ? ` · ${esc(hero.t.comment)}` : ''}</div>`;
    $('#hero').innerHTML = `<div class="hero" style="--c:${esc(colorOf(hero))}" data-ev="${esc(hero.id)}">
      ${head}
      <div class="clock" data-clock="${hero.at}">
        <div><b data-u="d"></b><span>일</span></div><div><b data-u="h"></b><span>시간</span></div>
        <div><b data-u="m"></b><span>분</span></div><div><b data-u="s"></b><span>초</span></div>
      </div>
      <div class="h-when">${isMine && !hero.mine.time ? `${fmtDay(hero.d0, true)} 하루 종일` : `${fmtFull(hero.at)} ${TZ_LABEL}`}</div>
    </div>`;
    updateClock();
  }

  let html = '';
  let lastMonth = null;
  for (const e of ups.slice(1)) {
    const d = new Date(e.at);
    const mk = `${d.getFullYear()}-${d.getMonth()}`;
    if (mk !== lastMonth) {
      lastMonth = mk;
      html += `<div class="up-month">${d.getFullYear() !== new Date().getFullYear() ? `${d.getFullYear()}년 ` : ''}${d.getMonth() + 1}월</div>`;
    }
    const dd = ddayInfo(e);
    const isMine = e.type === 'mine';
    const c = e.conf;
    const nm = isMine
      ? `<span>${esc(e.mine.title)}</span><small>내 일정</small>`
      : `<span>${state.stars.has(c.key) ? '★ ' : ''}${esc(c.title)}</span><small>${e.ed.year} · ${TYPES[e.type].name}</small>`;
    html += `<div class="up-item ${e.type}" style="--c:${esc(colorOf(e))}" data-ev="${esc(e.id)}">
      <div class="bar"></div>
      <div style="min-width:0">
        <div class="nm">${nm}</div>
        <div class="wh">${fmtDate(e.at)} ${isMine && !e.mine.time ? '하루 종일' : fmtTime(e.at)}</div>
      </div>
      <div class="dd ${dd.cls}">${dd.text}</div>
    </div>`;
  }
  $('#upList').innerHTML = html;
}

function updateClock() {
  const clock = $('#hero .clock');
  if (!clock) return;
  const at = Number(clock.dataset.clock);
  if (at <= Date.now()) { render(); return; }
  const r = remain(at);
  for (const b of clock.querySelectorAll('b')) {
    const v = r[b.dataset.u];
    b.textContent = b.dataset.u === 'd' ? String(v) : pad(v);
  }
}

function renderSidebar() {
  const counts = {};
  for (const c of state.conferences) counts[c.cat] = (counts[c.cat] || 0) + 1;
  $('#catFilters').innerHTML = GROUPS.map((g) => {
    const cats = Object.entries(CATS).filter(([, v]) => v.group === g.id);
    const onCount = cats.filter(([k]) => state.subs.has(k)).length;
    const allOn = onCount === cats.length;
    const collapsible = g.id === 'etc';
    const open = !collapsible || state.etcOpen;
    const rows = cats.map(([k, v]) => `<label class="check-row" style="--c:${v.color}">
        <input type="checkbox" data-sub="${k}" ${state.subs.has(k) ? 'checked' : ''}>
        <span class="box"></span><span class="label">${v.name}</span><span class="count">${counts[k] || 0}</span>
      </label>`).join('');
    const extras = g.id === 'sys' ? `<label class="check-row extras-row" title="CCF·CORE 등급 필터와 상관없이 항상 표시">
        <input type="checkbox" data-extras ${state.sysExtras ? 'checked' : ''}>
        <span class="box"></span><span class="label">${SYS_EXTRAS.join(' · ')} 항상 포함</span>
      </label>` : '';
    const summary = `<button class="group-summary" data-collapse>
        ${cats.map(([, v]) => `<span class="dot" style="background:${v.color}"></span>`).join('')}
        <span>${onCount ? `${onCount}개 분야 켜짐` : '보안 · DB · HCI 등'}</span></button>`;
    return `<div class="group">
      <div class="group-head"><span>${g.name}</span><span class="gh-actions">
        ${cats.length > 1 && open ? `<button data-group="${g.id}">${allOn ? '모두 끄기' : '모두 켜기'}</button>` : ''}
        ${collapsible ? `<button data-collapse>${open ? '접기' : '펼치기'}</button>` : ''}
      </span></div>
      ${open ? rows + extras : summary}
    </div>`;
  }).join('');

  const cr = CRITERIA[state.crit];
  const sel = state.tiers[state.crit];
  const count = (id) => state.conferences.filter((c) => gradeOf(c) === id).length;
  const chip = (id, label) => `<button class="chip ${sel.has(id) ? 'on' : ''}" data-tier="${esc(id)}">${esc(label)}<span class="chip-n">${count(id)}</span></button>`;
  $('#rankFilters').innerHTML = `
    <div class="seg crit-seg">${CRIT_KEYS.map((k) => `<button data-crit="${k}" class="${k === state.crit ? 'on' : ''}">${CRITERIA[k].name}</button>`).join('')}</div>
    <div class="tier-row">
      ${cr.tiers.map(([id, label]) => chip(id, label)).join('')}
      ${chip(NONE, '목록 외')}
      <button class="chip ${sel.size === 0 ? 'on' : ''}" data-tier="">전체</button>
    </div>
    <div class="rank-src">${esc(cr.full)}</div>`;

  $('#typeFilters').innerHTML = TYPE_FILTERS.map((t) => {
    const on = t.types.every((x) => state.types.has(x));
    return `<label class="check-row">
      <input type="checkbox" data-types="${t.types.join(',')}" ${on ? 'checked' : ''}>
      <span class="box"></span><span class="label">${t.name}</span><span class="type-swatch ${t.swatch}"></span>
    </label>`;
  }).join('');

  $('#starOnly').checked = state.starredOnly;
}

function renderStars() {
  const list = [...state.stars].map((k) => state.confByKey.get(k)).filter(Boolean)
    .sort((a, b) => a.title.localeCompare(b.title));
  $('#starList').innerHTML = list.length
    ? list.map((c) => `<button class="star-chip" style="--c:${CATS[c.cat].color}" data-conf="${esc(c.key)}"><span class="dot"></span>${esc(c.title)}</button>`).join('')
    : '<div class="star-empty">일정을 눌러 상세 화면에서 ☆를 누르면 여기에 모여요. 즐겨찾기한 학회는 필터와 상관없이 항상 보여요.</div>';
}

function renderStatus() {
  let led = '';
  let text;
  if (state.status === 'busy') { led = 'busy'; text = '최신 데이터 받는 중…'; }
  else if (state.status === 'error') {
    led = 'warn';
    text = state.fetchedAt ? `업데이트 실패 · ${fmtRelative(state.fetchedAt)} 받은 데이터 사용 중` : '오프라인 · 내장 데이터 사용 중';
  } else if (state.fetchedAt) { led = 'ok'; text = `${fmtRelative(state.fetchedAt)} 업데이트됨`; }
  else text = '내장 데이터 사용 중';
  $('#status').innerHTML = `<span class="led ${led}"></span><span>${text}<br><span style="color:var(--muted-2)">표시 중인 학회 ${state.visibleConfCount} / ${state.conferences.length}</span></span>`;
}

/* ════════════════ 상세 서랍 ════════════════ */
function editionFor(c) {
  const now = Date.now();
  const next = state.events.find((e) => e.conf === c && (e.type === 'conf' ? e.d1 >= state.today : e.at > now));
  return next ? next.ed : c.editions[c.editions.length - 1];
}

function openDetail(c, ed, focusId) {
  state.drawer = { key: c.key, edId: (ed || editionFor(c)).id, focusId: focusId || null };
  renderDrawer();
  const d = $('#drawer');
  d.classList.add('open');
  d.setAttribute('aria-hidden', 'false');
  hideTooltip();
  closePopover();
}

function closeDrawer() {
  state.drawer = null;
  const d = $('#drawer');
  d.classList.remove('open');
  d.setAttribute('aria-hidden', 'true');
}

function renderDrawer() {
  if (!state.drawer || state.drawer.mode) return; // 입력 중인 양식(내 일정·구글·피드백)은 다시 그리지 않음
  const { key, edId, focusId } = state.drawer;
  const c = state.confByKey.get(key);
  if (!c) return;
  const ed = c.editions.find((x) => x.id === edId) || c.editions[c.editions.length - 1];
  const cat = CATS[c.cat];
  const starred = state.stars.has(c.key);
  const now = Date.now();

  const years = c.editions.slice(-6).map((x) => `<button class="chip ${x.id === ed.id ? 'on' : ''}" data-ed="${esc(x.id)}">${x.year}</button>`).join('');

  const tls = ed.timeline.map((t, i) => {
    const rows = POINT_TYPES.filter((k) => t[k] != null || t[`${k}Tbd`]).map((k) => {
      if (t[k] == null) {
        return `<div class="tl-row"><div class="k">${TYPES[k].name}</div><div class="v"><b>미정 (TBD)</b></div><div></div></div>`;
      }
      const id = `${c.key}|${ed.id}|${i}|${k}`;
      const ev = state.byId.get(id);
      const dd = ev ? ddayInfo(ev) : { text: '', cls: '' };
      const extra = t[k] > now ? `${remainText(t[k])} · ` : '';
      return `<div class="tl-row ${id === focusId ? 'focus' : ''} ${t[k] < now ? 'past' : ''}">
        <div class="k ${k}">${TYPES[k].name}</div>
        <div class="v"><b>${fmtFull(t[k])} ${TZ_LABEL}</b><span>${extra}원본 ${esc(t[`${k}Raw`] || '')} (${esc(ed.timezone)})</span></div>
        <div class="dd ${dd.cls}">${dd.text}</div>
      </div>`;
    });
    if (!rows.length) return '';
    return `<div class="tl">${t.comment ? `<div class="tl-cmt">${esc(t.comment)}</div>` : ''}${rows.join('')}</div>`;
  }).join('') || '<div class="tl"><div class="tbd">아직 마감 일정이 발표되지 않았어요.</div></div>';

  const confEv = state.byId.get(`${c.key}|${ed.id}|conf`);
  const confDd = confEv ? ddayInfo(confEv) : null;
  const dateLine = ed.start ? fmtRange(ed) : esc(ed.dateText || '미정');

  const actions = [
    isHttp(ed.link) && `<button class="btn primary" data-open="${esc(ed.link)}">${ICON.link}학회 웹사이트</button>`,
    c.dblp && `<button class="btn ghost" data-open="https://dblp.org/db/conf/${encodeURIComponent(c.dblp)}/">${ICON.book}DBLP</button>`,
    `<button class="btn ghost" data-ics-ed>${ICON.dl}이 회차 .ics</button>`,
  ].filter(Boolean).join('');

  $('#drawerPanel').innerHTML = `
    <div class="d-head" style="--c:${cat.color}">
      <div class="d-cat"><span class="dot"></span>${esc(cat.name)}</div>
      <div class="d-titlerow">
        <h2>${esc(c.title)}<small>${ed.year}</small></h2>
        <button class="icon-btn star-btn ${starred ? 'on' : ''}" data-star title="${starred ? '즐겨찾기 해제' : '즐겨찾기에 추가'}">${starred ? '★' : '☆'}</button>
        <button class="icon-btn" data-close title="닫기 (Esc)">${ICON.close}</button>
      </div>
      <p class="d-desc">${esc(c.description)}</p>
      <div class="badges">${allGradeBadges(c)}</div>
    </div>
    <div class="d-body" style="--c:${cat.color}">
      <div class="years">${years}</div>
      <section class="d-sec">
        <h4>마감 일정 · ${TZ_LABEL} 기준</h4>
        ${tls}
      </section>
      <section class="d-sec">
        <h4>학회 개최</h4>
        <div class="kv">${ICON.cal}<span style="flex:1">${dateLine}</span>${confDd ? `<span class="dd ${confDd.cls}">${confDd.text}</span>` : ''}</div>
        ${ed.place ? `<div class="kv">${ICON.pin}<span>${esc(ed.place)}</span></div>` : ''}
      </section>
    </div>
    <div class="d-actions">${actions}</div>`;
}

/* ════════════════ 팝오버 · 툴팁 · 토스트 ════════════════ */
function openDayPopover(n, anchor) {
  closePopover();
  const evs = state.visible.filter((e) => e.d0 <= n && e.d1 >= n)
    .sort((a, b) => (a.type === 'conf') - (b.type === 'conf') || a.at - b.at);
  const pop = $('#popover');
  pop.innerHTML = `<h5>${fmtDay(n, true)}<span class="muted small">${evs.length ? `${evs.length}개` : ''}</span></h5>
    ${evs.map((e) => chipHtml(e, { time: true })).join('')}
    <button class="btn ghost small pop-add" data-add-day="${n}">${ICON.plus}이 날 일정 추가</button>`;
  pop.hidden = false;
  const r = anchor.getBoundingClientRect();
  const w = pop.offsetWidth;
  const h = pop.offsetHeight;
  let left = Math.min(r.left, window.innerWidth - w - 10);
  let top = r.top + 28;
  if (top + h > window.innerHeight - 10) top = Math.max(10, window.innerHeight - h - 10);
  left = Math.max(10, left);
  pop.style.left = `${left}px`;
  pop.style.top = `${top}px`;
}
function closePopover() { $('#popover').hidden = true; }

function showTooltip(ev, x, y) {
  const tip = $('#tooltip');
  const dd = ddayInfo(ev);
  if (ev.type === 'mine') {
    const m = ev.mine;
    tip.innerHTML = `<div class="tt-title"><span style="width:8px;height:8px;border-radius:50%;background:${esc(m.color)}"></span>${esc(m.title)}</div>
      <div class="tt-row"><span>내 일정</span><b>${dd.text}</b></div>
      <div class="tt-row"><b>${esc(mineWhen(m))}</b></div>
      ${m.memo ? `<div class="tt-desc" style="margin-top:6px;white-space:pre-line">${esc(m.memo.slice(0, 300))}</div>` : ''}`;
    tip.hidden = false;
    moveTooltip(x, y);
    return;
  }
  const c = ev.conf;
  const when = ev.type === 'conf' ? fmtRange(ev.ed) : `${fmtFull(ev.at)} ${TZ_LABEL}`;
  const note = ev.type === 'conf' ? (ev.ed.place || '') : (ev.t.comment || '');
  tip.innerHTML = `<div class="tt-title"><span style="width:8px;height:8px;border-radius:50%;background:${CATS[c.cat].color}"></span>${esc(c.title)} ${ev.ed.year}</div>
    <div class="tt-desc">${esc(c.description)}</div>
    <div class="tt-badges">${rankBadges(c)}</div>
    <div class="tt-row"><span>${TYPES[ev.type].name}</span><b>${dd.text}</b></div>
    <div class="tt-row"><b>${when}</b></div>
    ${note ? `<div class="tt-row"><span>${esc(note)}</span></div>` : ''}`;
  tip.hidden = false;
  moveTooltip(x, y);
}
function moveTooltip(x, y) {
  const tip = $('#tooltip');
  if (tip.hidden) return;
  const w = tip.offsetWidth;
  const h = tip.offsetHeight;
  let left = x + 14;
  let top = y + 16;
  if (left + w > window.innerWidth - 8) left = x - w - 14;
  if (top + h > window.innerHeight - 8) top = y - h - 12;
  tip.style.left = `${Math.max(8, left)}px`;
  tip.style.top = `${Math.max(8, top)}px`;
}
function hideTooltip() { $('#tooltip').hidden = true; }

let toastTimer;
function toast(msg, opt = {}) {
  const el = $('#toast');
  el.innerHTML = `<span>${esc(msg)}</span>${opt.action ? `<button>${esc(opt.action)}</button>` : ''}`;
  el.hidden = false;
  if (opt.action) el.querySelector('button').onclick = () => { el.hidden = true; opt.onAction(); };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, opt.ms || 4500);
}

/* ════════════════ .ics 내보내기 ════════════════ */
const enc = new TextEncoder();
function icsEscape(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}
function icsFold(line) {
  const parts = [];
  let cur = '';
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > limit) { parts.push(cur); cur = ''; bytes = 0; limit = 74; }
    cur += ch;
    bytes += b;
  }
  parts.push(cur);
  return parts.join('\r\n ');
}
const icsUtc = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsDate = (ymd) => ymd.replace(/-/g, '');

function buildIcs(events, calName) {
  const stamp = icsUtc(Date.now());
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//conf-calendar//학회 캘린더//KO', 'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH', `X-WR-CALNAME:${icsEscape(calName)}`];
  for (const e of events) {
    if (e.type === 'mine') {
      const m = e.mine;
      L.push('BEGIN:VEVENT', `UID:mine-${m.id.replace(/[^A-Za-z0-9._-]/g, '-')}@conf-calendar`, `DTSTAMP:${stamp}`);
      if (m.time) L.push(`DTSTART:${icsUtc(e.at)}`, `DTEND:${icsUtc(e.at + 3600000)}`);
      else L.push(`DTSTART;VALUE=DATE:${icsDate(m.date)}`, `DTEND;VALUE=DATE:${icsDate(ymdOfDay(e.d1 + 1))}`);
      L.push(`SUMMARY:${icsEscape(m.title)}`, 'CATEGORIES:내 일정');
      if (m.memo) L.push(`DESCRIPTION:${icsEscape(m.memo)}`);
      L.push('END:VEVENT');
      continue;
    }
    const c = e.conf;
    const name = `${c.title} ${e.ed.year}`;
    L.push('BEGIN:VEVENT', `UID:${e.id.replace(/[^A-Za-z0-9._-]/g, '-')}@conf-calendar`, `DTSTAMP:${stamp}`);
    const desc = [c.description];
    if (e.type === 'conf') {
      L.push(`DTSTART;VALUE=DATE:${icsDate(e.ed.start)}`, `DTEND;VALUE=DATE:${icsDate(ymdOfDay(e.d1 + 1))}`,
        `SUMMARY:${icsEscape(`📍 ${name} 개최`)}`, 'TRANSP:TRANSPARENT');
      if (e.ed.place) L.push(`LOCATION:${icsEscape(e.ed.place)}`);
    } else {
      L.push(`DTSTART:${icsUtc(e.at)}`, `SUMMARY:${icsEscape(`⏰ ${name} ${TYPES[e.type].name}`)}`, 'TRANSP:TRANSPARENT');
      if (e.t.comment) desc.push(e.t.comment);
      desc.push(`원본 마감: ${e.t[`${e.type}Raw`] || ''} (${e.ed.timezone})`);
      if (e.type === 'deadline' || e.type === 'abstract') {
        L.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(`${name} ${TYPES[e.type].name} 3일 전`)}`, 'TRIGGER:-P3D', 'END:VALARM');
      }
    }
    if (isHttp(e.ed.link)) { desc.push(e.ed.link); L.push(`URL:${e.ed.link.replace(/[\r\n]/g, '')}`); }
    L.push(`DESCRIPTION:${icsEscape(desc.filter(Boolean).join('\n'))}`, `CATEGORIES:${icsEscape(CATS[c.cat].name)}`, 'END:VEVENT');
  }
  L.push('END:VCALENDAR');
  return `${L.map(icsFold).join('\r\n')}\r\n`;
}

async function saveIcs(events, fileName, calName) {
  try {
    const res = await window.api.saveIcs(fileName, buildIcs(events, calName));
    if (res && res.saved) {
      toast(`${events.length}개 일정을 저장했어요 · 구글 캘린더 설정 → 가져오기에서 불러오세요`, {
        action: '폴더 열기', onAction: () => window.api.revealFile(res.filePath), ms: 7000,
      });
    }
  } catch (err) {
    toast(`저장 실패: ${cleanErr(err)}`);
  }
}

function exportVisible() {
  const now = Date.now();
  const evs = state.visible.filter((e) => ((e.type === 'conf' || (e.type === 'mine' && !e.mine.time))
    ? e.d1 >= state.today : e.at >= now));
  if (!evs.length) { toast('내보낼 앞으로의 일정이 없어요. 필터를 확인해 주세요.'); return; }
  saveIcs(evs, `학회일정-${ymdOfDay(state.today)}.ics`, '학회 캘린더');
}

function exportEdition() {
  const c = state.confByKey.get(state.drawer.key);
  const ed = c.editions.find((x) => x.id === state.drawer.edId);
  const evs = state.events.filter((e) => e.conf === c && e.ed === ed);
  if (!evs.length) { toast('이 회차에는 아직 날짜가 정해진 일정이 없어요.'); return; }
  saveIcs(evs, `${c.title}-${ed.year}.ics`.replace(/\s+/g, '_'), `${c.title} ${ed.year}`);
}

/* ════════════════ 알림 (즐겨찾기 학회 3일 이내 마감) ════════════════ */
function notifyUpcoming() {
  if (!('Notification' in window) || !state.stars.size) return;
  const sent = new Set(store.get(NOTI_KEY, []));
  const now = Date.now();
  const due = state.events.filter((e) => state.stars.has(e.conf.key)
    && (e.type === 'deadline' || e.type === 'abstract')
    && e.at > now && e.at - now <= 3 * DAY && !sent.has(e.id));
  for (const e of due.slice(0, 3)) {
    const n = new Notification(`마감 임박 · ${e.conf.title} ${e.ed.year}`, {
      body: `${TYPES[e.type].name} ${fmtFull(e.at)} ${TZ_LABEL} (${remainText(e.at)})`,
    });
    n.onclick = () => openDetail(e.conf, e.ed, e.id);
    sent.add(e.id);
  }
  store.set(NOTI_KEY, [...sent].slice(-300));
}

/* ════════════════ 동작 ════════════════ */
function cleanErr(err) {
  return String((err && err.message) || err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
}

async function refresh(manual) {
  if (state.status === 'busy') return;
  state.status = 'busy';
  renderStatus();
  try {
    const data = await window.api.refreshData();
    state.status = 'ok';
    setData(data);
    if (manual) toast('최신 학회 데이터로 업데이트했어요');
  } catch (err) {
    state.status = 'error';
    renderStatus();
    if (manual) toast(`업데이트 실패: ${cleanErr(err)}`);
  }
}

function shiftMonth(delta) {
  state.cursor = new Date(state.cursor.getFullYear(), state.cursor.getMonth() + delta, 1);
  closePopover();
  hideTooltip();
  render();
  const weeks = state.view === 'month' && $('#monthView .weeks');
  if (weeks) {
    weeks.classList.remove('slide-next', 'slide-prev');
    void weeks.offsetWidth; // 애니메이션 다시 시작
    weeks.classList.add(delta > 0 ? 'slide-next' : 'slide-prev');
  }
}

// 월 보기에서 마우스 휠로 달 이동.
// 마우스 휠은 한 칸(약 100)마다 한 달, 트랙패드는 잘게 오는 값을 모아 한 번 쓸어내릴 때 한 달.
function bindWheelNav() {
  let acc = 0;
  let last = 0;
  let lockUntil = 0;
  let gestureLocked = false;
  $('#monthView').addEventListener('wheel', (e) => {
    if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    e.preventDefault();
    const now = performance.now();
    const dy = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaMode === 2 ? e.deltaY * 800 : e.deltaY;
    if (now - last > 250) { acc = 0; gestureLocked = false; }
    last = now;
    if (gestureLocked || now < lockUntil) return;
    acc += dy;
    if (Math.abs(acc) < 50) return;
    shiftMonth(acc > 0 ? 1 : -1);
    acc = 0;
    lockUntil = now + 220;
    if (Math.abs(dy) < 50) gestureLocked = true;
  }, { passive: false });
}
function goToday() {
  state.cursor = firstOfMonth(new Date());
  closePopover();
  render();
  if (state.view === 'list') $('#listView').scrollTop = 0;
}
function setView(v) {
  if (state.view === v) return;
  state.view = v;
  savePrefs();
  closePopover();
  render();
}
function jumpTo(ev) {
  const p = partsOfDay(ev.d0);
  if (p.y !== state.cursor.getFullYear() || p.m !== state.cursor.getMonth()) {
    state.cursor = new Date(p.y, p.m, 1);
    render();
  }
  const sel = `[data-ev="${CSS.escape(ev.id)}"]`;
  const target = document.querySelector(`#${state.view === 'month' ? 'monthView' : 'listView'} ${sel}`);
  if (target) {
    target.scrollIntoView({ block: 'nearest' });
    target.classList.remove('flash');
    void target.offsetWidth;
    target.classList.add('flash');
  }
}
function toggleStar(key) {
  if (state.stars.has(key)) state.stars.delete(key); else state.stars.add(key);
  store.set(STAR_KEY, [...state.stars]);
  render();
  renderDrawer();
  notifyUpcoming();
}

const THEMES = ['system', 'light', 'dark'];
const THEME_NAMES = { system: '시스템 설정 따라가기', light: '라이트', dark: '다크' };
function applyTheme() {
  const root = document.documentElement;
  if (state.theme === 'system') delete root.dataset.theme; else root.dataset.theme = state.theme;
  window.api.setTheme(state.theme).catch(() => {});
  const btn = $('#themeBtn');
  btn.innerHTML = ICON[state.theme === 'system' ? 'auto' : state.theme === 'light' ? 'sun' : 'moon'];
  btn.title = `테마: ${THEME_NAMES[state.theme]} (클릭해서 변경)`;
}

function bindUI() {
  $('#prevBtn').addEventListener('click', () => shiftMonth(-1));
  $('#nextBtn').addEventListener('click', () => shiftMonth(1));
  $('#todayBtn').addEventListener('click', goToday);
  $('#viewSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-view]');
    if (b) setView(b.dataset.view);
  });
  $('#exportBtn').addEventListener('click', exportVisible);
  $('#addBtn').addEventListener('click', () => {
    const y = state.cursor.getFullYear();
    const m = state.cursor.getMonth();
    const inCursor = partsOfDay(state.today).y === y && partsOfDay(state.today).m === m;
    openMineEditor(null, inCursor ? state.today : dayNum(y, m, 1));
  });
  $('#refreshBtn').addEventListener('click', () => refresh(true));
  $('#themeBtn').addEventListener('click', () => {
    state.theme = THEMES[(THEMES.indexOf(state.theme) + 1) % THEMES.length];
    savePrefs();
    applyTheme();
    toast(`테마: ${THEME_NAMES[state.theme]}`, { ms: 1500 });
  });
  const onSearch = debounce(() => { state.q = $('#searchInput').value; render(); }, 120);
  $('#searchInput').addEventListener('input', onSearch);

  $('#catFilters').addEventListener('change', (e) => {
    if ('extras' in e.target.dataset) {
      state.sysExtras = e.target.checked;
      savePrefs(); render();
      return;
    }
    const k = e.target.dataset.sub;
    if (!k) return;
    if (e.target.checked) state.subs.add(k); else state.subs.delete(k);
    savePrefs(); renderSidebar(); render();
  });
  $('#catFilters').addEventListener('click', (e) => {
    if (e.target.closest('[data-collapse]')) {
      state.etcOpen = !state.etcOpen;
      savePrefs(); renderSidebar();
      return;
    }
    const b = e.target.closest('button[data-group]');
    if (!b) return;
    const keys = Object.keys(CATS).filter((k) => CATS[k].group === b.dataset.group);
    const allOn = keys.every((k) => state.subs.has(k));
    for (const k of keys) { if (allOn) state.subs.delete(k); else state.subs.add(k); }
    savePrefs(); renderSidebar(); render();
  });
  $('#rankFilters').addEventListener('click', (e) => {
    const c = e.target.closest('button[data-crit]');
    if (c) { state.crit = c.dataset.crit; savePrefs(); renderSidebar(); render(); return; }
    const b = e.target.closest('button[data-tier]');
    if (!b) return;
    const sel = state.tiers[state.crit];
    const id = b.dataset.tier;
    if (!id) sel.clear();
    else if (sel.has(id)) sel.delete(id);
    else sel.add(id);
    savePrefs(); renderSidebar(); render();
  });
  $('#typeFilters').addEventListener('change', (e) => {
    const ts = (e.target.dataset.types || '').split(',').filter(Boolean);
    for (const t of ts) { if (e.target.checked) state.types.add(t); else state.types.delete(t); }
    savePrefs(); render();
  });
  $('#starOnly').addEventListener('change', (e) => {
    state.starredOnly = e.target.checked;
    savePrefs(); render();
  });
  $('#starList').addEventListener('click', (e) => {
    const b = e.target.closest('[data-conf]');
    if (!b) return;
    const c = state.confByKey.get(b.dataset.conf);
    if (c) openDetail(c);
  });

  $('#drawer').addEventListener('submit', (e) => {
    e.preventDefault();
    if (e.target.id === 'mineForm') submitMine(e.target);
    else if (e.target.id === 'googleForm') submitGoogle(e.target);
  });
  $('#drawer').addEventListener('input', (e) => {
    // 색을 고르면 머리 색도 바로 바뀌게
    if (e.target.name === 'color') $('#mineForm .d-head').style.setProperty('--c', e.target.value);
    // 종료일이 있으면 시간은 쓰지 않음
    if (e.target.name === 'endDate') $('#mineForm [name=time]').disabled = !!e.target.value;
  });
  $('#drawer').addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) { closeDrawer(); return; }
    const del = e.target.closest('[data-mine-delete]');
    if (del) { deleteMine(del); return; }
    const ed = e.target.closest('[data-ed]');
    if (ed) { state.drawer.edId = ed.dataset.ed; state.drawer.focusId = null; renderDrawer(); return; }
    if (e.target.closest('[data-star]')) { toggleStar(state.drawer.key); return; }
    const open = e.target.closest('[data-open]');
    if (open) { window.api.openLink(open.dataset.open); return; }
    if (e.target.closest('[data-ics-ed]')) exportEdition();
  });

  // 일정 클릭 → 상세 / 날짜 클릭 → 그날 일정
  document.addEventListener('click', (e) => {
    if (e.target.closest('#drawer')) return;
    const add = e.target.closest('[data-add-day]');
    if (add) { openMineEditor(null, Number(add.dataset.addDay)); return; }
    const evEl = e.target.closest('[data-ev]');
    if (evEl) {
      const ev = state.byId.get(evEl.dataset.ev);
      if (!ev) return;
      if (evEl.closest('.upcoming')) jumpTo(ev);
      if (ev.type === 'mine') openMineEditor(ev.mine);
      else openDetail(ev.conf, ev.ed, ev.id);
      return;
    }
    const more = e.target.closest('.more[data-day]');
    if (more) { openDayPopover(Number(more.dataset.day), more); return; }
    const cell = e.target.closest('.cell[data-day]');
    if (cell) { openDayPopover(Number(cell.dataset.day), cell); return; }
    if (!e.target.closest('#popover')) closePopover();
  });

  // 빈 날짜 두 번 클릭 → 그날 새 일정
  document.addEventListener('dblclick', (e) => {
    if (e.target.closest('[data-ev]')) return;
    const cell = e.target.closest('.cell[data-day]');
    if (cell) openMineEditor(null, Number(cell.dataset.day));
  });

  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest('.ev[data-ev]');
    if (!el || state.drawer) return;
    const ev = state.byId.get(el.dataset.ev);
    if (ev) showTooltip(ev, e.clientX, e.clientY);
  });
  document.addEventListener('mousemove', (e) => moveTooltip(e.clientX, e.clientY));
  document.addEventListener('mouseout', (e) => {
    const el = e.target.closest('.ev[data-ev]');
    if (el && !el.contains(e.relatedTarget)) hideTooltip();
  });

  document.addEventListener('keydown', (e) => {
    const typing = e.target.matches('input, textarea');
    if (e.key === 'Escape') {
      if (state.drawer) closeDrawer();
      else if (!$('#popover').hidden) closePopover();
      else if (typing) { e.target.value = ''; state.q = ''; e.target.blur(); render(); }
      return;
    }
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'ArrowLeft') shiftMonth(-1);
    else if (e.key === 'ArrowRight') shiftMonth(1);
    else if (e.key === 't' || e.key === 'T') goToday();
    else if (e.key === 'm' || e.key === 'M') setView('month');
    else if (e.key === 'l' || e.key === 'L') setView('list');
    else if (e.key === '/') { e.preventDefault(); $('#searchInput').focus(); }
  });

  window.addEventListener('resize', debounce(() => {
    closePopover();
    if (state.view === 'month') renderMonth();
  }, 60));

  bindWheelNav();
}

let tickCount = 0;
function tick() {
  const t = todayNum();
  if (t !== state.today) { state.today = t; render(); renderDrawer(); return; }
  updateClock();
  tickCount++;
  if (tickCount % 60 === 0) { renderStatus(); renderDrawer(); }
  if (tickCount % 1800 === 0) notifyUpcoming();
}

/* ════════════════ 구글 캘린더 연동 ════════════════ */
const GOOGLE_STEPS = [
  ['새 프로젝트 만들기', 'Google Cloud 콘솔에서 프로젝트를 하나 만들어요 (이름은 아무거나).', 'https://console.cloud.google.com/projectcreate'],
  ['Google Calendar API 사용', '열린 화면에서 "사용"을 눌러요.', 'https://console.cloud.google.com/apis/library/calendar-json.googleapis.com'],
  ['OAuth 동의 화면', '"시작하기" → 앱 이름·이메일 입력 → 대상은 "외부". 만든 뒤 "대상" 메뉴에서 "앱 게시"를 누르면 7일마다 다시 로그인하지 않아도 돼요.', 'https://console.cloud.google.com/auth/overview'],
  ['클라이언트 만들기', '"클라이언트 만들기" → 유형 "데스크톱 앱" → 만들어진 클라이언트 ID와 보안 비밀번호를 아래에 붙여 넣어요.', 'https://console.cloud.google.com/auth/clients'],
];
state.google = { configured: false, connected: false };

function renderGoogle() {
  const g = state.google;
  const box = $('#googleBox');
  if (!box) return;
  if (g.connecting) {
    box.innerHTML = `<div class="g-line"><span class="led busy"></span>브라우저에서 구글 로그인을 마쳐 주세요…</div>`;
    return;
  }
  if (!g.connected) {
    box.innerHTML = `<p class="g-hint">내 일정을 구글 캘린더와 양방향으로 맞춰요. 구글 일정은 앱에, 앱에서 바꾼 일정은 구글에 반영돼요.</p>
      <div class="g-btns">
        ${g.configured ? '<button class="btn primary small" data-g="connect">구글 계정 연결</button>' : ''}
        <button class="btn ghost small" data-g="setup">${g.configured ? '설정' : '연동 설정하기'}</button>
      </div>`;
    return;
  }
  const when = g.syncing ? '동기화 중…' : g.lastSync ? `${fmtRelative(g.lastSync)} 동기화` : '아직 동기화 전';
  box.innerHTML = `<div class="g-line"><span class="led ${g.needsReauth || g.lastError ? 'warn' : g.syncing ? 'busy' : 'ok'}"></span>
      <span class="g-acc" title="${esc(g.account)}">${esc(g.account || '구글 캘린더')}</span></div>
    <div class="g-sub">${when}</div>
    ${g.needsReauth ? '<div class="g-err">로그인이 만료됐어요. 다시 연결해 주세요.</div>'
      : g.lastError ? `<div class="g-err">${esc(g.lastError)}</div>` : ''}
    <div class="g-btns">
      ${g.needsReauth ? '<button class="btn primary small" data-g="connect">다시 연결</button>'
        : `<button class="btn ghost small" data-g="sync" ${g.syncing ? 'disabled' : ''}>지금 동기화</button>`}
      <button class="btn ghost small" data-g="disconnect">연결 해제</button>
    </div>`;
}

function openGoogleSetup() {
  const g = state.google;
  state.drawer = { mode: 'google' };
  $('#drawerPanel').innerHTML = `
    <form id="googleForm" class="mine-form" autocomplete="off">
      <div class="d-head" style="--c:#4285f4">
        <div class="d-cat"><span class="dot"></span>구글 캘린더 연동</div>
        <div class="d-titlerow"><h2>연동 설정</h2>
          <button type="button" class="icon-btn" data-close title="닫기 (Esc)">${ICON.close}</button></div>
        <p class="d-desc">구글 정책상 각자 무료 "OAuth 클라이언트"를 한 번 만들어야 해요. 5분 정도 걸리고, 한 번만 하면 돼요.</p>
      </div>
      <div class="d-body">
        <ol class="g-steps">
          ${GOOGLE_STEPS.map(([t, d, url]) => `<li><b>${t}</b><span>${d}</span>
            <button type="button" class="btn ghost small" data-open="${url}">${ICON.link}열기</button></li>`).join('')}
        </ol>
        <label class="field"><span>클라이언트 ID</span>
          <input name="clientId" required placeholder="1234…-abcd.apps.googleusercontent.com" value="${esc(g.clientId || '')}" spellcheck="false"></label>
        <label class="field"><span>클라이언트 보안 비밀번호 ${g.configured ? '<em>저장돼 있음 · 바꿀 때만 입력</em>' : ''}</span>
          <input name="clientSecret" type="password" ${g.configured ? '' : 'required'} placeholder="GOCSPX-…" spellcheck="false"></label>
        <p class="form-note">보안 비밀번호와 로그인 정보는 이 PC에만 암호화해서 저장해요. 처음 로그인할 때 "Google에서 확인하지 않은 앱" 화면이 나오면 "고급 → (앱 이름)(으)로 이동"을 누르세요. 직접 만든 클라이언트라서 나오는 안내예요.</p>
        <p class="form-error" hidden></p>
      </div>
      <div class="d-actions">
        <button type="submit" class="btn primary">저장하고 구글 계정 연결</button>
        <button type="button" class="btn ghost" data-close>취소</button>
      </div>
    </form>`;
  const d = $('#drawer');
  d.classList.add('open');
  d.setAttribute('aria-hidden', 'false');
  hideTooltip();
  closePopover();
}

async function submitGoogle(form) {
  const err = $('.form-error', form);
  const clientId = form.clientId.value.trim();
  const clientSecret = form.clientSecret.value.trim();
  const btn = $('button[type=submit]', form);
  err.hidden = true;
  try {
    btn.disabled = true;
    if (clientSecret || !state.google.configured || clientId !== state.google.clientId) {
      state.google = await window.api.google.configure(clientId, clientSecret);
    }
    closeDrawer();
    googleAction('connect');
  } catch (e) {
    err.textContent = cleanErr(e);
    err.hidden = false;
  } finally {
    btn.disabled = false;
  }
}

async function googleAction(kind, btn) {
  try {
    if (kind === 'setup') { openGoogleSetup(); return; }
    if (kind === 'disconnect') {
      if (!btn.dataset.armed) {
        btn.dataset.armed = '1';
        btn.textContent = '한 번 더 누르면 해제';
        setTimeout(() => { if (btn.isConnected) { delete btn.dataset.armed; btn.textContent = '연결 해제'; } }, 3000);
        return;
      }
      state.google = await window.api.google.disconnect();
      toast('구글 캘린더 연결을 해제했어요. 구글에서 가져온 일정은 앱에서 빠졌어요.');
    } else if (kind === 'connect') {
      toast('브라우저에서 구글 계정으로 로그인하고 권한을 허용해 주세요.', { ms: 8000 });
      state.google = await window.api.google.connect();
      if (state.google.connected && !state.google.lastError) toast(`구글 캘린더(${state.google.account})와 연결했어요.`);
    } else if (kind === 'sync') {
      state.google = await window.api.google.sync();
    }
  } catch (e) {
    toast(`구글 캘린더: ${cleanErr(e)}`, { ms: 8000 });
    state.google = await window.api.google.status().catch(() => state.google);
  }
  renderGoogle();
}

function bindGoogle() {
  window.api.google.status().then((s) => { state.google = s; renderGoogle(); }).catch(() => {});
  window.api.google.onStatus((s) => { state.google = s; renderGoogle(); });
  $('#googleBox').addEventListener('click', (e) => {
    const b = e.target.closest('[data-g]');
    if (b) googleAction(b.dataset.g, b);
  });
  setInterval(renderGoogle, 60000); // "n분 전" 갱신
}

/* ════════════════ 피드백 (GitHub Issues) ════════════════ */
const REPO_URL = 'https://github.com/ha-seungwon/conf-calendar';
function openFeedback() {
  state.drawer = { mode: 'feedback' };
  const ver = state.appVersion ? `v${state.appVersion}` : '';
  const newUrl = `${REPO_URL}/issues/new?template=feedback.yml&labels=feedback${ver ? `&version=${encodeURIComponent(ver)}` : ''}`;
  $('#drawerPanel').innerHTML = `
    <div class="d-head" style="--c:#6d5dfc">
      <div class="d-cat"><span class="dot"></span>피드백</div>
      <div class="d-titlerow"><h2>의견 보내기</h2>
        <button type="button" class="icon-btn" data-close title="닫기 (Esc)">${ICON.close}</button></div>
      <p class="d-desc">버그, 원하는 기능, 틀린 학회 날짜 등 무엇이든 알려 주세요.</p>
    </div>
    <div class="d-body">
      <div class="fb-card">
        <b>✍️ 피드백 남기기</b>
        <span>브라우저에서 짧은 양식이 열려요. GitHub 계정으로 로그인하면 바로 올라가요.</span>
        <button class="btn primary" data-open="${esc(newUrl)}">${ICON.link}피드백 작성하기</button>
      </div>
      <div class="fb-card">
        <b>💬 모든 피드백 보기</b>
        <span>다른 사용자들이 남긴 피드백과 답변이 실시간으로 쌓여요. 공감(👍)이나 댓글도 남길 수 있어요.</span>
        <button class="btn ghost" data-open="${REPO_URL}/issues?q=label%3Afeedback">${ICON.link}피드백 게시판 열기</button>
      </div>
      <p class="form-note">피드백은 GitHub에 공개로 올라가요. 개인 정보는 적지 마세요. ${ver ? `지금 버전: ${ver}` : ''}</p>
    </div>`;
  const d = $('#drawer');
  d.classList.add('open');
  d.setAttribute('aria-hidden', 'false');
  hideTooltip();
  closePopover();
}

/* ════════════════ 자동 업데이트 표시 ════════════════ */
function bindUpdates() {
  const box = $('#updateBox');
  let announced = false;
  const show = (s) => {
    if (!s) return;
    if (s.current) { state.appVersion = s.current; $('#appVersion').textContent = `v${s.current}`; }
    if (s.status === 'downloading') {
      box.hidden = false;
      box.innerHTML = `<span>새 버전 v${esc(s.version || '')} 받는 중… ${Number(s.percent) || 0}%</span>`;
    } else if (s.status === 'manual') {
      // 맥: 직접 받아서 설치
      box.hidden = false;
      box.innerHTML = `<span>새 버전 <b>v${esc(s.version || '')}</b>이 나왔어요</span>
        <button class="btn primary small" data-install>다운로드 페이지 열기</button>`;
    } else if (s.status === 'ready') {
      box.hidden = false;
      box.innerHTML = `<span><b>v${esc(s.version || '')}</b> 업데이트 준비 완료</span>
        <button class="btn primary small" data-install>지금 재시작해서 업데이트</button>`;
      if (!announced) {
        announced = true;
        toast(`새 버전 v${s.version}이 준비됐어요. 앱을 닫으면 자동으로 설치돼요.`, {
          action: '지금 재시작', onAction: () => window.api.installUpdate(), ms: 9000,
        });
      }
    } else {
      box.hidden = true;
    }
  };
  window.api.updateState().then(show).catch(() => {});
  window.api.onUpdate(show);
  const btn = $('#checkUpdateBtn');
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    const label = btn.innerHTML;
    btn.textContent = '확인 중…';
    try {
      const r = await window.api.checkUpdate();
      if (r.status === 'dev') toast('개발 모드(npm start)에서는 업데이트를 확인하지 않아요.');
      else if (r.status === 'latest') toast(`최신 버전이에요 (v${r.current})`);
      else if (r.status === 'downloading') toast(`새 버전 v${r.version}을 받는 중이에요. 다 받으면 알려 드릴게요.`);
      else if (r.status === 'ready' || r.status === 'manual') show(r);
      else if (r.status === 'error') toast(`업데이트 확인 실패: ${r.message || '네트워크를 확인해 주세요'}`);
    } catch (e) {
      toast(`업데이트 확인 실패: ${cleanErr(e)}`);
    } finally {
      btn.disabled = false;
      btn.innerHTML = label;
    }
  });
  box.addEventListener('click', (e) => { if (e.target.closest('[data-install]')) window.api.installUpdate(); });
}

async function init() {
  if (window.api.platform === 'darwin') document.documentElement.classList.add('mac');
  applyTheme();
  bindUI();
  bindUpdates();
  bindGoogle();
  $('#feedbackBtn').addEventListener('click', openFeedback);
  try { state.myEvents = await window.api.loadMine(); } catch { state.myEvents = []; }
  window.api.onMineChanged((list) => setMine(list)); // 구글에서 바뀐 일정
  try {
    setData(await window.api.loadData());
  } catch (err) {
    $('#monthView').innerHTML = `<div class="list-empty"><b>데이터를 읽지 못했어요</b>${esc(cleanErr(err))}</div>`;
  }
  if (!state.fetchedAt || Date.now() - state.fetchedAt > 6 * 3600000) refresh(false);
  setInterval(tick, 1000);
  setInterval(() => refresh(false), 6 * 3600000);
}

init();
