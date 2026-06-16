const elements = {
  detailLeague: document.getElementById("detailLeague"),
  detailKickoff: document.getElementById("detailKickoff"),
  homeTeam: document.getElementById("homeTeam"),
  guestTeam: document.getElementById("guestTeam"),
  homeScore: document.getElementById("homeScore"),
  guestScore: document.getElementById("guestScore"),
  matchState: document.getElementById("matchState"),
  weather: document.getElementById("weather"),
  venue: document.getElementById("venue"),
  statusDot: document.getElementById("statusDot"),
  statusText: document.getElementById("statusText"),
  refreshTime: document.getElementById("refreshTime"),
  minimizeButton: document.getElementById("minimizeButton"),
  closeButton: document.getElementById("closeButton")
};

let matchId = "";
let config = null;
let refreshTimer = null;

elements.closeButton.addEventListener("click", () => window.scoreApp.closeWindow());
elements.minimizeButton.addEventListener("click", () => window.scoreApp.minimizeWindow());

function formatTime(isoString) {
  const date = isoString ? new Date(isoString) : new Date();
  return date.toLocaleTimeString("zh-CN", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function setStatus(type, message) {
  elements.statusDot.dataset.status = type;
  elements.statusText.textContent = message;
}

function renderScore(data) {
  elements.detailLeague.textContent = data.round ? `${data.league} · ${data.round}` : data.league || "赛事";
  elements.detailKickoff.textContent = data.startTime || "--";
  elements.homeTeam.textContent = data.homeTeam || "主队";
  elements.guestTeam.textContent = data.guestTeam || "客队";
  elements.homeScore.textContent = data.homeScore;
  elements.guestScore.textContent = data.guestScore;
  elements.matchState.textContent = data.stateText || data.mStateText || "";
  elements.weather.textContent = [data.weather, data.temperature].filter(Boolean).join(" ") || "--";
  elements.venue.textContent = data.venue || "--";
  elements.refreshTime.textContent = formatTime(data.refreshedAt);
}

async function refreshScore() {
  const result = await window.scoreApp.fetchMatchDetail(matchId);
  if (!result.ok) {
    setStatus("warn", `连接异常，重试中：${result.error}`);
    return;
  }

  renderScore(result.data);
  setStatus("ok", "已更新");
}

function restartTimer() {
  if (refreshTimer !== null) {
    window.clearInterval(refreshTimer);
  }

  refreshTimer = window.setInterval(refreshScore, config.refreshIntervalMs);
}

async function start() {
  config = await window.scoreApp.getConfig();
  matchId = await window.scoreApp.getWindowMatchId();

  if (!matchId) {
    setStatus("error", "缺少比赛 ID");
    return;
  }

  await refreshScore();
  restartTimer();
}

window.addEventListener("beforeunload", () => {
  if (refreshTimer !== null) {
    window.clearInterval(refreshTimer);
  }
});

start();
