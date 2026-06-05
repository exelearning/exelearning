const { contextBridge, ipcRenderer, webUtils } = require('electron');

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
  // Advanced: open an unpacked project folder. Returns the folder
  // contents as a base64-encoded zip so the renderer can hand it to
  // the existing importFromElpxViaYjs(File) pipeline unchanged.
  openProjectFolder: () => ipcRenderer.invoke('app:openProjectFolder'),
  // Advanced: save the current project as an unpacked folder. Reuses
  // the existing exportBufferToFolder handler — exposed under a
  // distinct name so the renderer can offer it as a separate menu
  // entry without touching .elpx behaviour.
  saveProjectFolder: (base64Data, suggestedDirName) =>
    ipcRenderer.invoke('app:exportBufferToFolder', { base64Data, suggestedDirName }),
  // Remember / forget the file currently associated with the window so the
  // next Save dialog pre-fills with its name (PR #1670 review). Both names
  // survive the full page reload that follows Open/New because they are
  // persisted to settings.json by the main process.
  setSavedPath: (filePath) => ipcRenderer.invoke('app:setSavedPath', { filePath }),
  clearSavedPath: () => ipcRenderer.invoke('app:clearSavedPath'),
  // Retrieve the absolute path for a File picked via <input type="file">.
  // Needed in static/Electron mode so the Save dialog can reopen in the
  // same folder the file came from (issue #1666).
  getFilePath: (file) => {
    try {
      return webUtils?.getPathForFile ? webUtils.getPathForFile(file) : null;
    } catch (_e) {
      return null;
    }
  },
  openElp: () => ipcRenderer.invoke('app:openElp'),
  readFile: (filePath) => ipcRenderer.invoke('app:readFile', { filePath }),
  getMemoryUsage: () => ipcRenderer.invoke('app:getMemoryUsage'),
  notifyRendererReadyForOpenFile: () => ipcRenderer.send('app:renderer-ready-for-open-file'),
  onDownloadProgress: (cb) => ipcRenderer.on('download-progress', (_e, data) => cb && cb(data)),
  onDownloadDone: (cb) => ipcRenderer.on('download-done', (_e, data) => cb && cb(data)),
  onOpenFile: (cb) => ipcRenderer.on('app:open-file', (_e, filePath) => cb && cb(filePath)),
  onGetCloseCopy: (cb) => ipcRenderer.on('app:get-close-copy', (_e) => cb && cb()),
  sendCloseCopy: (copy) => ipcRenderer.send('app:close-copy-response', copy),
});
