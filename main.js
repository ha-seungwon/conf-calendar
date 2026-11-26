'use strict';

const { app, BrowserWindow, ipcMain, shell, dialog, net, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const { SOURCE_URL, normalize } = require('./src/data');
const mineStore = require('./src/mine-store');

const BUNDLED = path.join(__dirname, 'data', 'allconf.snapshot.yml');
const cacheDir = () => path.join(app.getPath('userData'), 'cache');
const cacheFile = () => path.join(cacheDir(), 'allconf.yml');
const metaFile = () => path.join(cacheDir(), 'meta.json');

const THEME = {
  light: { color: '#f4f5fa', symbolColor: '#3b3f4f' },
  dark: { color: '#0e1016', symbolColor: '#d6d9e4' },
};

let win;
const IS_MAC = process.platform === 'darwin';
const RELEASES_URL = 'https://github.com/ha-seungwon/conf-calendar/releases/latest';

// 스크린샷 점검 모드는 실제 사용자 설정을 건드리지 않도록 별도 폴더 사용
if (process.env.CONFCAL_SHOT && !app.isPackaged) app.setPath('userData', path.resolve(process.env.CONFCAL_SHOT, 'userdata'));

function isHttpUrl(u) {
  try { return ['http:', 'https:'].includes(new URL(u).protocol); } catch { return false; }
}

function createWindow() {
  const dark = nativeTheme.shouldUseDarkColors;
  win = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1080,
    minHeight: 680,
    title: '학회 캘린더',
    backgroundColor: dark ? THEME.dark.color : THEME.light.color,
    titleBarStyle: 'hidden',
    ...(IS_MAC
      ? { trafficLightPosition: { x: 18, y: 18 } } // 맥: 왼쪽 위 신호등 버튼
      : { titleBarOverlay: { ...(dark ? THEME.dark : THEME.light), height: 52 } }),
    icon: path.join(__dirname, 'build', 'icon.png'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  if (!IS_MAC) win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.show());

  if (process.env.CONFCAL_SHOT && !app.isPackaged) {
    win.webContents.once('did-finish-load', () => require('./test/shots')(win, process.env.CONFCAL_SHOT));
  }

  // 외부 링크는 기본 브라우저로
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isHttpUrl(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (url !== win.webContents.getURL()) {
      e.preventDefault();
      if (isHttpUrl(url)) shell.openExternal(url);
    }
  });
}

async function readCache() {
  try {
    const [text, meta] = await Promise.all([
      fs.readFile(cacheFile(), 'utf8'),
      fs.readFile(metaFile(), 'utf8').then(JSON.parse).catch(() => ({})),
    ]);
    return { conferences: normalize(text), fetchedAt: meta.fetchedAt || null, source: 'cache' };
  } catch {
    const text = await fs.readFile(BUNDLED, 'utf8');
    return { conferences: normalize(text), fetchedAt: null, source: 'bundled' };
  }
}

async function refreshFromWeb() {
  const res = await net.fetch(SOURCE_URL, { signal: AbortSignal.timeout(20000), cache: 'no-store' });
  if (!res.ok) throw new Error(`서버 응답 ${res.status}`);
  const text = await res.text();
  const conferences = normalize(text); // 깨진 데이터면 여기서 예외 → 캐시 유지
  const fetchedAt = Date.now();
  await fs.mkdir(cacheDir(), { recursive: true });
  await fs.writeFile(cacheFile(), text, 'utf8');
  await fs.writeFile(metaFile(), JSON.stringify({ fetchedAt, source: SOURCE_URL }), 'utf8');
  return { conferences, fetchedAt, source: 'web' };
}

ipcMain.handle('data:load', () => readCache());
ipcMain.handle('data:refresh', () => refreshFromWeb());

/* ───── 자동 업데이트: GitHub Releases 의 최신 버전을 받아서 재시작 시 설치 ───── */
let updateState = { status: 'idle' };
let checkNow = null; // 설치된 앱에서만 채워짐
ipcMain.handle('update:check', () => (checkNow ? checkNow() : { status: 'dev', current: app.getVersion() }));
function sendUpdate(next) {
  updateState = { ...updateState, ...next };
  if (win && !win.isDestroyed()) win.webContents.send('update:status', updateState);
}

function setupAutoUpdate() {
  if (!app.isPackaged) return; // 개발 실행(npm start)에서는 끔
  let autoUpdater;
  try { ({ autoUpdater } = require('electron-updater')); } catch { return; }
  // 맥은 애플 개발자 서명이 없으면 자동 설치가 안 돼서, 새 버전을 알려 주고 다운로드 페이지를 연다
  autoUpdater.autoDownload = !IS_MAC;
  autoUpdater.autoInstallOnAppQuit = !IS_MAC;
  autoUpdater.on('update-available', (i) => sendUpdate(IS_MAC
    ? { status: 'manual', version: i.version, url: RELEASES_URL }
    : { status: 'downloading', version: i.version, percent: 0 }));
  autoUpdater.on('download-progress', (p) => sendUpdate({ status: 'downloading', percent: Math.round(p.percent || 0) }));
  autoUpdater.on('update-downloaded', (i) => sendUpdate({ status: 'ready', version: i.version }));
  autoUpdater.on('update-not-available', () => sendUpdate({ status: 'latest' }));
  autoUpdater.on('error', (err) => sendUpdate({ status: 'error', message: String((err && err.message) || err).slice(0, 200) }));
  const check = () => autoUpdater.checkForUpdates().catch(() => {});
  setTimeout(check, 5000);
  setInterval(check, 6 * 3600000);
  ipcMain.handle('update:install', () => {
    if (IS_MAC) return shell.openExternal(RELEASES_URL);
    return autoUpdater.quitAndInstall(false, true);
  });
  checkNow = async () => {
    sendUpdate({ status: 'checking' });
    try {
      const r = await autoUpdater.checkForUpdates();
      if (r && r.isUpdateAvailable === false) sendUpdate({ status: 'latest' });
    } catch (err) {
      sendUpdate({ status: 'error', message: String((err && err.message) || err).slice(0, 200) });
    }
    return { ...updateState, current: app.getVersion() };
  };
}

ipcMain.handle('update:state', () => ({ ...updateState, current: app.getVersion(), packaged: app.isPackaged }));

ipcMain.handle('file:save-ics', async (_e, { defaultName, content }) => {
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: '캘린더 파일(.ics) 저장',
    defaultPath: path.join(app.getPath('downloads'), String(defaultName || 'conferences.ics').replace(/[\\/:*?"<>|]/g, '_')),
    filters: [{ name: 'iCalendar', extensions: ['ics'] }],
  });
  if (canceled || !filePath) return { saved: false };
  await fs.writeFile(filePath, String(content), 'utf8');
  return { saved: true, filePath };
});

ipcMain.handle('file:reveal', (_e, filePath) => {
  if (typeof filePath === 'string') shell.showItemInFolder(filePath);
});

ipcMain.handle('link:open', (_e, url) => {
  if (isHttpUrl(url)) return shell.openExternal(url);
  return undefined;
});

ipcMain.handle('theme:set', (_e, mode) => {
  nativeTheme.themeSource = ['light', 'dark'].includes(mode) ? mode : 'system';
  const dark = nativeTheme.shouldUseDarkColors;
  if (win && process.platform !== 'darwin') {
    try { win.setTitleBarOverlay(dark ? THEME.dark : THEME.light); } catch { /* 일부 플랫폼 미지원 */ }
  }
  return dark;
});

app.whenReady().then(() => {
  app.setAppUserModelId('local.conf-calendar');
  createWindow();
  mineStore.setup(() => win);
  setupAutoUpdate();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
