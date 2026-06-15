const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("scoreApp", {
  getConfig: () => ipcRenderer.invoke("score:get-config"),
  fetchScore: () => ipcRenderer.invoke("score:fetch"),
  setMatch: (input) => ipcRenderer.invoke("score:set-match", input),
  getLiveMatches: () => ipcRenderer.invoke("score:get-live-matches"),
  setSettingsOpen: (isOpen) => ipcRenderer.send("window:set-settings-open", isOpen),
  closeWindow: () => ipcRenderer.send("window:close")
});
