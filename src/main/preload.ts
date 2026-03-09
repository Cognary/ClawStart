import { contextBridge, ipcRenderer } from "electron";
import { AppUpdateState, InstallerSetupPayload, LauncherAction, TaskEvent, TerminalEvent, TerminalSessionKind } from "./types";

contextBridge.exposeInMainWorld("clawstart", {
  getSystemInfo: () => ipcRenderer.invoke("launcher:get-system-info"),
  getConfigState: () => ipcRenderer.invoke("launcher:get-config-state"),
  getAppUpdateState: () => ipcRenderer.invoke("launcher:get-app-update-state"),
  getTerminalSessions: () => ipcRenderer.invoke("launcher:get-terminal-sessions"),
  getTerminalSnapshot: () => ipcRenderer.invoke("launcher:get-terminal-snapshot"),
  openTerminalSession: (kind: TerminalSessionKind, setup?: InstallerSetupPayload) =>
    ipcRenderer.invoke("launcher:open-terminal-session", kind, setup),
  writeTerminal: (sessionId: string, data: string) => ipcRenderer.invoke("launcher:write-terminal", sessionId, data),
  resizeTerminal: (sessionId: string, cols: number, rows: number) =>
    ipcRenderer.invoke("launcher:resize-terminal", sessionId, cols, rows),
  closeTerminalSession: (sessionId: string) => ipcRenderer.invoke("launcher:close-terminal-session", sessionId),
  repairShellPath: () => ipcRenderer.invoke("launcher:repair-shell-path"),
  restoreConfigFromStarter: () => ipcRenderer.invoke("launcher:restore-config-from-starter"),
  repairDashboardPort: () => ipcRenderer.invoke("launcher:repair-dashboard-port"),
  saveConfig: (content: string) => ipcRenderer.invoke("launcher:save-config", content),
  applyInstallerSetup: (setup: InstallerSetupPayload) => ipcRenderer.invoke("launcher:apply-installer-setup", setup),
  revealPath: (targetPath: string) => ipcRenderer.invoke("launcher:reveal-path", targetPath),
  runAction: (action: LauncherAction) => ipcRenderer.invoke("launcher:run-action", action),
  stopTask: (taskId: string) => ipcRenderer.invoke("launcher:stop-task", taskId),
  openDashboardUrl: () => ipcRenderer.invoke("launcher:open-dashboard-url"),
  openOnboardingTerminal: () => ipcRenderer.invoke("launcher:open-onboarding-terminal"),
  loginOpenaiCodex: () => ipcRenderer.invoke("launcher:login-openai-codex"),
  checkForAppUpdates: () => ipcRenderer.invoke("launcher:check-for-app-updates"),
  downloadAppUpdate: () => ipcRenderer.invoke("launcher:download-app-update"),
  installAppUpdate: () => ipcRenderer.invoke("launcher:install-app-update"),
  onTaskEvent: (listener: (event: TaskEvent) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: TaskEvent) => {
      listener(payload);
    };

    ipcRenderer.on("launcher:task-event", wrapped);

    return () => {
      ipcRenderer.removeListener("launcher:task-event", wrapped);
    };
  },
  onTerminalEvent: (listener: (event: TerminalEvent) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: TerminalEvent) => {
      listener(payload);
    };

    ipcRenderer.on("launcher:terminal-event", wrapped);

    return () => {
      ipcRenderer.removeListener("launcher:terminal-event", wrapped);
    };
  },
  onUpdateState: (listener: (state: AppUpdateState) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: AppUpdateState) => {
      listener(payload);
    };

    ipcRenderer.on("launcher:update-state", wrapped);

    return () => {
      ipcRenderer.removeListener("launcher:update-state", wrapped);
    };
  },
});
