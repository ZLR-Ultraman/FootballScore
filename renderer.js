const elements = {
  listView: document.getElementById("listView"),
  detailView: document.getElementById("detailView"),
  summaryText: document.getElementById("summaryText"),
  matchList: document.getElementById("matchList"),
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
  closeButton: document.getElementById("closeButton"),
  detailCloseButton: document.getElementById("detailCloseButton"),
  backButton: document.getElementById("backButton"),
  refreshListButton: document.getElementById("refreshListButton")
};

let config = null;
let refreshTimer = null;
let selectedMatchId = null;
let currentView = "list";

elements.closeButton.addEventListener("click", () => window.scoreApp.closeWindow());
elements.detailCloseButton.addEventListener("click", () => window.scoreApp.closeWindow());
elements.backButton.addEventListener("click", showListView);
elements.refreshListButton.addEventListener("click", () => loadLiveMatchList({ manual: true }));

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

function showListView() {
  currentView = "list";
  elements.listView.classList.add("active");
  elements.detailView.classList.remove("active");
  restartTimer();
  loadLiveMatchList();
}

function showDetailView() {
  currentView = "detail";
  elements.detailView.classList.add("active");
  elements.listView.classList.remove("active");
  restartTimer();
}

async function loadLiveMatchList(options = {}) {
  if (currentView !== "list" && !options.force) {
    return;
  }

  if (options.manual) {
    setStatus("warn", "正在刷新...");
  }

  elements.refreshListButton.disabled = true;
  const result = await window.scoreApp.getLiveMatches();
  elements.refreshListButton.disabled = false;

  if (!result.ok) {
    elements.matchList.innerHTML = `<div class="list-message error">${escapeHtml(result.error || "加载失败")}</div>`;
    elements.summaryText.textContent = "列表加载失败";
    setStatus("error", result.error || "加载失败");
    elements.refreshTime.textContent = formatTime();
    return;
  }

  const matches = result.matches;
  elements.summaryText.textContent = matches.length > 0 ? `${matches.length} 场正在进行` : "暂无正在进行";
  elements.refreshTime.textContent = formatTime(result.refreshedAt);

  if (matches.length === 0) {
    elements.matchList.innerHTML = '<div class="list-message">暂无正在进行的比赛</div>';
    setStatus("ok", "已更新");
    return;
  }

  elements.matchList.innerHTML = matches.map(renderMatchItem).join("");
  elements.matchList.querySelectorAll(".match-item").forEach((button) => {
    button.addEventListener("click", () => selectMatch(button.dataset.matchId));
  });
  setStatus("ok", "已更新");
}

async function refreshScore() {
  if (currentView !== "detail") {
    return;
  }

  const result = await window.scoreApp.fetchScore();
  if (!result.ok) {
    setStatus("warn", `连接异常，重试中：${result.error}`);
    return;
  }

  renderScore(result.data);
  setStatus("ok", "已更新");
}

async function selectMatch(matchId) {
  selectedMatchId = matchId;
  setStatus("warn", "正在切换比赛...");

  const result = await window.scoreApp.setMatch(matchId);
  if (!result.ok) {
    setStatus("error", result.error || "选择失败");
    return;
  }

  config = result.config;
  renderScore(result.data);
  showDetailView();
  setStatus("ok", `已选择 ${matchId}`);
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

function renderMatchItem(match) {
  const isActive = match.matchId === selectedMatchId;

  return `
    <button class="match-item${isActive ? " active" : ""}" type="button" data-match-id="${escapeHtml(match.matchId)}">
      <span class="match-main">
        <span class="match-row">
          <span class="league-tag">${escapeHtml(match.league || "赛事")}</span>
          <span class="match-time">${escapeHtml(match.stateText || "")}</span>
        </span>
        <span class="match-teams">${escapeHtml(match.homeTeam)} vs ${escapeHtml(match.guestTeam)}</span>
      </span>
      <span class="match-score">${escapeHtml(match.score)}</span>
    </button>
  `;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function restartTimer() {
  if (refreshTimer !== null) {
    window.clearInterval(refreshTimer);
  }

  const refresh = currentView === "detail" ? refreshScore : loadLiveMatchList;
  refreshTimer = window.setInterval(refresh, config.refreshIntervalMs);
}

async function start() {
  config = await window.scoreApp.getConfig();
  selectedMatchId = null;
  currentView = "list";
  await loadLiveMatchList();
  restartTimer();
}

window.addEventListener("beforeunload", () => {
  if (refreshTimer !== null) {
    window.clearInterval(refreshTimer);
  }
});

start();
