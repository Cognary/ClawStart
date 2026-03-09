export type LauncherAction =
  | "bootstrapEnvironment"
  | "installPortable"
  | "installRecommended"
  | "applyInstallerSetup"
  | "upgradeOpenclaw"
  | "runDoctor"
  | "runStatus"
  | "runDashboard"
  | "startGateway";

export type InstallerExistingConfigMode = "keep" | "modify" | "reset";
export type InstallerResetScope = "config" | "config+creds+sessions" | "full";
export type InstallerFlow = "quickstart" | "advanced" | "manual";
export type InstallerMode = "local" | "remote";
export type InstallerGatewayBind = "loopback" | "tailnet" | "lan" | "auto";
export type InstallerGatewayAuth = "token" | "password";
export type InstallerTailscaleMode = "off" | "serve" | "funnel";
export type InstallerSecretInputMode = "plaintext" | "ref";
export type InstallerAuthChoice =
  | "skip"
  | "setup-token"
  | "oauth"
  | "openai-codex"
  | "openai-api-key"
  | "anthropic-api-key"
  | "gemini-api-key"
  | "xai-api-key"
  | "moonshot-api-key"
  | "kimi-code-api-key"
  | "custom-api-key";
export type InstallerNodeManager = "npm" | "pnpm" | "bun";
export type InstallerToolProfile = "coding" | "general";
export type InstallerDmScope = "main" | "per-channel-peer" | "per-account-channel-peer";
export type InstallerSearchProvider = "none" | "brave" | "perplexity";
export type InstallerChannelDmPolicy = "pairing" | "allowlist" | "open";
export type InstallerChannelGroupPolicy = "allowlist" | "open" | "disabled";
export type InstallerMattermostChatmode = "oncall" | "onmessage" | "onchar";

export interface InstallerSetupPayload {
  existingConfig: InstallerExistingConfigMode;
  resetScope: InstallerResetScope;
  flow: InstallerFlow;
  mode: InstallerMode;
  workspace: string;
  repoRoot: string;
  skipBootstrap: boolean;
  toolProfile: InstallerToolProfile;
  dmScope: InstallerDmScope;
  gatewayBind: InstallerGatewayBind;
  gatewayPort: number;
  gatewayAuth: InstallerGatewayAuth;
  gatewayToken: string;
  gatewayPassword: string;
  tailscale: InstallerTailscaleMode;
  secretInputMode: InstallerSecretInputMode;
  authChoice: InstallerAuthChoice;
  openaiApiKey: string;
  anthropicApiKey: string;
  geminiApiKey: string;
  xaiApiKey: string;
  moonshotApiKey: string;
  kimiCodeApiKey: string;
  customApiKey: string;
  customBaseUrl: string;
  customModelId: string;
  customProviderId: string;
  customCompatibility: "openai" | "anthropic";
  remoteUrl: string;
  remoteToken: string;
  installDaemon: boolean;
  nodeManager: InstallerNodeManager;
  skipSkills: boolean;
  skipChannels: boolean;
  skipHealth: boolean;
  searchProvider: InstallerSearchProvider;
  searchApiKey: string;
  telegramEnabled: boolean;
  telegramBotToken: string;
  telegramAllowFrom: string;
  telegramDmPolicy: InstallerChannelDmPolicy;
  discordEnabled: boolean;
  discordToken: string;
  discordAllowFrom: string;
  discordDmPolicy: InstallerChannelDmPolicy;
  whatsappEnabled: boolean;
  whatsappAllowFrom: string;
  whatsappDmPolicy: InstallerChannelDmPolicy;
  whatsappGroupPolicy: InstallerChannelGroupPolicy;
  whatsappGroupAllowFrom: string;
  googlechatEnabled: boolean;
  googlechatServiceAccountFile: string;
  googlechatAudienceType: "app-url" | "project-number";
  googlechatAudience: string;
  googlechatWebhookPath: string;
  googlechatBotUser: string;
  googlechatDmPolicy: InstallerChannelDmPolicy;
  googlechatAllowFrom: string;
  mattermostEnabled: boolean;
  mattermostBaseUrl: string;
  mattermostBotToken: string;
  mattermostDmPolicy: InstallerChannelDmPolicy;
  mattermostChatmode: InstallerMattermostChatmode;
  mattermostOncharPrefixes: string;
  signalEnabled: boolean;
  signalAccount: string;
  signalCliPath: string;
  signalDmPolicy: InstallerChannelDmPolicy;
  signalAllowFrom: string;
  bluebubblesEnabled: boolean;
  bluebubblesServerUrl: string;
  bluebubblesPassword: string;
  bluebubblesWebhookPath: string;
  bluebubblesDmPolicy: InstallerChannelDmPolicy;
  bluebubblesAllowFrom: string;
  imessageEnabled: boolean;
  imessageCliPath: string;
  imessageDbPath: string;
  imessageRemoteHost: string;
  imessageDmPolicy: InstallerChannelDmPolicy;
  imessageAllowFrom: string;
}

export type TerminalSessionKind = "onboarding" | "shell";

export interface ConfigSummary {
  workspace?: string;
  gatewayBind?: string;
  gatewayPort?: number;
  allowFromCount?: number;
  openaiCodexConfigured?: boolean;
  openaiCodexAuthenticated?: boolean;
  openaiCodexProfileId?: string;
  openaiCodexExpiresAt?: number;
}

export interface ConfigState {
  path: string;
  exists: boolean;
  valid: boolean;
  content: string;
  template: string;
  parseError?: string;
  summary: ConfigSummary;
}

export interface ProbeResult {
  ok: boolean;
  value?: string;
  path?: string;
  note?: string;
}

export interface SystemInfo {
  platform: string;
  arch: string;
  shell: string;
  dashboardUrl: string;
  configPath: string;
  defaultWorkspacePath: string;
  recommendedInstallMode: "portable" | "recommended";
  checks: {
    node: ProbeResult;
    npm: ProbeResult;
    openclaw: ProbeResult;
    portableInstall: ProbeResult;
  };
  services: {
    dashboard: ProbeResult;
    gateway: ProbeResult;
  };
  tasks: RunningTask[];
}

export type AppUpdateProvider = "none" | "builtin" | "generic" | "github";

export type AppUpdateStatus =
  | "unconfigured"
  | "idle"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "error";

export interface AppUpdateState {
  currentVersion: string;
  status: AppUpdateStatus;
  provider: AppUpdateProvider;
  configured: boolean;
  isPackaged: boolean;
  usingDevConfig: boolean;
  message: string;
  sourceLabel: string;
  sourceDetail?: string;
  availableVersion?: string;
  releaseName?: string;
  releaseDate?: string;
  releaseNotes?: string;
  progressPercent?: number;
  progressTransferred?: number;
  progressTotal?: number;
  checkedAt?: number;
  lastError?: string;
  canCheck: boolean;
  canDownload: boolean;
  canInstall: boolean;
}

export interface RunningTask {
  id: string;
  action: LauncherAction;
  label: string;
  startedAt: number;
}

export interface TerminalSession {
  id: string;
  kind: TerminalSessionKind;
  label: string;
  command: string;
  startedAt: number;
  running: boolean;
  exitCode?: number;
}

export interface TerminalSnapshot {
  sessions: TerminalSession[];
  buffers: Record<string, string>;
}

export interface ActionResponse {
  ok: boolean;
  message: string;
  taskId?: string;
}

export interface SaveConfigResponse extends ActionResponse {
  path: string;
  backupPath?: string;
}

export interface TerminalActionResponse extends ActionResponse {
  sessionId?: string;
}

export interface TaskEvent {
  taskId: string;
  action: LauncherAction;
  kind: "start" | "stdout" | "stderr" | "exit" | "error";
  data?: string;
  code?: number | null;
}

export interface TerminalEvent {
  sessionId: string;
  kind: "start" | "data" | "exit" | "error";
  data?: string;
  exitCode?: number;
}
