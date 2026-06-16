const elements = {
  summaryText: document.getElementById("summaryText"),
  matchList: document.getElementById("matchList"),
  statusDot: document.getElementById("statusDot"),
  statusText: document.getElementById("statusText"),
  refreshTime: document.getElementById("refreshTime"),
  closeButton: document.getElementById("closeButton"),
  refreshListButton: document.getElementById("refreshListButton")
};

let config = null;
let refreshTimer = null;
const openedMatchIds = new Set();

elements.closeButton.addEventListener("click", () => window.scoreApp.closeWindow());
elements.refreshListButton.addEventListener("click", () => loadLiveMatchList({ manual: true }));
window.scoreApp.onDetailClosed((matchId) => {
  openedMatchIds.delete(matchId);
  refreshOpenStates();
});

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

async function loadLiveMatchList(options = {}) {
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
    button.addEventListener("click", () => openMatchDetail(button.dataset.matchId));
  });
  setStatus("ok", "已更新");
}

async function openMatchDetail(matchId) {
  setStatus("warn", "正在打开看板...");
  const result = await window.scoreApp.openDetailWindow(matchId);

  if (!result.ok) {
    setStatus("error", result.error || "打开失败");
    return;
  }

  openedMatchIds.add(result.matchId);
  refreshOpenStates();
  setStatus("ok", `已打开 ${result.matchId}`);
}

function refreshOpenStates() {
  elements.matchList.querySelectorAll(".match-item").forEach((item) => {
    item.classList.toggle("active", openedMatchIds.has(item.dataset.matchId));
  });
}

function renderMatchItem(match) {
  const isActive = openedMatchIds.has(match.matchId);

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

  refreshTimer = window.setInterval(loadLiveMatchList, config.refreshIntervalMs);
}

async function start() {
  config = await window.scoreApp.getConfig();
  await loadLiveMatchList();
  restartTimer();
}

window.addEventListener("beforeunload", () => {
  if (refreshTimer !== null) {
    window.clearInterval(refreshTimer);
  }
});

start();
