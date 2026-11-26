'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadData: () => ipcRenderer.invoke('data:load'),
  refreshData: () => ipcRenderer.invoke('data:refresh'),
  saveIcs: (defaultName, content) => ipcRenderer.invoke('file:save-ics', { defaultName, content }),
  revealFile: (filePath) => ipcRenderer.invoke('file:reveal', filePath),
  openLink: (url) => ipcRenderer.invoke('link:open', url),
  setTheme: (mode) => ipcRenderer.invoke('theme:set', mode),
  loadMine: () => ipcRenderer.invoke('mine:load'),
  saveMine: (events) => ipcRenderer.invoke('mine:save', events),
  updateState: () => ipcRenderer.invoke('update:state'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdate: (cb) => {
    const handler = (_e, s) => cb(s);
    ipcRenderer.on('update:status', handler);
    return () => ipcRenderer.removeListener('update:status', handler);
  },
});
