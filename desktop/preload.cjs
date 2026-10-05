'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  info: () => ipcRenderer.invoke('atelier:info'),
  open: () => ipcRenderer.invoke('atelier:open'),
  startup: () => ipcRenderer.invoke('atelier:startup'),
  save: (project, saveAs) => ipcRenderer.invoke('atelier:save', project, Boolean(saveAs)),
  exportHTML: (html, name) => ipcRenderer.invoke('atelier:export-html', html, name),
  exportPDF: (html, name, print) => ipcRenderer.invoke('atelier:export-pdf', html, name, Boolean(print)),
  recover: project => ipcRenderer.invoke('atelier:recover', project),
  clearRecovery: () => ipcRenderer.invoke('atelier:clear-recovery'),
  discard: () => ipcRenderer.invoke('atelier:discard'),
  close: () => ipcRenderer.invoke('atelier:close'),
  report: message => ipcRenderer.invoke('atelier:report', String(message)),
  onAction: callback => { ipcRenderer.on('atelier:action', (_, action) => callback(action)); }
});
