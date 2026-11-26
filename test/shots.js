'use strict';
// 개발용: CONFCAL_SHOT=<폴더> 로 실행하면 주요 화면을 PNG로 찍고 종료한다.
//   PowerShell:  $env:CONFCAL_SHOT="shots"; npx electron .
// 실제 사용자 설정과 섞이지 않게 <폴더>/userdata 를 따로 쓴다(main.js 참고).
const { app } = require('electron');
const fs = require('fs/promises');
const path = require('path');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = function run(win, dir) {
  takeShots(win, dir).catch(async (err) => {
    await fs.writeFile(path.join(dir, 'report.json'), JSON.stringify({ errors: [`harness: ${err.message}`] })).catch(() => {});
    app.quit();
  });
};

async function takeShots(win, dir) {
  await fs.mkdir(dir, { recursive: true });
  const js = (code) => win.webContents.executeJavaScript(code, true)
    .catch(() => { throw new Error(`failed step: ${code.replace(/\s+/g, ' ').slice(0, 120)}`); });
  const shot = async (name) => {
    await wait(700);
    const img = await win.webContents.capturePage();
    await fs.writeFile(path.join(dir, `${name}.png`), img.toPNG());
  };
  const errors = [];
  win.webContents.on('console-message', (e) => {
    const level = e.level ?? e.params?.level;
    if (level === 'error' || level === 3) errors.push(e.message ?? e.params?.message);
  });
  const report = {};

  await wait(3500);
  await shot('1-month');
  report.grading = await js(`(() => {
    const per = {};
    for (const c of state.conferences) if (confMatches(c)) per[c.cat] = (per[c.cat] || 0) + 1;
    const pick = (t) => { const c = state.conferences.find((x) => x.title === t); return c && [c.cat, c.grade.bk, c.grade.kiise, c.journal || '-', confMatches(c)]; };
    return { visible: state.visibleConfCount, per, OSDI: pick('OSDI'), ICLR: pick('ICLR'), VLDB: pick('VLDB'), PLDI: pick('PLDI'), MLSys: pick('MLSys'), CVPR: pick('CVPR'), FAST: pick('FAST') };
  })()`);
  report.update = await js(`window.api.checkUpdate()`);
  report.criteria = await js(`(() => {
    const out = {};
    for (const k of CRIT_KEYS) {
      document.querySelector('[data-crit="' + k + '"]').click();
      out[k] = { visible: state.visibleConfCount, chips: [...document.querySelectorAll('#rankFilters [data-tier]')].map((b) => b.textContent.trim()).join(' | '), badge: (document.querySelector('.lanes .ev') ? '' : '') };
    }
    document.querySelector('[data-crit="bk"]').click();
    return out;
  })()`);
  await shot('11-crit-bk');
  report.critBadge = await js(`document.querySelector('.upcoming [data-ev]') && rankBadges(state.byId.get(document.querySelector('.upcoming [data-ev]:not([data-ev^="mine|"])').dataset.ev).conf)`);
  await js(`document.querySelector('[data-crit="kiise"]').click()`);
  report.extras = await js(`state.conferences.filter((c) => SYS_EXTRAS.includes(c.title)).map((c) => [c.title, confMatches(c)])`);
  report.extrasOff = await js(`(() => { state.sysExtras = false; const r = state.conferences.filter((c) => SYS_EXTRAS.includes(c.title)).map((c) => [c.title, confMatches(c)]); state.sysExtras = true; return r; })()`);
  report.wheel = await js(`(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const wheel = (el, dy) => el.dispatchEvent(new WheelEvent('wheel', { deltaY: dy, bubbles: true, cancelable: true }));
    const mv = document.querySelector('#monthView');
    const p = () => document.querySelector('#period').textContent;
    const out = ['start: ' + p()];
    wheel(mv, 100); out.push('mouse down 1 notch: ' + p());
    wheel(mv, 100); out.push('2nd notch within 220ms (ignored): ' + p());
    await sleep(300); wheel(mv, 100); out.push('notch after 300ms: ' + p());
    await sleep(300); wheel(mv, -100); out.push('mouse up 1 notch: ' + p());
    await sleep(300); for (let i = 0; i < 40; i++) { wheel(mv, 6); await sleep(16); } out.push('one trackpad swipe (40 small events): ' + p());
    await sleep(300);
    document.querySelector('[data-view="list"]').click();
    const lv = document.querySelector('#listView'); const before = p(); wheel(lv, 100);
    out.push('list view period unchanged: ' + (before === p()));
    document.querySelector('[data-view="month"]').click();
    document.querySelector('#todayBtn').click();
    return out;
  })()`);
  // 내 일정: 추가 → 화면 확인 → 수정 → 삭제 → 되돌리기
  await js(`document.querySelector('#addBtn').click()`);
  await wait(300);
  await js(`(() => {
    const f = document.querySelector('#mineForm');
    f.title.value = 'OSDI 내부 리뷰';
    f.time.value = '14:00';
    f.memo.value = '연구실 회의실';
    f.querySelector('input[name=color][value="#6d5dfc"]').checked = true;
    f.querySelector('input[name=color][value="#6d5dfc"]').dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await shot('7-mine-editor');
  await js(`document.querySelector('#mineForm').requestSubmit()`);
  await wait(500);
  report.mineAdded = await js(`({ saved: state.myEvents.map((m) => [m.title, m.date, m.time, m.color]),
    chip: !!document.querySelector('.lanes .ev.mine'), inUpcoming: !!document.querySelector('.upcoming [data-ev^="mine|"]') })`);
  // 여러 날 일정도 추가
  await js(`(() => { openMineEditor(null, state.today + 3); const f = document.querySelector('#mineForm'); f.title.value = '학회 출장'; f.endDate.value = ymdOfDay(state.today + 6); f.requestSubmit(); })()`);
  await wait(600);
  await shot('8-mine-month');
  await js(`document.querySelector('.lanes .ev.mine').click()`);
  await wait(300);
  await js(`(() => { const f = document.querySelector('#mineForm'); f.title.value = f.title.value + ' (수정)'; f.requestSubmit(); })()`);
  await wait(500);
  report.mineEdited = await js(`state.myEvents.map((m) => m.title)`);
  await js(`document.querySelector('.lanes .ev.mine').click()`);
  await wait(300);
  await js(`document.querySelector('[data-mine-delete]').click(); document.querySelector('[data-mine-delete]').click();`);
  await wait(500);
  report.mineAfterDelete = await js(`state.myEvents.map((m) => m.title)`);
  report.google = await js(`window.api.google.status()`);
  await js(`document.querySelector('[data-g="setup"]').click()`);
  await shot('9-google-setup');
  report.googleBadId = await js(`(async () => { try { await window.api.google.configure('bad', 'x'); return 'accepted?'; } catch (e) { return cleanErr(e); } })()`);
  await js(`closeDrawer(); document.querySelector('#feedbackBtn').click()`);
  await shot('10-feedback');
  report.feedbackUrl = await js(`document.querySelector('.fb-card [data-open]').dataset.open`);
  await js(`closeDrawer()`);
  report.mineIcs = await js(`buildIcs(state.mine, 't').split('BEGIN:VEVENT').slice(1).join('BEGIN:VEVENT')`);
  report.mineFile = await fs.readFile(path.join(dir, 'userdata', 'my-events.json'), 'utf8').catch((e) => String(e));
  report.upcomingExtras = await js(`state.visible.filter((e) => e.conf && SYS_EXTRAS.includes(e.conf.title) && e.type !== 'conf' && e.at > Date.now()).map((e) => e.conf.title + ' ' + e.ed.year + ' ' + e.type + ' ' + fmtFull(e.at))`);

  // 즐겨찾기 + 상세
  await js(`document.querySelector('.upcoming [data-ev]:not([data-ev^="mine|"])').click()`);
  await wait(300);
  await js(`document.querySelector('[data-star]').click()`);
  await shot('2-drawer');
  await js(`document.querySelector('[data-close]').click()`);

  // 날짜 팝오버 + 툴팁
  await js(`(() => {
    const ev = state.visible.find((e) => e.type === 'deadline' && e.at > Date.now());
    const cell = document.querySelector('.cell[data-day="' + ev.d0 + '"]');
    cell.click();
    const chip = document.querySelector('.lanes .ev:not(.past)');
    const r = chip.getBoundingClientRect();
    showTooltip(state.byId.get(chip.dataset.ev), r.right + 10, r.bottom + 4);
  })()`);
  await shot('3-popover');
  await js(`hideTooltip(); closePopover();`);

  // 검색: 분야/등급 필터 밖에 있는 MLSys
  await js(`(() => { const i = document.querySelector('#searchInput'); i.value = 'MLSys'; i.dispatchEvent(new Event('input')); })()`);
  await wait(400);
  await js(`document.querySelector('[data-view="list"]').click()`);
  await shot('4-search-list');
  report.search = await js(`({ confs: state.visibleConfCount, events: state.visible.length })`);
  await js(`(() => { const i = document.querySelector('#searchInput'); i.value = ''; i.dispatchEvent(new Event('input')); })()`);
  await wait(300);

  // 기타 분야 펼치기 + 다크 테마 + 월 보기
  await js(`document.querySelector('[data-view="month"]').click(); document.querySelector('#catFilters [data-collapse]').click();`);
  await js(`document.querySelector('#themeBtn').click(); document.querySelector('#themeBtn').click();`);
  await shot('5-dark');
  await js(`document.querySelector('#themeBtn').click()`);

  // 좁은 창
  win.setSize(1080, 700);
  await wait(500);
  await shot('6-narrow');

  // .ics 내용
  report.ics = await js(`buildIcs(state.visible.filter((e) => e.at > Date.now()).slice(0, 4), '테스트')`);
  report.stars = await js(`[...state.stars]`);
  await fs.writeFile(path.join(dir, 'report.json'), JSON.stringify({ errors, ...report }, null, 2));
  app.quit();
};
