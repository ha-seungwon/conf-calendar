'use strict';
// 구글 동기화 로직 점검 (가짜 구글 API 사용): node test/gsync.test.js
const assert = require('assert');
const { syncOnce, mergeLocalEdit, toGoogle, fromGoogle, GoogleCalendar, authUrl, pkcePair } = require('../src/gsync');

const TZ = 'Asia/Seoul';
const NOW = new Date(2026, 10, 26, 12, 0).getTime();

class FakeGoogle {
  constructor() { this.events = new Map(); this.seq = 0; this.calls = []; }
  put(g) { const e = { status: 'confirmed', ...g, etag: `"${++this.seq}"` }; this.events.set(e.id, e); return e; }
  async list() { this.calls.push('list'); return { items: [...this.events.values()], calendar: 'me@example.com' }; }
  async insert(body) { this.calls.push('insert'); return this.put({ id: `ev${this.seq + 1}`, ...body }); }
  async patch(id, body) {
    this.calls.push(`patch:${id}`);
    if (!this.events.has(id)) { const err = new Error('nf'); err.status = 404; throw err; }
    return this.put({ ...this.events.get(id), ...body, id });
  }
  async remove(id) { this.calls.push(`remove:${id}`); this.events.delete(id); return null; }
}

(async () => {
  // 변환
  const timed = toGoogle({ title: 'A', memo: 'm', date: '2026-12-01', time: '14:30', gDur: 90 }, TZ);
  assert.deepStrictEqual(timed.start, { dateTime: '2026-12-01T14:30:00', timeZone: TZ, date: null });
  assert.deepStrictEqual(timed.end, { dateTime: '2026-12-01T16:00:00', timeZone: TZ, date: null });
  const allday = toGoogle({ title: 'B', date: '2026-12-01', endDate: '2026-12-03', time: '' }, TZ);
  assert.strictEqual(allday.start.date, '2026-12-01');
  assert.strictEqual(allday.end.date, '2026-12-04'); // 구글은 끝 날짜가 배타적
  assert.deepStrictEqual(fromGoogle({ id: 'x', summary: 'C', start: { date: '2026-12-01' }, end: { date: '2026-12-04' } }).endDate, '2026-12-03');
  assert.deepStrictEqual(fromGoogle({ id: 'x', summary: 'C', start: { date: '2026-12-01' }, end: { date: '2026-12-02' } }).endDate, '');
  const ft = fromGoogle({ id: 'y', start: { dateTime: '2026-12-01T05:30:00Z' }, end: { dateTime: '2026-12-01T06:30:00Z' } });
  assert.strictEqual(ft.title, '(제목 없음)');
  assert.strictEqual(ft.gDur, 60);

  // 1) 앱에서 만든 일정 → 구글에 생성
  const g = new FakeGoogle();
  let local = mergeLocalEdit([], [{ id: 'a', title: '내부 리뷰', date: '2026-12-01', time: '14:00', color: '#6d5dfc', memo: '' }]);
  assert.strictEqual(local[0].dirty, true);
  let r = await syncOnce({ local, api: g, timeZone: TZ, now: NOW });
  assert.strictEqual(g.events.size, 1);
  assert.strictEqual(r.events[0].gid, 'ev1');
  assert.strictEqual(r.events[0].dirty, false);
  assert.strictEqual(r.calendar, 'me@example.com');

  // 2) 구글에서 만든 일정 → 앱으로 가져옴
  g.put({ id: 'gx', summary: '구글 미팅', start: { dateTime: '2026-12-02T01:00:00Z' }, end: { dateTime: '2026-12-02T02:00:00Z' } });
  r = await syncOnce({ local: r.events, api: g, timeZone: TZ, now: NOW });
  const imported = r.events.find((e) => e.gid === 'gx');
  assert.ok(imported, '구글 일정이 앱으로 들어와야 함');
  assert.strictEqual(imported.source, 'google');
  assert.strictEqual(r.stats.downloaded, 1);

  // 3) 다시 동기화해도 변화 없음 (중복 생성 X)
  const before = g.calls.length;
  r = await syncOnce({ local: r.events, api: g, timeZone: TZ, now: NOW });
  assert.deepStrictEqual(g.calls.slice(before), ['list']);
  assert.strictEqual(r.events.length, 2);

  // 4) 앱에서 수정 → 구글 patch, 색은 앱에만
  let next = r.events.map((e) => (e.gid === 'gx' ? { ...e, title: '구글 미팅 (장소 변경)', color: '#e5484d' } : e));
  local = mergeLocalEdit(r.events, next);
  r = await syncOnce({ local, api: g, timeZone: TZ, now: NOW });
  assert.strictEqual(g.events.get('gx').summary, '구글 미팅 (장소 변경)');
  assert.strictEqual(r.events.find((e) => e.gid === 'gx').color, '#e5484d');

  // 5) 구글에서 수정 → 앱에 반영
  g.put({ ...g.events.get('ev1'), summary: '내부 리뷰 (구글에서 바꿈)' });
  r = await syncOnce({ local: r.events, api: g, timeZone: TZ, now: NOW });
  assert.strictEqual(r.events.find((e) => e.gid === 'ev1').title, '내부 리뷰 (구글에서 바꿈)');
  assert.strictEqual(r.events.find((e) => e.gid === 'ev1').color, '#6d5dfc');

  // 6) 앱에서 삭제 → 구글에서도 삭제
  next = r.events.filter((e) => e.gid !== 'ev1');
  local = mergeLocalEdit(r.events, next);
  assert.ok(local.find((e) => e.gid === 'ev1' && e.deleted), '지운 일정은 tombstone 으로 남음');
  r = await syncOnce({ local, api: g, timeZone: TZ, now: NOW });
  assert.ok(!g.events.has('ev1'));
  assert.ok(!r.events.find((e) => e.gid === 'ev1'));

  // 7) 구글에서 삭제 → 앱에서도 삭제
  g.events.delete('gx');
  r = await syncOnce({ local: r.events, api: g, timeZone: TZ, now: NOW });
  assert.strictEqual(r.events.length, 0);
  assert.strictEqual(r.stats.deletedLocal, 1);

  // 8) 동기화 범위 밖 옛 일정은 지우지 않음
  local = [{ id: 'old', title: '옛날', date: '2020-01-01', time: '', gid: 'gone', gEtag: '"1"', dirty: false }];
  r = await syncOnce({ local, api: g, timeZone: TZ, now: NOW });
  assert.strictEqual(r.events.length, 1);

  // 9) 구글에서 이미 지운 일정을 앱에서 수정 → 새로 만듦
  local = [{ id: 'z', title: 'Z', date: '2026-12-10', time: '', gid: 'missing', dirty: true }];
  r = await syncOnce({ local, api: g, timeZone: TZ, now: NOW });
  assert.ok(r.events[0].gid && r.events[0].gid !== 'missing');

  // 10) 토큰 갱신 + 401 재시도
  let tokenCalls = 0;
  let apiCalls = 0;
  const fakeFetch = async (url) => {
    if (url.includes('oauth2.googleapis.com/token')) {
      tokenCalls++;
      return { ok: true, status: 200, json: async () => ({ access_token: `t${tokenCalls}`, expires_in: 3600 }) };
    }
    apiCalls++;
    if (apiCalls === 1) return { ok: false, status: 401, text: async () => '{}' };
    return { ok: true, status: 200, text: async () => JSON.stringify({ items: [], summary: 'me' }) };
  };
  const cal = new GoogleCalendar({ clientId: 'c', clientSecret: 's', refreshToken: 'r', fetch: fakeFetch });
  const out = await cal.list('a', 'b');
  assert.strictEqual(out.calendar, 'me');
  assert.strictEqual(tokenCalls, 2);

  // 11) 로그인 URL
  const { challenge } = pkcePair();
  const u = new URL(authUrl({ clientId: 'id.apps.googleusercontent.com', redirectUri: 'http://127.0.0.1:5555', challenge, state: 'st' }));
  assert.strictEqual(u.searchParams.get('code_challenge_method'), 'S256');
  assert.strictEqual(u.searchParams.get('access_type'), 'offline');
  assert.ok(u.searchParams.get('scope').includes('calendar.events'));

  // 12) 올린 뒤 내려받기에서 실패해도, 올라간 일정의 구글 ID는 남는다
  const flaky = new FakeGoogle();
  flaky.list = async () => { const err = new Error('network'); err.status = 503; throw err; };
  local = mergeLocalEdit([], [{ id: 'p', title: 'P', date: '2026-12-05', time: '' }]);
  await assert.rejects(syncOnce({ local, api: flaky, timeZone: TZ, now: NOW }), (err) => {
    assert.strictEqual(err.partial[0].gid, 'ev1');
    assert.strictEqual(err.partial[0].dirty, false);
    return true;
  });

  console.log('구글 동기화 테스트 모두 통과');
})().catch((e) => { console.error(e); process.exit(1); });
