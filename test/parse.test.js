'use strict';
// 데이터 파서 점검: node test/parse.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { normalize, parseDateRange, toUtcMs } = require('../src/data');

const cases = [
  ['July 7-9, 2027', '2027-07-07', '2027-07-09'],
  ['February 27-March 2, 2025', '2025-02-27', '2025-03-02'],
  ['April 25-May 01, 2027', '2027-04-25', '2027-05-01'],
  ['April 13 - 17, 2026', '2026-04-13', '2026-04-17'],
  ['April 20- April 22, 2026', '2026-04-20', '2026-04-22'],
  ['April 8, 2026', '2026-04-08', '2026-04-08'],
  ['FEBRUARY 24-26, 2026', '2026-02-24', '2026-02-26'],
  ['Dec 30, 2026 - Jan 2, 2027', '2026-12-30', '2027-01-02'],
  ['Dec 30 - Jan 2, 2027', '2026-12-30', '2027-01-02'],
  ['14-16 July 2026', '2026-07-14', '2026-07-16'],
  ['Sept. 3rd-5th, 2026', '2026-09-03', '2026-09-05'],
];
for (const [text, s, e] of cases) {
  assert.deepStrictEqual(parseDateRange(text), { start: s, end: e }, text);
}
assert.strictEqual(parseDateRange('TBD'), null);
assert.strictEqual(parseDateRange('Dec, 2025'), null);

// AoE 23:59:59 = 다음날 11:59:59 UTC
assert.strictEqual(new Date(toUtcMs('2026-07-28 23:59:59', 'AoE')).toISOString(), '2026-07-29T11:59:59.000Z');
assert.strictEqual(new Date(toUtcMs('2026-12-08 22:59:59', 'UTC')).toISOString(), '2026-12-08T22:59:59.000Z');
assert.strictEqual(new Date(toUtcMs('2026-12-08 10:00:00', 'UTC+8')).toISOString(), '2026-12-08T02:00:00.000Z');
// PT: 겨울 PST(UTC-8), 여름 PDT(UTC-7)
assert.strictEqual(new Date(toUtcMs('2026-01-15 12:00:00', 'PT')).toISOString(), '2026-01-15T20:00:00.000Z');
assert.strictEqual(new Date(toUtcMs('2026-07-15 12:00:00', 'PT')).toISOString(), '2026-07-15T19:00:00.000Z');
assert.strictEqual(toUtcMs('TBD', 'AoE'), null);

const file = process.argv[2] || path.join(__dirname, '..', 'data', 'allconf.snapshot.yml');
const confs = normalize(fs.readFileSync(file, 'utf8'));
let editions = 0, withRange = 0, deadlines = 0;
const unparsed = new Map();
for (const c of confs) {
  for (const e of c.editions) {
    editions++;
    if (e.start) withRange++;
    else if (e.dateText) unparsed.set(e.dateText, (unparsed.get(e.dateText) || 0) + 1);
    for (const t of e.timeline) if (t.deadline != null) deadlines++;
  }
}
console.log(`학회 ${confs.length}개, 회차 ${editions}개, 개최일 파싱 ${withRange}개, 마감 ${deadlines}개`);
console.log('개최일 파싱 실패:', [...unparsed.entries()].sort((a, b) => b[1] - a[1]));
const osdi = confs.find((c) => c.title === 'OSDI');
console.log('OSDI 2027:', JSON.stringify(osdi.editions.find((e) => e.year === 2027)));
console.log('모든 테스트 통과');
