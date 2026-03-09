import type {
  ActionResponse,
  AppUpdateState,
  ConfigState,
  InstallerSetupPayload,
  LauncherAction,
  SaveConfigResponse,
  SystemInfo,
  TaskEvent,
  TerminalEvent,
  TerminalSnapshot,
  TerminalSession,
  TerminalSessionKind,
} from "../main/types";

declare global {
  interface Window {
    clawstart: {
      getSystemInfo: () => Promise<SystemInfo>;
      getConfigState: () => Promise<ConfigState>;
      getAppUpdateState: () => Promise<AppUpdateState>;
      getTerminalSessions: () => Promise<TerminalSession[]>;
      getTerminalSnapshot: () => Promise<TerminalSnapshot>;
      openTerminalSession: (kind: TerminalSessionKind, setup?: InstallerSetupPayload) => Promise<ActionResponse & { sessionId?: string }>;
      writeTerminal: (sessionId: string, data: string) => Promise<ActionResponse>;
      resizeTerminal: (sessionId: string, cols: number, rows: number) => Promise<ActionResponse>;
      closeTerminalSession: (sessionId: string) => Promise<ActionResponse>;
      repairShellPath: () => Promise<ActionResponse>;
      restoreConfigFromStarter: () => Promise<ActionResponse>;
      repairDashboardPort: () => Promise<ActionResponse>;
      saveConfig: (content: string) => Promise<SaveConfigResponse>;
      applyInstallerSetup: (setup: InstallerSetupPayload) => Promise<ActionResponse>;
      revealPath: (targetPath: string) => Promise<ActionResponse>;
      runAction: (action: LauncherAction) => Promise<ActionResponse>;
      stopTask: (taskId: string) => Promise<ActionResponse>;
      openDashboardUrl: () => Promise<ActionResponse>;
      openOnboardingTerminal: () => Promise<ActionResponse>;
      loginOpenaiCodex: () => Promise<ActionResponse>;
      checkForAppUpdates: () => Promise<ActionResponse>;
      downloadAppUpdate: () => Promise<ActionResponse>;
      installAppUpdate: () => Promise<ActionResponse>;
      onTaskEvent: (listener: (event: TaskEvent) => void) => () => void;
      onTerminalEvent: (listener: (event: TerminalEvent) => void) => () => void;
      onUpdateState: (listener: (state: AppUpdateState) => void) => () => void;
    };
  }
}

export {};
