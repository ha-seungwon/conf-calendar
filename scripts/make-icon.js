'use strict';
// 앱 아이콘 생성: npx electron scripts/make-icon.js  →  build/icon.png, build/icon.ico
const { app, BrowserWindow, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="256" height="256">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#8b5cf6"/><stop offset="1" stop-color="#3b82f6"/></linearGradient></defs>
  <rect x="1" y="1" width="30" height="30" rx="8" fill="url(#g)"/>
  <rect x="8" y="9.5" width="16" height="14" rx="3" fill="none" stroke="#fff" stroke-width="2"/>
  <path d="M8 14h16M12.5 7.5v4M19.5 7.5v4" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
  <circle cx="16" cy="18.6" r="2" fill="#fff"/>
</svg>`;

// PNG들을 그대로 담는 ICO (Windows Vista 이상 지원)
function toIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const dirs = [];
  let offset = 6 + 16 * pngs.length;
  for (const { size, buf } of pngs) {
    const d = Buffer.alloc(16);
    d.writeUInt8(size >= 256 ? 0 : size, 0);
    d.writeUInt8(size >= 256 ? 0 : size, 1);
    d.writeUInt8(0, 2);
    d.writeUInt8(0, 3);
    d.writeUInt16LE(1, 4);
    d.writeUInt16LE(32, 6);
    d.writeUInt32LE(buf.length, 8);
    d.writeUInt32LE(offset, 12);
    offset += buf.length;
    dirs.push(d);
  }
  return Buffer.concat([header, ...dirs, ...pngs.map((p) => p.buf)]);
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 256, height: 256, show: false, frame: false, transparent: true,
    useContentSize: true, webPreferences: { offscreen: true },
  });
  win.webContents.setZoomFactor(1);
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(
    `<html><body style="margin:0;background:transparent;overflow:hidden">${SVG}</body></html>`)}`);
  await new Promise((r) => setTimeout(r, 400));
  const img = await win.webContents.capturePage({ x: 0, y: 0, width: 256, height: 256 });
  const base = nativeImage.createFromBuffer(img.resize({ width: 256, height: 256, quality: 'best' }).toPNG());
  const out = path.join(__dirname, '..', 'build');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'icon.png'), base.toPNG());
  const sizes = [256, 64, 48, 32, 16];
  const pngs = sizes.map((size) => ({ size, buf: size === 256 ? base.toPNG() : base.resize({ width: size, height: size, quality: 'best' }).toPNG() }));
  fs.writeFileSync(path.join(out, 'icon.ico'), toIco(pngs));
  console.log('build/icon.png, build/icon.ico 생성 완료');
  app.quit();
});
