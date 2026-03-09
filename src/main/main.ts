import os from "node:os";
import path from "node:path";
import { appendFileSync, mkdirSync } from "node:fs";
import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import log from "electron-log/main";
import {
  applyInstallerSetup,
  getConfigState,
  getSystemInfo,
  loginOpenaiCodex,
  openDashboardUrl,
  revealPath,
  runAction,
  runOnboardingInTerminal,
  saveConfig,
  stopTask,
} from "./openclaw";
import {
  closeTerminalSession,
  getTerminalSnapshot,
  getTerminalSessions,
  openTerminalSession,
  resizeTerminal,
  writeTerminal,
} from "./terminal";
import {
  repairDashboardPortConflict,
  repairShellPathForOpenclaw,
  restoreConfigFromStarter,
} from "./repairs";
import { InstallerSetupPayload, LauncherAction, TerminalSessionKind } from "./types";
import {
  checkForAppUpdates,
  downloadAppUpdate,
  getAppUpdateState,
  initializeUpdater,
  installAppUpdate,
} from "./updates";

const isDev = process.argv.includes("--dev");
const devServerUrl = "http://localhost:5173";
const earlyLogFile = path.join(os.tmpdir(), "ClawStart-startup.log");

function writeEarlyLog(message: string, error?: unknown) {
  try {
    mkdirSync(path.dirname(earlyLogFile), { recursive: true });
    const timestamp = new Date().toISOString();
    const suffix = error ? `\n${errorText(error)}` : "";
    appendFileSync(earlyLogFile, `[${timestamp}] ${message}${suffix}\n`, "utf8");
  } catch {
    // Ignore logging failures; never block app startup on diagnostics.
  }
}

function startupLogPath() {
  return log.transports.file.getFile().path;
}

function errorText(error: unknown) {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}\n${error.stack || ""}`.trim();
  }

  return String(error);
}

function reportFatal(title: string, error: unknown) {
  writeEarlyLog(title, error);
  const message = `${errorText(error)}\n\n日志位置：${startupLogPath()}`;
  log.error(title, error);
  dialog.showErrorBox(title, message);
}

function createWindow() {
  writeEarlyLog("Creating main window");
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1180,
    minHeight: 820,
    title: "ClawStart",
    backgroundColor: "#0d1411",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.webContents.on("did-fail-load", (_event, code, description, url) => {
    writeEarlyLog("Renderer failed to load", { code, description, url });
    log.error("Renderer failed to load", { code, description, url });
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev) {
    void window.loadURL(devServerUrl);
    window.webContents.openDevTools({ mode: "detach" });
  } else {
    writeEarlyLog("Loading packaged renderer", path.join(__dirname, "..", "dist", "index.html"));
    void window.loadFile(path.join(__dirname, "..", "dist", "index.html")).catch((error) => {
      reportFatal("ClawStart 页面加载失败", error);
    });
  }
}

writeEarlyLog("Main process module loaded");

app.whenReady().then(() => {
  writeEarlyLog("app.whenReady resolved");
  log.initialize();
  log.info("ClawStart starting", {
    version: app.getVersion(),
    isPackaged: app.isPackaged,
    platform: process.platform,
    arch: process.arch,
  });

  void initializeUpdater();
  writeEarlyLog("Updater initialized");

  ipcMain.handle("launcher:get-system-info", () => getSystemInfo());
  ipcMain.handle("launcher:get-config-state", () => getConfigState());
  ipcMain.handle("launcher:get-app-update-state", () => getAppUpdateState());
  ipcMain.handle("launcher:get-terminal-sessions", () => getTerminalSessions());
  ipcMain.handle("launcher:get-terminal-snapshot", () => getTerminalSnapshot());
  ipcMain.handle("launcher:open-terminal-session", (_event, kind: TerminalSessionKind, setup?: InstallerSetupPayload) =>
    openTerminalSession(kind, setup),
  );
  ipcMain.handle("launcher:write-terminal", (_event, sessionId: string, data: string) => writeTerminal(sessionId, data));
  ipcMain.handle("launcher:resize-terminal", (_event, sessionId: string, cols: number, rows: number) =>
    resizeTerminal(sessionId, cols, rows),
  );
  ipcMain.handle("launcher:close-terminal-session", (_event, sessionId: string) => closeTerminalSession(sessionId));
  ipcMain.handle("launcher:repair-shell-path", () => repairShellPathForOpenclaw());
  ipcMain.handle("launcher:restore-config-from-starter", () => restoreConfigFromStarter());
  ipcMain.handle("launcher:repair-dashboard-port", () => repairDashboardPortConflict());
  ipcMain.handle("launcher:save-config", (_event, content: string) => saveConfig(content));
  ipcMain.handle("launcher:apply-installer-setup", (_event, setup: InstallerSetupPayload) => applyInstallerSetup(setup));
  ipcMain.handle("launcher:reveal-path", (_event, targetPath: string) => revealPath(targetPath));
  ipcMain.handle("launcher:run-action", (_event, action: LauncherAction) => runAction(action));
  ipcMain.handle("launcher:stop-task", (_event, taskId: string) => stopTask(taskId));
  ipcMain.handle("launcher:open-dashboard-url", () => openDashboardUrl());
  ipcMain.handle("launcher:open-onboarding-terminal", () => runOnboardingInTerminal());
  ipcMain.handle("launcher:login-openai-codex", () => loginOpenaiCodex());
  ipcMain.handle("launcher:check-for-app-updates", () => checkForAppUpdates());
  ipcMain.handle("launcher:download-app-update", () => downloadAppUpdate());
  ipcMain.handle("launcher:install-app-update", () => installAppUpdate());

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

process.on("uncaughtException", (error) => {
  reportFatal("ClawStart 启动异常", error);
});

process.on("unhandledRejection", (reason) => {
  reportFatal("ClawStart 未处理的 Promise 异常", reason);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
