const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  fetchRemoteFile: (url) => ipcRenderer.invoke('fetch-remote-file', url),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  showNotification: (options) => ipcRenderer.invoke('show-notification', options),
  setWindowMode: (mode) => ipcRenderer.send('set-window-mode', mode),
  setFullscreen: (isFullscreen) => ipcRenderer.send('set-fullscreen', isFullscreen),
  restartApp: () => ipcRenderer.send('restart-app'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  downloadAndExtractFix: (url, targetFolder, appID, fileName) => ipcRenderer.invoke('download-extract-fix', url, targetFolder, appID, fileName),
  downloadBypass: (url, fileName) => ipcRenderer.invoke('download-bypass', url, fileName),
  readReadme: () => ipcRenderer.invoke('read-readme')
});