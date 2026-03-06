const { contextBridge, ipcRenderer } = require('electron');

// Expose safe APIs for renderer
// Save always prompts for destination — no silent overwrite.
contextBridge.exposeInMainWorld('electronAPI', {
  // URL-based save (legacy REST API exports) — always prompts
  save: (downloadUrl, projectKey, suggestedName) => ipcRenderer.invoke('app:save', { downloadUrl, projectKey, suggestedName }),
  // Binary save (Yjs exports that generate data client-side) — always prompts
  saveBuffer: (base64Data, projectKey, suggestedName) =>
    ipcRenderer.invoke('app:saveBuffer', { base64Data, projectKey, suggestedName }),
  exportToFolder: (downloadUrl, projectKey, suggestedDirName) =>
    ipcRenderer.invoke('app:exportToFolder', { downloadUrl, projectKey, suggestedDirName }),
  exportBufferToFolder: (base64Data, suggestedDirName) =>
    ipcRenderer.invoke('app:exportBufferToFolder', { base64Data, suggestedDirName }),
  openElp: () => ipcRenderer.invoke('app:openElp'),
  readFile: (filePath) => ipcRenderer.invoke('app:readFile', { filePath }),
  notifyRendererReadyForOpenFile: () => ipcRenderer.send('app:renderer-ready-for-open-file'),
  onDownloadProgress: (cb) => ipcRenderer.on('download-progress', (_e, data) => cb && cb(data)),
  onDownloadDone: (cb) => ipcRenderer.on('download-done', (_e, data) => cb && cb(data)),
  onOpenFile: (cb) => ipcRenderer.on('app:open-file', (_e, filePath) => cb && cb(filePath))
});
