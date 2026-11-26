'use strict';
// 내 일정 저장소 + 구글 캘린더 연동 (메인 프로세스 전용)
//  - 내 일정: userData/my-events.json (구글 동기화용 내부 필드 포함, 앱 업데이트해도 유지)
//  - 구글 연동 정보: userData/google.json (클라이언트 보안 비밀·토큰은 Windows 암호화(safeStorage)로 저장)
const { app, ipcMain, shell, net, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const http = require('http');
const crypto = require('crypto');
const {
  pkcePair, authUrl, exchangeCode, revoke, GoogleCalendar, mergeLocalEdit, syncOnce,
} = require('./gsync');

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const myEventsFile = () => path.join(app.getPath('userData'), 'my-events.json');
const googleFile = () => path.join(app.getPath('userData'), 'google.json');
const fetchFn = (url, opts) => net.fetch(url, opts);

let getWin = () => null;
const send = (ch, payload) => { const w = getWin(); if (w && !w.isDestroyed()) w.webContents.send(ch, payload); };

/* ───── 정리 함수 ───── */
const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');

// 앱 화면에서 넘어온 값: 사용자가 고칠 수 있는 필드만 받는다
function cleanInput(m) {
  if (!m || typeof m !== 'object') return null;
  const out = {
    id: str(m.id, 64),
    title: str(m.title, 200).trim(),
    date: str(m.date, 10),
    endDate: YMD.test(m.endDate || '') ? m.endDate : '',
    time: /^\d{2}:\d{2}$/.test(m.time || '') ? m.time : '',
    color: /^#[0-9a-f]{6}$/i.test(m.color || '') ? m.color : '#ff6b3d',
    memo: str(m.memo, 5000),
    updatedAt: Number(m.updatedAt) || Date.now(),
  };
  if (!out.id || !out.title || !YMD.test(out.date)) return null;
  if (out.endDate && out.endDate <= out.date) out.endDate = '';
  if (out.endDate) out.time = '';
  return out;
}

// 파일에 저장되는 값: 동기화용 내부 필드까지
function cleanStored(m) {
  const base = cleanInput(m);
  if (!base) return null;
  return {
    ...base,
    gid: str(m.gid, 1024), gEtag: str(m.gEtag, 200), gDur: Math.max(0, Number(m.gDur) || 0),
    recurring: !!m.recurring, source: m.source === 'google' ? 'google' : 'local',
    dirty: !!m.dirty, deleted: !!m.deleted,
  };
}

// 화면으로 보내는 값
const toView = (list) => list.filter((e) => !e.deleted).map((e) => ({
  id: e.id, title: e.title, date: e.date, endDate: e.endDate, time: e.time, color: e.color, memo: e.memo,
  updatedAt: e.updatedAt, source: e.source, recurring: e.recurring, synced: !!e.gid,
}));

/* ───── 파일 (동시에 쓰지 않도록 순서대로) ───── */
let lock = Promise.resolve();
function withLock(fn) {
  const p = lock.then(fn, fn);
  lock = p.catch(() => {});
  return p;
}
async function writeJson(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tmp, file); // 저장 중 꺼져도 기존 파일이 깨지지 않게
}
async function readStored() {
  try {
    const j = JSON.parse(await fs.readFile(myEventsFile(), 'utf8'));
    return (Array.isArray(j.events) ? j.events : []).map(cleanStored).filter(Boolean);
  } catch {
    return [];
  }
}
const writeStored = (list) => writeJson(myEventsFile(), { version: 2, events: list });

/* ───── 구글 연동 정보 ───── */
const enc = (s) => (safeStorage.isEncryptionAvailable()
  ? safeStorage.encryptString(s).toString('base64')
  : `plain:${Buffer.from(s).toString('base64')}`);
function dec(b) {
  if (!b) return '';
  if (b.startsWith('plain:')) return Buffer.from(b.slice(6), 'base64').toString();
  return safeStorage.decryptString(Buffer.from(b, 'base64'));
}
async function gLoad() {
  try { return JSON.parse(await fs.readFile(googleFile(), 'utf8')); } catch { return {}; }
}
const gSave = (s) => writeJson(googleFile(), s);

let syncing = false;
let connecting = false;
async function status() {
  const s = await gLoad();
  return {
    configured: !!(s.clientId && s.secretEnc), connected: !!s.refreshEnc, account: s.account || '',
    lastSync: s.lastSync || null, lastError: s.lastError || '', needsReauth: !!s.needsReauth,
    syncing, connecting, clientId: s.clientId || '',
  };
}
const pushStatus = () => status().then((st) => send('google:status', st)).catch(() => {});

/* ───── 동기화 ───── */
async function runSync() {
  if (syncing) return status();
  const s = await gLoad();
  if (!s.refreshEnc || !s.clientId) return status();
  syncing = true;
  pushStatus();
  try {
    const api = new GoogleCalendar({
      clientId: s.clientId, clientSecret: dec(s.secretEnc), refreshToken: dec(s.refreshEnc), fetch: fetchFn,
    });
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    await withLock(async () => {
      const local = await readStored();
      let result;
      try {
        result = await syncOnce({ local, api, timeZone });
      } catch (err) {
        // 일부만 올라간 경우에도 구글 ID는 저장해 둬야 다음에 중복으로 만들지 않는다
        if (err.partial) await writeStored(err.partial.map(cleanStored).filter(Boolean));
        throw err;
      }
      const list = result.events.map(cleanStored).filter(Boolean);
      await writeStored(list);
      send('mine:changed', toView(list));
      if (result.calendar) s.account = result.calendar;
    });
    Object.assign(s, { lastSync: Date.now(), lastError: '', needsReauth: false });
  } catch (err) {
    s.lastError = String((err && err.message) || err).slice(0, 200);
    if (err && err.reauth) s.needsReauth = true;
  } finally {
    syncing = false;
    await gSave(s);
    pushStatus();
  }
  return status();
}

let syncTimer = null;
function scheduleSync(ms = 1500) {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => { runSync(); }, ms);
}

/* ───── 구글 로그인 (브라우저 → 127.0.0.1 루프백) ───── */
const donePage = (title, msg) => `<!doctype html><meta charset="utf-8"><title>${title}</title>
<body style="font-family:'Malgun Gothic',system-ui;display:grid;place-items:center;height:100vh;margin:0;background:#f4f5fa;color:#1a1d29">
<div style="text-align:center"><div style="font-size:44px">📅</div><h2 style="margin:8px 0">${title}</h2><p style="color:#6b7080">${msg}</p></div>`;

async function authorize(s) {
  const { verifier, challenge } = pkcePair();
  const state = crypto.randomBytes(16).toString('hex');
  const server = http.createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const redirectUri = `http://127.0.0.1:${server.address().port}`;
  try {
    const code = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('5분 안에 로그인하지 않아서 취소됐어요. 다시 시도해 주세요.')), 5 * 60000);
      server.on('request', (req, res) => {
        const u = new URL(req.url, redirectUri);
        if (u.searchParams.get('state') !== state) { res.writeHead(404); res.end(); return; }
        const error = u.searchParams.get('error');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(error
          ? donePage('연결을 취소했어요', '학회 캘린더로 돌아가서 다시 시도해 주세요.')
          : donePage('구글 캘린더 연결 완료', '이 창을 닫고 학회 캘린더로 돌아가세요.'));
        clearTimeout(timer);
        if (error) reject(new Error(error === 'access_denied' ? '구글 권한 허용을 취소했어요.' : error));
        else resolve(u.searchParams.get('code'));
      });
      shell.openExternal(authUrl({ clientId: s.clientId, redirectUri, challenge, state }));
    });
    const tok = await exchangeCode(fetchFn, {
      clientId: s.clientId, clientSecret: dec(s.secretEnc), code, verifier, redirectUri,
    });
    if (!tok.refresh_token) throw new Error('구글이 장기 로그인 토큰을 주지 않았어요. 다시 시도해 주세요.');
    return tok.refresh_token;
  } finally {
    server.close();
  }
}

/* ───── IPC ───── */
function setup(winGetter) {
  getWin = winGetter;

  ipcMain.handle('mine:load', () => withLock(async () => toView(await readStored())));

  ipcMain.handle('mine:save', (_e, events) => withLock(async () => {
    if (!Array.isArray(events) || events.length > 5000) throw new Error('일정 데이터가 올바르지 않습니다.');
    const stored = await readStored();
    const merged = mergeLocalEdit(stored, events.map(cleanInput).filter(Boolean)).map(cleanStored).filter(Boolean);
    await writeStored(merged);
    const s = await gLoad();
    if (s.refreshEnc) scheduleSync();
    return toView(merged);
  }));

  ipcMain.handle('google:status', () => status());

  ipcMain.handle('google:configure', async (_e, cfg) => {
    const clientId = str(cfg && cfg.clientId, 300).trim();
    const clientSecret = str(cfg && cfg.clientSecret, 300).trim();
    if (!/^[\w.-]+\.apps\.googleusercontent\.com$/.test(clientId)) throw new Error('클라이언트 ID 형식이 아니에요. "….apps.googleusercontent.com" 으로 끝나야 해요.');
    if (clientSecret.length < 10) throw new Error('클라이언트 보안 비밀번호를 붙여 넣어 주세요.');
    const s = await gLoad();
    const changed = s.clientId && s.clientId !== clientId;
    Object.assign(s, { clientId, secretEnc: enc(clientSecret) });
    if (changed) Object.assign(s, { refreshEnc: '', account: '', lastSync: null });
    await gSave(s);
    return status();
  });

  ipcMain.handle('google:connect', async () => {
    if (connecting) return status();
    const s = await gLoad();
    if (!s.clientId || !s.secretEnc) throw new Error('먼저 구글 클라이언트 ID와 보안 비밀번호를 넣어 주세요.');
    connecting = true;
    pushStatus();
    try {
      const refreshToken = await authorize(s);
      Object.assign(s, { refreshEnc: enc(refreshToken), needsReauth: false, lastError: '' });
      await gSave(s);
      // 연결 전에 앱에서 만든 일정도 구글로 올린다
      await withLock(async () => {
        const list = await readStored();
        for (const e of list) if (!e.gid && !e.deleted) e.dirty = true;
        await writeStored(list);
      });
    } finally {
      connecting = false;
      pushStatus();
    }
    return runSync();
  });

  ipcMain.handle('google:disconnect', async () => {
    const s = await gLoad();
    if (s.refreshEnc) await revoke(fetchFn, dec(s.refreshEnc));
    Object.assign(s, { refreshEnc: '', account: '', lastSync: null, lastError: '', needsReauth: false });
    await gSave(s);
    // 구글에서 가져온 일정은 앱에서 빼고, 앱에서 만든 일정은 남긴다
    await withLock(async () => {
      const list = (await readStored())
        .filter((e) => !e.deleted && e.source !== 'google')
        .map((e) => ({ ...e, gid: '', gEtag: '', dirty: false }));
      await writeStored(list);
      send('mine:changed', toView(list));
    });
    pushStatus();
    return status();
  });

  ipcMain.handle('google:sync', () => runSync());

  // 시작할 때, 5분마다, 창으로 돌아올 때(최대 1분에 한 번) 동기화
  setTimeout(() => runSync(), 4000);
  setInterval(() => runSync(), 5 * 60000);
  let lastFocus = 0;
  app.on('browser-window-focus', () => {
    if (Date.now() - lastFocus > 60000) { lastFocus = Date.now(); runSync(); }
  });
}

module.exports = { setup };
