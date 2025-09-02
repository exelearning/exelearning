const { contextBridge, ipcRenderer } = require('electron');

// Expose safe APIs for renderer (Symfony UI)
contextBridge.exposeInMainWorld('electronAPI', {
  save: (downloadUrl, projectKey, suggestedName) => ipcRenderer.invoke('app:save', { downloadUrl, projectKey, suggestedName }),
  saveAs: (downloadUrl, projectKey, suggestedName) =>
    ipcRenderer.invoke('app:saveAs', { downloadUrl, projectKey, suggestedName }),
  exportToFolder: (downloadUrl, projectKey, suggestedDirName) =>
    ipcRenderer.invoke('app:exportToFolder', { downloadUrl, projectKey, suggestedDirName }),
  setSavedPath: (projectKey, filePath) =>
    ipcRenderer.invoke('app:setSavedPath', { projectKey, filePath }),
  openElp: () => ipcRenderer.invoke('app:openElp'),
  readFile: (filePath) => ipcRenderer.invoke('app:readFile', { filePath }),
  onDownloadProgress: (cb) => ipcRenderer.on('download-progress', (_e, data) => cb && cb(data)),
  onDownloadDone: (cb) => ipcRenderer.on('download-done', (_e, data) => cb && cb(data))
});
