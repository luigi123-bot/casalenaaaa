const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    printSilent: (options) => ipcRenderer.invoke('print-silent', options),
    isElectron: true
});
