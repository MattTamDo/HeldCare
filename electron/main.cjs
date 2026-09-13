const path = require("node:path");
const { existsSync, readFileSync } = require("node:fs");
const { app, BrowserWindow, session } = require("electron");
const { bindSmartSpectraIpc } = require("@smartspectra/node-sdk/main");

function loadDotEnv(dotenvPath = path.join(__dirname, "..", ".env")) {
  if (!existsSync(dotenvPath)) return;
  const lines = readFileSync(dotenvPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

loadDotEnv();

const startUrl =
  process.env.ELECTRON_START_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  "http://localhost:3000/responder/incident/incident-demo-001/assessment";

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    title: "CareFall SmartSpectra",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
    },
  });

  bindSmartSpectraIpc(win, {
    logger(level, message) {
      console[level === "error" ? "error" : level === "warn" ? "warn" : "log"](
        `[smartspectra/ipc] ${message}`,
      );
    },
  });

  win.loadURL(startUrl);

  if (process.env.ELECTRON_DEVTOOLS === "1") {
    win.webContents.openDevTools({ mode: "detach" });
  }
}

app.setName("CareFall SmartSpectra");

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback, details) => {
      const requestingUrl = details?.requestingUrl ?? webContents.getURL();
      const allowedOrigin =
        requestingUrl.startsWith("http://localhost:3000") ||
        requestingUrl.startsWith("http://127.0.0.1:3000") ||
        requestingUrl.startsWith("file://");

      callback(permission === "media" && allowedOrigin);
    },
  );

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
