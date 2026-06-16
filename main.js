const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

const REFRESH_INTERVAL_MS = 2000;
const LIVE_LIST_URL = "https://bf.titan007.com/vbsxml/bfdata_ut.js";
const LIST_WINDOW_WIDTH = 340;
const LIST_WINDOW_HEIGHT = 300;
const DETAIL_WINDOW_WIDTH = 340;
const DETAIL_WINDOW_HEIGHT = 300;

let listWindow = null;
const detailWindows = new Map();
const detailWindowMatchIds = new Map();

function getHeaderUrl(matchId) {
  return `https://livestatic.titan007.com/phone/txt/analysisheader/cn/${matchId.slice(0, 1)}/${matchId.slice(1, 3)}/${matchId}.txt`;
}

function normalizeMatchInput(input) {
  const value = String(input || "").trim();
  const match = value.match(/(?:detail\/)?(\d{6,10})(?:sb|cn)?(?:\.htm)?/i) || value.match(/^(\d{6,10})$/);

  if (!match) {
    throw new Error("请输入有效的比赛链接或比赛 ID");
  }

  return match[1];
}

function createBaseWindow(options) {
  const window = new BrowserWindow({
    frame: false,
    transparent: true,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      additionalArguments: options.additionalArguments || []
    },
    ...options.browser
  });

  window.setAlwaysOnTop(true, "screen-saver");
  return window;
}

function createListWindow() {
  listWindow = createBaseWindow({
    browser: {
      width: LIST_WINDOW_WIDTH,
      height: LIST_WINDOW_HEIGHT,
      minWidth: 280,
      minHeight: 220
    }
  });

  listWindow.on("closed", () => {
    listWindow = null;
    closeAllDetailWindows();
  });

  listWindow.loadFile("index.html");
}

function createDetailWindow(matchId) {
  const existing = detailWindows.get(matchId);
  if (existing && !existing.isDestroyed()) {
    existing.show();
    existing.focus();
    return existing;
  }

  const index = detailWindows.size;
  const detailWindow = createBaseWindow({
    additionalArguments: [`--match-id=${matchId}`],
    browser: {
      width: DETAIL_WINDOW_WIDTH,
      height: DETAIL_WINDOW_HEIGHT,
      minWidth: 280,
      minHeight: 220,
      x: 80 + index * 28,
      y: 80 + index * 28
    }
  });

  const webContentsId = detailWindow.webContents.id;
  detailWindows.set(matchId, detailWindow);
  detailWindowMatchIds.set(webContentsId, matchId);
  detailWindow.on("closed", () => {
    detailWindows.delete(matchId);
    detailWindowMatchIds.delete(webContentsId);
    notifyListWindow("match:detail-closed", matchId);
  });
  detailWindow.loadFile("detail.html");

  return detailWindow;
}

function closeAllDetailWindows() {
  const windows = Array.from(detailWindows.values());
  detailWindows.clear();
  detailWindowMatchIds.clear();

  for (const detailWindow of windows) {
    if (!detailWindow.isDestroyed()) {
      detailWindow.close();
    }
  }
}

function notifyListWindow(channel, payload) {
  if (listWindow && !listWindow.isDestroyed()) {
    listWindow.webContents.send(channel, payload);
  }
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function cleanTeamName(name) {
  return (name || "").replace(/\(中\)/g, "").trim();
}

function parseMatchListScript(script) {
  const matches = [];
  const rowRegex = /A\[\d+\]="([\s\S]*?)"\.split\('\^'\);/g;
  let rowMatch;

  while ((rowMatch = rowRegex.exec(script)) !== null) {
    const fields = rowMatch[1].split("^");
    const stateCode = Number.parseInt(fields[13] || "0", 10);

    if (!(stateCode > 0)) {
      continue;
    }

    const matchId = fields[0];
    const homeScore = fields[14] || "0";
    const guestScore = fields[15] || "0";
    const halfHomeScore = fields[16] || "";
    const halfGuestScore = fields[17] || "";
    const periodStartTime = parseListDateTime(fields[12]);
    const stateText = showMatchState(stateCode, periodStartTime);

    matches.push({
      matchId,
      league: stripHtml(fields[2]),
      time: fields[11] || "",
      stateCode,
      stateText,
      homeTeam: cleanTeamName(stripHtml(fields[5])),
      guestTeam: cleanTeamName(stripHtml(fields[8])),
      homeScore,
      guestScore,
      score: `${homeScore}-${guestScore}`,
      halfScore: halfHomeScore !== "" && halfGuestScore !== "" ? `${halfHomeScore}-${halfGuestScore}` : "-",
      sourceUrl: `https://live.titan007.com/detail/${matchId}sb.htm`
    });
  }

  return matches;
}

function parseHeaderText(text, matchId) {
  const fields = text.trim().split("^");

  if (fields.length < 16) {
    throw new Error("接口字段不足");
  }

  const homeScore = fields[10];
  const guestScore = fields[11];
  const stateCode = Number.parseInt(fields[4], 10);
  const matchTime = fields[5] || "";
  const matchTime2 = fields[25] || "";
  const stateStartTime = parseTitanDateTime(matchTime2 || matchTime);
  const injuryTime = fields[41] || "";
  const mStateText = showMatchState(stateCode, stateStartTime);

  if (!/^-?\d+$/.test(homeScore) || !/^-?\d+$/.test(guestScore)) {
    throw new Error("比分字段异常");
  }

  return {
    matchId,
    homeTeam: cleanTeamName(fields[0]),
    guestTeam: cleanTeamName(fields[1]),
    stateCode,
    startTime: formatStartTime(matchTime),
    stateStartTime: stateStartTime ? stateStartTime.toISOString() : "",
    mStateText,
    injuryTime,
    stateText: injuryTime && (stateCode === 1 || stateCode === 3) ? `补${injuryTime} ${mStateText}` : mStateText,
    homeScore,
    guestScore,
    league: fields[15] || "",
    temperature: fields[19] || "",
    weather: fields[20] || "",
    homeRedCards: fields[26] || "0",
    guestRedCards: fields[27] || "0",
    venue: fields[31] || "",
    round: fields[39] || "",
    refreshedAt: new Date().toISOString()
  };
}

function formatStartTime(raw) {
  if (!/^\d{14}$/.test(raw || "")) {
    return raw || "";
  }

  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)} ${raw.slice(8, 10)}:${raw.slice(10, 12)}`;
}

function parseTitanDateTime(raw) {
  if (!/^\d{14}$/.test(raw || "")) {
    return null;
  }

  return new Date(
    Number.parseInt(raw.slice(0, 4), 10),
    Number.parseInt(raw.slice(4, 6), 10) - 1,
    Number.parseInt(raw.slice(6, 8), 10),
    Number.parseInt(raw.slice(8, 10), 10),
    Number.parseInt(raw.slice(10, 12), 10),
    Number.parseInt(raw.slice(12, 14), 10)
  );
}

function parseListDateTime(raw) {
  const parts = String(raw || "").split(",").map((part) => Number.parseInt(part, 10));

  if (parts.length < 6 || parts.some(Number.isNaN)) {
    return null;
  }

  return new Date(parts[0], parts[1], parts[2], parts[3], parts[4], parts[5]);
}

function showMatchState(stateCode, startTime) {
  if (stateCode === 1 && startTime) {
    const minute = Math.trunc((Date.now() - startTime.getTime()) / 60000);

    if (minute <= 0) return "1'";
    if (minute <= 45) return `${minute}'`;
    return `45+${Math.min(minute - 45, 15)}'`;
  }

  if (stateCode === 3 && startTime) {
    const minute = Math.trunc((Date.now() - startTime.getTime()) / 60000) + 46;

    if (minute <= 46) return "46'";
    if (minute <= 90) return `${minute}'`;
    return `90+${Math.min(minute - 90, 15)}'`;
  }

  switch (stateCode) {
    case 4:
      return "加时";
    case 3:
      return "下半场";
    case 2:
      return "中场";
    case 1:
      return "上半场";
    case 0:
      return "未开赛";
    case -1:
      return "完场";
    case -10:
      return "取消";
    case -11:
      return "待定";
    case -12:
      return "腰斩";
    case -13:
      return "中断";
    case -14:
      return "推迟";
    case 5:
      return "点球";
    default:
      return `状态 ${stateCode}`;
  }
}

async function fetchScore(matchId) {
  const normalizedMatchId = normalizeMatchInput(matchId);
  const url = `${getHeaderUrl(normalizedMatchId)}?r=${Date.now()}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Referer": `https://live.titan007.com/detail/${normalizedMatchId}sb.htm`
    }
  });

  if (!response.ok) {
    throw new Error(`接口请求失败：HTTP ${response.status}`);
  }

  const text = await response.text();
  return parseHeaderText(text, normalizedMatchId);
}

async function fetchLiveMatches() {
  const response = await fetch(`${LIVE_LIST_URL}?r=007${Date.now()}`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Referer": "https://live.titan007.com/oldIndexall.aspx"
    }
  });

  if (!response.ok) {
    throw new Error(`比赛列表请求失败：HTTP ${response.status}`);
  }

  const script = await response.text();
  return parseMatchListScript(script);
}

ipcMain.handle("app:get-config", () => ({
  refreshIntervalMs: REFRESH_INTERVAL_MS
}));

ipcMain.handle("score:get-live-matches", async () => {
  try {
    return {
      ok: true,
      matches: await fetchLiveMatches(),
      refreshedAt: new Date().toISOString()
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "未知错误" };
  }
});

ipcMain.handle("match:open-detail", (_event, matchId) => {
  try {
    const normalizedMatchId = normalizeMatchInput(matchId);
    createDetailWindow(normalizedMatchId);
    return { ok: true, matchId: normalizedMatchId };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "未知错误" };
  }
});

ipcMain.handle("match:get-window-match-id", (event) => {
  return detailWindowMatchIds.get(event.sender.id) || "";
});

ipcMain.handle("match:fetch-detail", async (_event, matchId) => {
  try {
    return { ok: true, data: await fetchScore(matchId) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "未知错误" };
  }
});

ipcMain.on("window:close", (event) => {
  BrowserWindow.fromWebContents(event.sender)?.close();
});

ipcMain.on("window:minimize", (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize();
});

app.whenReady().then(createListWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createListWindow();
  }
});
