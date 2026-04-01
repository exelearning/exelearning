const { contextBridge, ipcRenderer } = require('electron');

// Expose safe APIs for renderer
// Save always prompts for destination — no silent overwrite.
contextBridge.exposeInMainWorld('electronAPI', {
  // URL-based save (legacy REST API exports) — always prompts
  save: (downloadUrl, projectKey, suggestedName) => ipcRenderer.invoke('app:save', { downloadUrl, projectKey, suggestedName }),
  // URL-based save-as (REST API fallback exports) — always prompts
  saveAs: (downloadUrl, projectKey, suggestedName) => ipcRenderer.invoke('app:saveAs', { downloadUrl, projectKey, suggestedName }),
  // Binary save (Yjs exports that generate data client-side) — always prompts
  saveBuffer: (bufferData, projectKey, suggestedName) =>
    ipcRenderer.invoke('app:saveBuffer', { bufferData, projectKey, suggestedName }),
  // Binary save-as (Yjs exports fallback) — always prompts
  saveBufferAs: (bufferData, projectKey, suggestedName) =>
    ipcRenderer.invoke('app:saveBufferAs', { bufferData, projectKey, suggestedName }),
  exportToFolder: (downloadUrl, projectKey, suggestedDirName) =>
    ipcRenderer.invoke('app:exportToFolder', { downloadUrl, projectKey, suggestedDirName }),
  exportBufferToFolder: (base64Data, suggestedDirName) =>
    ipcRenderer.invoke('app:exportBufferToFolder', { base64Data, suggestedDirName }),
  openElp: () => ipcRenderer.invoke('app:openElp'),
  readFile: (filePath) => ipcRenderer.invoke('app:readFile', { filePath }),
  getMemoryUsage: () => ipcRenderer.invoke('app:getMemoryUsage'),
  notifyRendererReadyForOpenFile: () => ipcRenderer.send('app:renderer-ready-for-open-file'),
  onDownloadProgress: (cb) => ipcRenderer.on('download-progress', (_e, data) => cb && cb(data)),
  onDownloadDone: (cb) => ipcRenderer.on('download-done', (_e, data) => cb && cb(data)),
  onOpenFile: (cb) => ipcRenderer.on('app:open-file', (_e, filePath) => cb && cb(filePath))
});
