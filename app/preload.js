const { contextBridge, ipcRenderer } = require('electron');

// Expose safe APIs for renderer (Symfony UI)
contextBridge.exposeInMainWorld('electronAPI', {
  save: (downloadUrl, projectKey, suggestedName) => ipcRenderer.invoke('app:save', { downloadUrl, projectKey, suggestedName }),
  saveAs: (downloadUrl, projectKey, suggestedName) =>
    ipcRenderer.invoke('app:saveAs', { downloadUrl, projectKey, suggestedName }),
  // Save binary data directly (for Yjs exports that generate data client-side)
  saveBuffer: (base64Data, projectKey, suggestedName) =>
    ipcRenderer.invoke('app:saveBuffer', { base64Data, projectKey, suggestedName }),
  saveBufferAs: (base64Data, projectKey, suggestedName) =>
    ipcRenderer.invoke('app:saveBufferAs', { base64Data, projectKey, suggestedName }),
  exportToFolder: (downloadUrl, projectKey, suggestedDirName) =>
    ipcRenderer.invoke('app:exportToFolder', { downloadUrl, projectKey, suggestedDirName }),
  // Export base64 ZIP data to folder (for client-side exports)
  exportBufferToFolder: (base64Data, suggestedDirName) =>
    ipcRenderer.invoke('app:exportBufferToFolder', { base64Data, suggestedDirName }),
  setSavedPath: (projectKey, filePath) =>
    ipcRenderer.invoke('app:setSavedPath', { projectKey, filePath }),
  clearSavedPath: (projectKey) =>
    ipcRenderer.invoke('app:clearSavedPath', { projectKey }),
  openElp: () => ipcRenderer.invoke('app:openElp'),
  readFile: (filePath) => ipcRenderer.invoke('app:readFile', { filePath }),
  notifyRendererReadyForOpenFile: () => ipcRenderer.send('app:renderer-ready-for-open-file'),
  onDownloadProgress: (cb) => ipcRenderer.on('download-progress', (_e, data) => cb && cb(data)),
  onDownloadDone: (cb) => ipcRenderer.on('download-done', (_e, data) => cb && cb(data)),
  onOpenFile: (cb) => ipcRenderer.on('app:open-file', (_e, filePath) => cb && cb(filePath))
});
