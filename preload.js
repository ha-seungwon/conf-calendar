'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  platform: process.platform,
  loadData: () => ipcRenderer.invoke('data:load'),
  refreshData: () => ipcRenderer.invoke('data:refresh'),
  saveIcs: (defaultName, content) => ipcRenderer.invoke('file:save-ics', { defaultName, content }),
  revealFile: (filePath) => ipcRenderer.invoke('file:reveal', filePath),
  openLink: (url) => ipcRenderer.invoke('link:open', url),
  setTheme: (mode) => ipcRenderer.invoke('theme:set', mode),
  loadMine: () => ipcRenderer.invoke('mine:load'),
  saveMine: (events) => ipcRenderer.invoke('mine:save', events),
  onMineChanged: (cb) => {
    const handler = (_e, events) => cb(events);
    ipcRenderer.on('mine:changed', handler);
    return () => ipcRenderer.removeListener('mine:changed', handler);
  },
  google: {
    status: () => ipcRenderer.invoke('google:status'),
    configure: (clientId, clientSecret) => ipcRenderer.invoke('google:configure', { clientId, clientSecret }),
    connect: () => ipcRenderer.invoke('google:connect'),
    disconnect: () => ipcRenderer.invoke('google:disconnect'),
    sync: () => ipcRenderer.invoke('google:sync'),
    onStatus: (cb) => {
      const handler = (_e, s) => cb(s);
      ipcRenderer.on('google:status', handler);
      return () => ipcRenderer.removeListener('google:status', handler);
    },
  },
  onNotice: (cb) => {
    const handler = (_e, msg) => cb(String(msg));
    ipcRenderer.on('app:notice', handler);
    return () => ipcRenderer.removeListener('app:notice', handler);
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (next) => ipcRenderer.invoke('settings:set', next),
  },
  showWindow: () => ipcRenderer.invoke('win:show'),
  setTrayTip: (text) => ipcRenderer.invoke('tray:tip', text),
  updateState: () => ipcRenderer.invoke('update:state'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  onUpdate: (cb) => {
    const handler = (_e, s) => cb(s);
    ipcRenderer.on('update:status', handler);
    return () => ipcRenderer.removeListener('update:status', handler);
  },
});
