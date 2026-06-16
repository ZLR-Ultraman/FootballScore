const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("scoreApp", {
  getConfig: () => ipcRenderer.invoke("app:get-config"),
  getLiveMatches: () => ipcRenderer.invoke("score:get-live-matches"),
  openDetailWindow: (matchId) => ipcRenderer.invoke("match:open-detail", matchId),
  getWindowMatchId: () => ipcRenderer.invoke("match:get-window-match-id"),
  fetchMatchDetail: (matchId) => ipcRenderer.invoke("match:fetch-detail", matchId),
  onDetailClosed: (callback) => {
    const listener = (_event, matchId) => callback(matchId);
    ipcRenderer.on("match:detail-closed", listener);
    return () => ipcRenderer.removeListener("match:detail-closed", listener);
  },
  closeWindow: () => ipcRenderer.send("window:close")
});
