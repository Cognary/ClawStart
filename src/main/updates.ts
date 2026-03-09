import { constants } from "node:fs";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { app, BrowserWindow } from "electron";
import log from "electron-log/main";
import { autoUpdater, type ProgressInfo, type UpdateDownloadedEvent } from "electron-updater";
import type { UpdateInfo } from "builder-util-runtime";
import { ActionResponse, AppUpdateProvider, AppUpdateState } from "./types";

type UpdateRuntimeConfig = {
  configured: boolean;
  provider: AppUpdateProvider;
  sourceLabel: string;
  sourceDetail?: string;
  usingDevConfig: boolean;
  configPath?: string;
  feed?: Parameters<typeof autoUpdater.setFeedURL>[0];
  channel?: string;
  message: string;
};

const DEV_UPDATE_CONFIG_NAME = "dev-app-update.yml";

let initialized = false;
let configuredSource: UpdateRuntimeConfig = {
  configured: false,
  provider: "none",
  sourceLabel: "未配置更新源",
  usingDevConfig: false,
  message: "还没有配置 ClawStart 自更新源。",
};

let currentState: AppUpdateState = finalizeState({
  currentVersion: app.getVersion(),
  status: "unconfigured",
  provider: "none",
  configured: false,
  isPackaged: app.isPackaged,
  usingDevConfig: false,
  message: "还没有配置 ClawStart 自更新源。",
  sourceLabel: "未配置更新源",
});

let lastKnownInfo: UpdateInfo | null = null;

function broadcastUpdateState() {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send("launcher:update-state", currentState);
  }
}

function finalizeState(state: Omit<AppUpdateState, "canCheck" | "canDownload" | "canInstall">): AppUpdateState {
  return {
    ...state,
    canCheck: state.configured && state.status !== "checking" && state.status !== "downloading",
    canDownload: state.configured && state.status === "available",
    canInstall: state.configured && state.status === "downloaded",
  };
}

function setState(patch: Partial<Omit<AppUpdateState, "canCheck" | "canDownload" | "canInstall">>) {
  currentState = finalizeState({
    ...currentState,
    ...patch,
  });
  broadcastUpdateState();
}

function asTrimmedString(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function readBooleanEnv(name: string) {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) {
    return undefined;
  }

  if (["1", "true", "yes", "on"].includes(value)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(value)) {
    return false;
  }

  return undefined;
}

async function pathExists(targetPath: string) {
  try {
    await access(targetPath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function formatReleaseNotes(notes: unknown) {
  if (!notes) {
    return undefined;
  }

  if (typeof notes === "string") {
    return notes.trim() || undefined;
  }

  if (!Array.isArray(notes)) {
    return undefined;
  }

  const lines = notes.flatMap((entry) => {
    if (typeof entry === "string") {
      return entry.trim() ? [entry.trim()] : [];
    }

    if (!entry || typeof entry !== "object") {
      return [];
    }

    const version = typeof entry.version === "string" ? entry.version : undefined;
    const note = typeof entry.note === "string" ? entry.note.trim() : undefined;
    if (!note) {
      return [];
    }

    return version ? [`${version}\n${note}`] : [note];
  });

  return lines.length > 0 ? lines.join("\n\n") : undefined;
}

function yamlValue(value: string | number | boolean) {
  if (typeof value === "boolean" || typeof value === "number") {
    return String(value);
  }

  return JSON.stringify(value);
}

async function writeRuntimeUpdateConfig(
  provider: "generic" | "github",
  values: Record<string, string | number | boolean | undefined>,
) {
  const configPath = path.join(app.getPath("userData"), "runtime-app-update.yml");
  const lines = [`provider: ${provider}`];

  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) {
      continue;
    }

    lines.push(`${key}: ${yamlValue(value)}`);
  }

  lines.push('updaterCacheDirName: "clawstart-updater"');

  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, `${lines.join("\n")}\n`, "utf8");
  return configPath;
}

function releaseDateString(info: UpdateInfo) {
  const value = info.releaseDate;
  if (!value) {
    return undefined;
  }

  const date = typeof value === "string" ? new Date(value) : value;
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString();
}

function extractUpdateInfoFields(info: UpdateInfo | null) {
  if (!info) {
    return {
      availableVersion: undefined,
      releaseName: undefined,
      releaseDate: undefined,
      releaseNotes: undefined,
    };
  }

  return {
    availableVersion: info.version,
    releaseName: info.releaseName || undefined,
    releaseDate: releaseDateString(info),
    releaseNotes: formatReleaseNotes(info.releaseNotes),
  };
}

async function resolveRuntimeConfig(): Promise<UpdateRuntimeConfig> {
  const provider = asTrimmedString(process.env.CLAWSTART_UPDATE_PROVIDER)?.toLowerCase();
  const channel = asTrimmedString(process.env.CLAWSTART_UPDATE_CHANNEL);
  const devConfigPath =
    asTrimmedString(process.env.CLAWSTART_DEV_UPDATE_CONFIG) || path.join(app.getAppPath(), DEV_UPDATE_CONFIG_NAME);
  const hasDevConfig = await pathExists(devConfigPath);

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.logger = log;

  if (!app.isPackaged && (provider || hasDevConfig)) {
    autoUpdater.forceDevUpdateConfig = true;
  }

  if (provider === "generic") {
    const url = asTrimmedString(process.env.CLAWSTART_UPDATE_URL);
    if (!url) {
      return {
        configured: false,
        provider: "none",
        sourceLabel: "未配置更新源",
        usingDevConfig: false,
        message: "检测到 generic 更新模式，但缺少 CLAWSTART_UPDATE_URL。",
      };
    }

    const configPath = await writeRuntimeUpdateConfig("generic", {
      url,
      channel,
    });

    return {
      configured: true,
      provider: "generic",
      sourceLabel: "Generic 更新源",
      sourceDetail: url,
      usingDevConfig: !app.isPackaged,
      configPath,
      channel,
      feed: {
        provider: "generic",
        url,
        channel,
      },
      message: "已配置 Generic 更新源，可以手动检查 ClawStart 更新。",
    };
  }

  if (provider === "github") {
    const owner = asTrimmedString(process.env.CLAWSTART_UPDATE_OWNER);
    const repo = asTrimmedString(process.env.CLAWSTART_UPDATE_REPO);

    if (!owner || !repo) {
      return {
        configured: false,
        provider: "none",
        sourceLabel: "未配置更新源",
        usingDevConfig: false,
        message: "检测到 GitHub 更新模式，但缺少 CLAWSTART_UPDATE_OWNER 或 CLAWSTART_UPDATE_REPO。",
      };
    }

    const host = asTrimmedString(process.env.CLAWSTART_UPDATE_HOST);
    const token = asTrimmedString(process.env.CLAWSTART_UPDATE_TOKEN);
    const isPrivate = readBooleanEnv("CLAWSTART_UPDATE_PRIVATE");
    const configPath = await writeRuntimeUpdateConfig("github", {
      owner,
      repo,
      host,
      channel,
      private: isPrivate,
    });

    return {
      configured: true,
      provider: "github",
      sourceLabel: "GitHub Releases",
      sourceDetail: host ? `${host}/${owner}/${repo}` : `${owner}/${repo}`,
      usingDevConfig: !app.isPackaged,
      configPath,
      channel,
      feed: {
        provider: "github",
        owner,
        repo,
        host,
        channel,
        private: isPrivate,
        token,
      },
      message: "已配置 GitHub Releases 更新源，可以手动检查 ClawStart 更新。",
    };
  }

  if (!app.isPackaged && hasDevConfig) {
    autoUpdater.updateConfigPath = devConfigPath;
    return {
      configured: true,
      provider: "builtin",
      sourceLabel: "开发态更新配置",
      sourceDetail: devConfigPath,
      usingDevConfig: true,
      configPath: devConfigPath,
      message: "已检测到 dev-app-update.yml，可以在开发态手动检查更新。",
    };
  }

  const packagedConfigPath = path.join(process.resourcesPath, "app-update.yml");
  if (app.isPackaged && (await pathExists(packagedConfigPath))) {
    return {
      configured: true,
      provider: "builtin",
      sourceLabel: "内置更新配置",
      sourceDetail: packagedConfigPath,
      usingDevConfig: false,
      configPath: packagedConfigPath,
      message: "当前安装包已内置更新配置，可以手动检查更新。",
    };
  }

  return {
    configured: false,
    provider: "none",
    sourceLabel: "未配置更新源",
    usingDevConfig: false,
    message: app.isPackaged
      ? "当前打包产物没有内置 app-update.yml，也没有通过环境变量提供更新源。"
      : "开发态下还没有配置更新源。可通过环境变量，或项目根目录的 dev-app-update.yml 进行测试。",
  };
}

function attachUpdaterListeners() {
  autoUpdater.on("checking-for-update", () => {
    setState({
      status: "checking",
      message: "正在检查 ClawStart 新版本...",
      checkedAt: Date.now(),
      lastError: undefined,
    });
  });

  autoUpdater.on("update-available", (info) => {
    lastKnownInfo = info;
    setState({
      status: "available",
      message: `发现 ClawStart ${info.version}，可以开始下载。`,
      checkedAt: Date.now(),
      lastError: undefined,
      ...extractUpdateInfoFields(info),
    });
  });

  autoUpdater.on("update-not-available", (info) => {
    lastKnownInfo = info;
    setState({
      status: "not-available",
      message: `当前已经是最新版本 (${info.version})。`,
      checkedAt: Date.now(),
      lastError: undefined,
      progressPercent: undefined,
      progressTransferred: undefined,
      progressTotal: undefined,
      ...extractUpdateInfoFields(info),
    });
  });

  autoUpdater.on("download-progress", (progress: ProgressInfo) => {
    setState({
      status: "downloading",
      message: `正在下载更新 ${progress.percent.toFixed(1)}%。`,
      progressPercent: progress.percent,
      progressTransferred: progress.transferred,
      progressTotal: progress.total,
    });
  });

  autoUpdater.on("update-downloaded", (event: UpdateDownloadedEvent) => {
    setState({
      status: "downloaded",
      message: `ClawStart ${event.version} 已下载完成，重启应用即可安装。`,
      progressPercent: 100,
      progressTransferred: undefined,
      progressTotal: undefined,
      ...extractUpdateInfoFields(event),
    });
  });

  autoUpdater.on("error", (error) => {
    const message = error.message || "检查更新失败。";
    setState({
      status: "error",
      message,
      lastError: message,
      checkedAt: Date.now(),
    });
  });
}

async function applyRuntimeConfig() {
  configuredSource = await resolveRuntimeConfig();

  if (configuredSource.channel) {
    autoUpdater.channel = configuredSource.channel;
  }

  if (configuredSource.configPath) {
    autoUpdater.updateConfigPath = configuredSource.configPath;
  }

  if (configuredSource.feed) {
    autoUpdater.setFeedURL(configuredSource.feed);
  }

  setState({
    status: configuredSource.configured ? "idle" : "unconfigured",
    provider: configuredSource.provider,
    configured: configuredSource.configured,
    usingDevConfig: configuredSource.usingDevConfig,
    sourceLabel: configuredSource.sourceLabel,
    sourceDetail: configuredSource.sourceDetail,
    message: configuredSource.message,
  });
}

async function ensureInitialized() {
  if (initialized) {
    return;
  }

  initialized = true;
  attachUpdaterListeners();
  await applyRuntimeConfig();
}

export async function initializeUpdater() {
  await ensureInitialized();
}

export async function getAppUpdateState() {
  await ensureInitialized();
  return currentState;
}

export async function checkForAppUpdates(): Promise<ActionResponse> {
  await ensureInitialized();

  if (!configuredSource.configured) {
    return {
      ok: false,
      message: currentState.message,
    };
  }

  try {
    await autoUpdater.checkForUpdates();
    return {
      ok: true,
      message: "已经开始检查 ClawStart 更新。",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "检查更新失败。";
    setState({
      status: "error",
      message,
      lastError: message,
      checkedAt: Date.now(),
    });
    return {
      ok: false,
      message,
    };
  }
}

export async function downloadAppUpdate(): Promise<ActionResponse> {
  await ensureInitialized();

  if (currentState.status !== "available") {
    return {
      ok: false,
      message: "当前没有可下载的 ClawStart 更新，请先检查更新。",
    };
  }

  try {
    setState({
      status: "downloading",
      message: `开始下载 ClawStart ${currentState.availableVersion || ""}...`.trim(),
      lastError: undefined,
    });
    await autoUpdater.downloadUpdate();
    return {
      ok: true,
      message: "已经开始下载 ClawStart 更新。",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "下载更新失败。";
    setState({
      status: "error",
      message,
      lastError: message,
    });
    return {
      ok: false,
      message,
    };
  }
}

export async function installAppUpdate(): Promise<ActionResponse> {
  await ensureInitialized();

  if (currentState.status !== "downloaded") {
    return {
      ok: false,
      message: "更新还没有下载完成，暂时不能安装。",
    };
  }

  autoUpdater.quitAndInstall();
  return {
    ok: true,
    message: `正在安装 ClawStart ${currentState.availableVersion || lastKnownInfo?.version || ""}。`,
  };
}
