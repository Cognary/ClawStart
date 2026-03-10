import type { AppUpdateState, ConfigState, LauncherAction, ProbeResult, SystemInfo, TaskEvent, TerminalSession } from "../../main/types";

export type SetupIntent =
  | LauncherAction
  | "saveConfig"
  | "reloadConfig"
  | "resetConfigDraft"
  | "refreshAll"
  | "repairShellPath"
  | "restoreStarterConfig"
  | "repairDashboardPort"
  | "openTerminalOnboarding"
  | "openTerminalShell"
  | "revealConfigPath"
  | "revealWorkspacePath"
  | "openDashboardUrl"
  | "openOnboardingTerminal"
  | "loginOpenaiCodex"
  | "checkAppUpdates"
  | "downloadAppUpdate"
  | "installAppUpdate";

export type AppSurface = "installer" | "workspace";
export type StepStatus = "done" | "current" | "upcoming";
export type SetupStageId = "environmentCheck" | "environmentRepair" | "install" | "config" | "onboarding" | "verify";
export type WorkspacePanel = "overview" | "models" | "skills" | "channels" | "terminal" | "logs" | "settings";
export type DiagnosticSeverity = "blocking" | "warning" | "info";

export interface LogEntry {
  id: string;
  taskId: string;
  kind: TaskEvent["kind"];
  text: string;
  action: LauncherAction;
  code?: number | null;
}

export interface InstallActionModel {
  id: LauncherAction;
  title: string;
  summary: string;
}

export interface StepCard {
  id: SetupStageId;
  order: number;
  label: string;
  title: string;
  description: string;
  status: StepStatus;
  primaryIntent: SetupIntent;
  primaryLabel: string;
  completionHint: string;
}

export interface DiagnosticAction {
  intent: SetupIntent;
  label: string;
}

export interface DiagnosticCard {
  id: string;
  severity: DiagnosticSeverity;
  title: string;
  body: string;
  evidence?: string[];
  primaryAction?: DiagnosticAction;
  secondaryAction?: DiagnosticAction;
}

export interface EnvironmentCheck {
  label: string;
  probe: ProbeResult;
}

export interface SidebarStatusItem {
  label: string;
  value: string;
}

export interface FactCard {
  label: string;
  value: string;
  detail: string;
}

export interface OverviewCard {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: "ready" | "active" | "warning";
}

export interface DerivedAppModel {
  surface: AppSurface;
  installAction: InstallActionModel;
  platformLabel: string;
  steps: StepCard[];
  currentStep: StepCard;
  completedSteps: number;
  progressPercent: number;
  checks: EnvironmentCheck[];
  diagnostics: DiagnosticCard[];
  highlightedDiagnostics: DiagnosticCard[];
  compactLogs: LogEntry[];
  logs: LogEntry[];
  workspacePath: string;
  latestReleaseDate?: string;
  installed: boolean;
  configReady: boolean;
  doctorVerified: boolean;
  dashboardRunning: boolean;
  onboardingSession: TerminalSession | null;
  shellSession: TerminalSession | null;
  activeTerminal: TerminalSession | null;
  activeTerminalBuffer: string;
  installerHeroSummary: string;
  installerSidebarSummary: SidebarStatusItem[];
  installerFactCards: FactCard[];
  installerPrimaryAction: DiagnosticAction;
  installerSecondaryAction: DiagnosticAction;
  workspaceSidebarStatus: SidebarStatusItem[];
  workspaceOverviewCards: OverviewCard[];
  workspaceFacts: FactCard[];
  workspacePrimaryAction: DiagnosticAction;
  workspaceSecondaryActions: DiagnosticAction[];
  appUpdateState: AppUpdateState;
  configState: ConfigState;
  systemInfo: SystemInfo;
}

export interface IntentControls {
  executeIntent: (intent: SetupIntent) => Promise<void>;
  isIntentDisabled: (intent: SetupIntent) => boolean;
  resolveIntentLabel: (intent: SetupIntent, fallbackLabel: string) => string;
}

export interface TerminalControls {
  activeTerminalId: string | null;
  setActiveTerminalId: (sessionId: string) => void;
  closeActiveTerminal: () => Promise<void>;
  sendTerminalInput: (data: string) => void;
  resizeTerminal: (cols: number, rows: number) => void;
  closing: boolean;
}

export const launcherActionTitles: Record<LauncherAction, string> = {
  bootstrapEnvironment: "自动补齐环境",
  installPortable: "安装 OpenClaw（本地模式）",
  installRecommended: "安装 OpenClaw（官方推荐）",
  applyInstallerSetup: "写入 OpenClaw 安装配置",
  upgradeOpenclaw: "升级 / 重装 OpenClaw CLI",
  runDoctor: "运行 Doctor",
  runStatus: "查看 Status",
  runDashboard: "启动 Dashboard",
  startGateway: "启动 Gateway",
};

export function platformLabel(platform: SystemInfo["platform"]) {
  if (platform === "darwin") {
    return "macOS";
  }

  if (platform === "win32") {
    return "Windows";
  }

  return "Linux / WSL";
}

export function checkStateLabel(ok: boolean) {
  return ok ? "已就绪" : "待处理";
}

export function updateStatusLabel(status: AppUpdateState["status"]) {
  if (status === "unconfigured") {
    return "未配置";
  }

  if (status === "idle") {
    return "可检查";
  }

  if (status === "checking") {
    return "检查中";
  }

  if (status === "available") {
    return "可更新";
  }

  if (status === "not-available") {
    return "已最新";
  }

  if (status === "downloading") {
    return "下载中";
  }

  if (status === "downloaded") {
    return "待安装";
  }

  return "失败";
}

export function updateStatusTone(status: AppUpdateState["status"]) {
  if (status === "error" || status === "unconfigured") {
    return "warning" as const;
  }

  if (status === "available" || status === "checking" || status === "downloading") {
    return "active" as const;
  }

  return "ready" as const;
}

export function formatUpdateDate(date?: string) {
  if (!date) {
    return undefined;
  }

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toLocaleString();
}

export function getInstallAction(systemInfo: SystemInfo): InstallActionModel {
  if (systemInfo.recommendedInstallMode === "portable") {
    return {
      id: "installPortable",
      title: "一键本地安装",
      summary: "优先装进 ~/.openclaw，启动器自动接管 PATH。",
    };
  }

  return {
    id: "installRecommended",
    title: "官方推荐安装",
    summary: "调用官方安装脚本，适合 Windows 或希望走标准路径的场景。",
  };
}
