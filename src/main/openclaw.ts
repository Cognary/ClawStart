import { constants } from "node:fs";
import { access, copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { BrowserWindow, shell } from "electron";
import JSON5 from "json5";
import {
  ActionResponse,
  ConfigState,
  ConfigSummary,
  InstallerSetupPayload,
  LauncherAction,
  ProbeResult,
  RunningTask,
  SaveConfigResponse,
  SystemInfo,
  TaskEvent,
} from "./types";
import {
  buildInstallerSetupCommand,
  mergeInstallerSetupIntoConfig,
  pluginIdsForInstallerSetup,
  validateInstallerSetup,
} from "./installerSetup";

const OPENCLAW_DIRNAME = ".openclaw";
const OPENCLAW_CONFIG_FILENAME = "openclaw.json";

const actionLabels: Record<LauncherAction, string> = {
  bootstrapEnvironment: "自动准备环境",
  installPortable: "安装 OpenClaw（无 root 本地模式）",
  installRecommended: "安装 OpenClaw（官方推荐脚本）",
  applyInstallerSetup: "写入 OpenClaw 安装配置",
  upgradeOpenclaw: "升级 / 重装 OpenClaw CLI",
  runDoctor: "运行 OpenClaw 健康诊断",
  runStatus: "检查 OpenClaw 状态",
  runDashboard: "启动 Dashboard",
  startGateway: "启动 Gateway",
};

interface CommandSpec {
  file: string;
  args: string[];
  env?: NodeJS.ProcessEnv;
}

interface TaskEntry {
  meta: RunningTask;
  child?: ChildProcessWithoutNullStreams;
}

const tasks = new Map<string, TaskEntry>();

function broadcast(event: TaskEvent) {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send("launcher:task-event", event);
  }
}

function getShellExecutable() {
  if (process.platform === "win32") {
    return {
      file: "powershell.exe",
      args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command"],
    };
  }

  return {
    file: process.env.SHELL || "/bin/bash",
    args: ["-lc"],
  };
}

function expandHome(targetPath: string) {
  if (targetPath.startsWith("~/")) {
    return path.join(os.homedir(), targetPath.slice(2));
  }

  return targetPath;
}

function portableBinDir() {
  return path.join(os.homedir(), OPENCLAW_DIRNAME, "bin");
}

function windowsNodePathCandidates() {
  if (process.platform !== "win32") {
    return [];
  }

  const candidates = [
    process.env.ProgramFiles ? path.join(process.env.ProgramFiles, "nodejs") : undefined,
    process.env["ProgramFiles(x86)"] ? path.join(process.env["ProgramFiles(x86)"], "nodejs") : undefined,
    process.env.LocalAppData ? path.join(process.env.LocalAppData, "Programs", "nodejs") : undefined,
  ].filter((value): value is string => Boolean(value));

  return Array.from(new Set(candidates));
}

function portableBinaryPath() {
  if (process.platform === "win32") {
    return path.join(portableBinDir(), "openclaw.cmd");
  }

  return path.join(portableBinDir(), "openclaw");
}

function configDirPath() {
  return path.join(os.homedir(), OPENCLAW_DIRNAME);
}

function configFilePath() {
  return path.join(configDirPath(), OPENCLAW_CONFIG_FILENAME);
}

function defaultWorkspacePath() {
  if (process.platform === "win32") {
    return path.join(os.homedir(), "OpenClaw", "workspace");
  }

  return path.join(os.homedir(), OPENCLAW_DIRNAME, "workspace");
}

function taskList(): RunningTask[] {
  return Array.from(tasks.values())
    .map((entry) => entry.meta)
    .sort((left, right) => right.startedAt - left.startedAt);
}

function toSingleLine(input: string) {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)[0];
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return undefined;
}

function getPathValue(root: unknown, segments: string[]) {
  let current: unknown = root;
  for (const segment of segments) {
    const record = asRecord(current);
    if (!record) {
      return undefined;
    }

    current = record[segment];
  }

  return current;
}

function readString(root: unknown, segments: string[]) {
  const value = getPathValue(root, segments);
  return typeof value === "string" ? value : undefined;
}

function readNumber(root: unknown, segments: string[]) {
  const value = getPathValue(root, segments);
  return typeof value === "number" ? value : undefined;
}

function countAllowFrom(root: unknown) {
  const channels = asRecord(getPathValue(root, ["channels"]));
  if (!channels) {
    return undefined;
  }

  let count = 0;

  for (const channelConfig of Object.values(channels)) {
    const config = asRecord(channelConfig);
    if (!config) {
      continue;
    }

    const allowFrom = config.allowFrom;
    if (Array.isArray(allowFrom)) {
      count += allowFrom.filter((entry) => typeof entry === "string" && entry.trim()).length;
    }
  }

  return count > 0 ? count : undefined;
}

function authProfilesPathCandidates() {
  return [
    path.join(configDirPath(), "agents", "main", "agent", "auth-profiles.json"),
    path.join(configDirPath(), "auth-profiles.json"),
  ];
}

function hasOpenaiCodexConfig(root: unknown) {
  const authProfiles = asRecord(getPathValue(root, ["auth", "profiles"]));
  if (!authProfiles) {
    return false;
  }

  return Object.values(authProfiles).some((entry) => readString(entry, ["provider"]) === "openai-codex");
}

async function readOpenaiCodexAuthSummary(root?: unknown) {
  const configured = root ? hasOpenaiCodexConfig(root) : false;

  for (const candidate of authProfilesPathCandidates()) {
    if (!(await exists(candidate))) {
      continue;
    }

    try {
      const parsed = JSON.parse(await readFile(candidate, "utf8")) as Record<string, unknown>;
      const profiles = asRecord(parsed.profiles);
      if (!profiles) {
        continue;
      }

      for (const [profileId, value] of Object.entries(profiles)) {
        const profile = asRecord(value);
        if (!profile || readString(profile, ["provider"]) !== "openai-codex") {
          continue;
        }

        const access = readString(profile, ["access"]);
        const refresh = readString(profile, ["refresh"]);
        const expiresAt = readNumber(profile, ["expires"]);

        return {
          openaiCodexConfigured: true,
          openaiCodexAuthenticated: Boolean(access || refresh),
          openaiCodexProfileId: profileId,
          openaiCodexExpiresAt: expiresAt,
        };
      }
    } catch {
      continue;
    }
  }

  return {
    openaiCodexConfigured: configured,
    openaiCodexAuthenticated: false,
    openaiCodexProfileId: undefined,
    openaiCodexExpiresAt: undefined,
  };
}

async function buildConfigSummary(root?: unknown): Promise<ConfigSummary> {
  const openaiCodex = await readOpenaiCodexAuthSummary(root);
  return {
    workspace: root ? readString(root, ["agents", "defaults", "workspace"]) : undefined,
    gatewayBind: root ? readString(root, ["gateway", "bind"]) : undefined,
    gatewayPort: root ? readNumber(root, ["gateway", "port"]) : undefined,
    allowFromCount: root ? countAllowFrom(root) : undefined,
    ...openaiCodex,
  };
}

function dashboardHostFromBind(bind?: string) {
  if (
    !bind ||
    bind === "loopback" ||
    bind === "auto" ||
    bind === "lan" ||
    bind === "tailnet" ||
    bind === "0.0.0.0" ||
    bind === "::" ||
    bind === "::0"
  ) {
    return "127.0.0.1";
  }

  if (bind === "localhost" || bind === "127.0.0.1") {
    return bind;
  }

  return bind.includes(":") ? `[${bind}]` : bind;
}

function dashboardUrlFromSummary(summary?: ConfigSummary) {
  const host = dashboardHostFromBind(summary?.gatewayBind);
  const port = summary?.gatewayPort || 18789;
  return `http://${host}:${port}/`;
}

async function probeHttpService(url: string): Promise<ProbeResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
    });

    return {
      ok: true,
      value: `${response.status} ${response.statusText}`.trim(),
      note: "本地地址可访问。",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "连接失败";
    return {
      ok: false,
      note: message,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function parseErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "无法解析配置文件。";
}

function makeTimestamp() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");

  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    "-",
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join("");
}

function renderStarterConfig() {
  const workspace = JSON.stringify(defaultWorkspacePath());

  return `{
  gateway: {
    bind: "127.0.0.1",
    port: 18789,
  },

  agents: {
    defaults: {
      workspace: ${workspace},
    },
  },

  // Optional: allow only specific accounts or numbers to talk to this instance.
  // channels: {
  //   whatsapp: {
  //     allowFrom: ["+15555550123"],
  //   },
  // },
}
`;
}

function buildEnv(extraPathEntries: string[] = []) {
  const pathEntries = [portableBinDir(), ...windowsNodePathCandidates(), ...extraPathEntries, process.env.PATH || ""];

  return {
    ...process.env,
    PATH: pathEntries.join(path.delimiter),
  };
}

function resolveWritablePath(targetPath: string) {
  if (targetPath.startsWith("~/")) {
    return expandHome(targetPath);
  }

  if (path.isAbsolute(targetPath)) {
    return targetPath;
  }

  return undefined;
}

async function exists(targetPath: string) {
  try {
    await access(targetPath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function ensureParentDirectory(targetPath: string) {
  await mkdir(path.dirname(targetPath), { recursive: true });
}

async function commandExists(command: string) {
  if (process.platform === "win32") {
    const result = await runCapture("cmd.exe", ["/c", "where", command], buildEnv());
    return result.code === 0;
  }

  const result = await runShellCapture(`command -v ${command} >/dev/null 2>&1`, buildEnv());
  return result.code === 0;
}

async function runCapture(file: string, args: string[], env?: NodeJS.ProcessEnv) {
  return await new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(file, args, {
      env: {
        ...process.env,
        ...env,
      },
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      resolve({
        code: -1,
        stdout,
        stderr: error.message,
      });
    });

    child.on("close", (code) => {
      resolve({
        code,
        stdout,
        stderr,
      });
    });
  });
}

async function runShellCapture(command: string, env?: NodeJS.ProcessEnv) {
  const shellSpec = getShellExecutable();
  return await runCapture(shellSpec.file, [...shellSpec.args, command], env);
}

async function locateOpenclawFromPath() {
  if (process.platform === "win32") {
    const result = await runShellCapture(
      "(Get-Command openclaw -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source) -join \"`n\"",
      buildEnv(),
    );

    const located = toSingleLine(result.stdout);
    return located || undefined;
  }

  const result = await runShellCapture("command -v openclaw || true", buildEnv());
  const located = toSingleLine(result.stdout);
  return located || undefined;
}

async function locateOpenclawFromNpmPrefix() {
  const prefix = await runShellCapture("npm config get prefix", buildEnv());
  const base = toSingleLine(prefix.stdout);
  if (!base) {
    return undefined;
  }

  const candidate =
    process.platform === "win32"
      ? path.join(base, "openclaw.cmd")
      : path.join(base, "bin", "openclaw");

  return (await exists(candidate)) ? candidate : undefined;
}

async function resolveOpenclawBinary() {
  const portable = portableBinaryPath();
  if (await exists(portable)) {
    return portable;
  }

  const pathMatch = await locateOpenclawFromPath();
  if (pathMatch) {
    return pathMatch;
  }

  return await locateOpenclawFromNpmPrefix();
}

async function probeVersion(command: string, args = ["--version"], env?: NodeJS.ProcessEnv): Promise<ProbeResult> {
  const result = await runCapture(command, args, env);
  const output = toSingleLine(`${result.stdout}\n${result.stderr}`);

  if (result.code === 0 && output) {
    return { ok: true, value: output };
  }

  return { ok: false, note: output || "未检测到" };
}

async function probeNode() {
  if (process.platform === "win32") {
    return await probeVersion("node", ["-v"], buildEnv());
  }

  const result = await runShellCapture("node -v", buildEnv());
  const output = toSingleLine(`${result.stdout}\n${result.stderr}`);
  if (result.code === 0 && output) {
    return { ok: true, value: output };
  }

  return { ok: false, note: output || "系统环境中没有 node" };
}

async function probeNpm() {
  if (process.platform === "win32") {
    return await probeVersion("npm", ["-v"], buildEnv());
  }

  const result = await runShellCapture("npm -v", buildEnv());
  const output = toSingleLine(`${result.stdout}\n${result.stderr}`);
  if (result.code === 0 && output) {
    return { ok: true, value: output };
  }

  return { ok: false, note: output || "系统环境中没有 npm" };
}

async function probeOpenclaw() {
  const command = await resolveOpenclawBinary();
  if (!command) {
    return {
      ok: false,
      note: "未找到 openclaw，可先用本地模式安装到 ~/.openclaw",
    };
  }

  const result = await runCapture(command, ["--version"], buildEnv());
  const output = toSingleLine(`${result.stdout}\n${result.stderr}`);
  if (result.code === 0) {
    return {
      ok: true,
      value: output || "已安装",
      path: command,
    };
  }

  return {
    ok: false,
    path: command,
    note: output || "找到了命令，但无法读取版本",
  };
}

async function probePortableInstall() {
  const portable = portableBinaryPath();
  if (!(await exists(portable))) {
    return {
      ok: false,
      note: "没有检测到 ~/.openclaw/bin/openclaw",
      path: portable,
    };
  }

  return {
    ok: true,
    value: "已检测到本地可移植安装",
    path: portable,
  };
}

function createTask(action: LauncherAction) {
  return {
    id: `${action}-${Date.now()}`,
    action,
    label: actionLabels[action],
    startedAt: Date.now(),
  };
}

function emitTaskEvent(taskId: string, action: LauncherAction, kind: TaskEvent["kind"], data?: string, code?: number | null) {
  broadcast({
    taskId,
    action,
    kind,
    data,
    code,
  });
}

async function runTaskCommand(taskId: string, action: LauncherAction, spec: CommandSpec) {
  return await new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(spec.file, spec.args, {
      env: spec.env,
    });

    const entry = tasks.get(taskId);
    if (entry) {
      entry.child = child;
    }

    let stdout = "";
    let stderr = "";

    emitTaskEvent(taskId, action, "stdout", `$ ${[spec.file, ...spec.args].join(" ")}`);

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      emitTaskEvent(taskId, action, "stdout", text);
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      emitTaskEvent(taskId, action, "stderr", text);
    });

    child.on("error", (error) => {
      const current = tasks.get(taskId);
      if (current?.child === child) {
        current.child = undefined;
      }

      resolve({
        code: -1,
        stdout,
        stderr: error.message,
      });
    });

    child.on("close", (code) => {
      const current = tasks.get(taskId);
      if (current?.child === child) {
        current.child = undefined;
      }

      resolve({
        code,
        stdout,
        stderr,
      });
    });
  });
}

function startManagedTask(
  action: LauncherAction,
  runner: (context: {
    taskId: string;
    info: (message: string) => void;
    warn: (message: string) => void;
    runCommand: (spec: CommandSpec) => Promise<{ code: number | null; stdout: string; stderr: string }>;
  }) => Promise<void>,
): ActionResponse {
  const meta = createTask(action);
  tasks.set(meta.id, { meta });

  emitTaskEvent(meta.id, action, "start", actionLabels[action]);

  void runner({
    taskId: meta.id,
    info: (message) => emitTaskEvent(meta.id, action, "stdout", message),
    warn: (message) => emitTaskEvent(meta.id, action, "stderr", message),
    runCommand: (spec) => runTaskCommand(meta.id, action, spec),
  })
    .then(() => {
      tasks.delete(meta.id);
      emitTaskEvent(meta.id, action, "exit", "任务结束", 0);
    })
    .catch((error) => {
      tasks.delete(meta.id);
      emitTaskEvent(meta.id, action, "error", error instanceof Error ? error.message : String(error));
      emitTaskEvent(meta.id, action, "exit", "任务退出，状态码 1", 1);
    });

  return {
    ok: true,
    message: actionLabels[action],
    taskId: meta.id,
  };
}

async function applyInstallerSetupOverrides(setup: InstallerSetupPayload) {
  const configPath = configFilePath();
  const baseContent = (await exists(configPath)) ? await readFile(configPath, "utf8") : renderStarterConfig();
  const parsed = JSON5.parse(baseContent) as Record<string, unknown>;
  mergeInstallerSetupIntoConfig(parsed, setup);
  await saveConfig(JSON.stringify(parsed, null, 2));
}

async function enableInstallerPlugins(openclaw: string, setup: InstallerSetupPayload) {
  const pluginIds = pluginIdsForInstallerSetup(setup);
  const failures: string[] = [];

  for (const pluginId of pluginIds) {
    const result = await runCapture(openclaw, ["plugins", "enable", pluginId], buildEnv());
    if (result.code !== 0) {
      failures.push(`${pluginId}: ${toSingleLine(`${result.stderr}\n${result.stdout}`) || `exit ${result.code}`}`);
    }
  }

  return {
    pluginIds,
    failures,
  };
}

function startTask(action: LauncherAction, spec: CommandSpec): ActionResponse {
  const meta = createTask(action);
  const child = spawn(spec.file, spec.args, {
    env: spec.env,
  });

  tasks.set(meta.id, { meta, child });

  broadcast({
    taskId: meta.id,
    action,
    kind: "start",
    data: `${actionLabels[action]}\n$ ${[spec.file, ...spec.args].join(" ")}`,
  });

  child.stdout.on("data", (chunk) => {
    broadcast({
      taskId: meta.id,
      action,
      kind: "stdout",
      data: chunk.toString(),
    });
  });

  child.stderr.on("data", (chunk) => {
    broadcast({
      taskId: meta.id,
      action,
      kind: "stderr",
      data: chunk.toString(),
    });
  });

  child.on("error", (error) => {
    tasks.delete(meta.id);
    broadcast({
      taskId: meta.id,
      action,
      kind: "error",
      data: error.message,
    });
  });

  child.on("close", (code) => {
    tasks.delete(meta.id);
    broadcast({
      taskId: meta.id,
      action,
      kind: "exit",
      code,
      data: code === 0 ? "任务结束" : `任务退出，状态码 ${code}`,
    });
  });

  return {
    ok: true,
    message: actionLabels[action],
    taskId: meta.id,
  };
}

export async function applyInstallerSetup(setup: InstallerSetupPayload): Promise<ActionResponse> {
  const validationError = validateInstallerSetup(setup);
  if (validationError) {
    return {
      ok: false,
      message: validationError,
    };
  }

  const openclaw = await resolveOpenclawBinary();
  if (!openclaw) {
    return {
      ok: false,
      message: "没有找到 openclaw，请先完成安装。",
    };
  }

  const meta = createTask("applyInstallerSetup");
  const args = buildInstallerSetupCommand(setup, { nonInteractive: true, includeSecrets: true });
  const displayArgs = buildInstallerSetupCommand(setup, { nonInteractive: true, includeSecrets: false });
  const child = spawn(openclaw, args, { env: buildEnv() });

  tasks.set(meta.id, { meta, child });

  broadcast({
    taskId: meta.id,
    action: meta.action,
    kind: "start",
    data: `${actionLabels[meta.action]}\n$ ${[openclaw, ...displayArgs].join(" ")}`,
  });

  child.stdout.on("data", (chunk) => {
    broadcast({
      taskId: meta.id,
      action: meta.action,
      kind: "stdout",
      data: chunk.toString(),
    });
  });

  child.stderr.on("data", (chunk) => {
    broadcast({
      taskId: meta.id,
      action: meta.action,
      kind: "stderr",
      data: chunk.toString(),
    });
  });

  child.on("error", (error) => {
    tasks.delete(meta.id);
    broadcast({
      taskId: meta.id,
      action: meta.action,
      kind: "error",
      data: error.message,
    });
  });

  child.on("close", (code) => {
    void (async () => {
      if (code === 0) {
        try {
          await applyInstallerSetupOverrides(setup);
          broadcast({
            taskId: meta.id,
            action: meta.action,
            kind: "stdout",
            data: "ClawStart 已补充写入 workspace、搜索、渠道和维护默认项。",
          });

          const pluginSync = await enableInstallerPlugins(openclaw, setup);
          if (pluginSync.pluginIds.length > 0) {
            broadcast({
              taskId: meta.id,
              action: meta.action,
              kind: pluginSync.failures.length > 0 ? "stderr" : "stdout",
              data:
                pluginSync.failures.length > 0
                  ? `插件启用有失败项：${pluginSync.failures.join(" | ")}`
                  : `已自动启用渠道插件：${pluginSync.pluginIds.join(", ")}`,
            });
          }

          if (pluginSync.failures.length > 0) {
            tasks.delete(meta.id);
            broadcast({
              taskId: meta.id,
              action: meta.action,
              kind: "exit",
              code: 1,
              data: "安装字段已写入，但部分渠道插件启用失败。",
            });
            return;
          }
        } catch (error) {
          tasks.delete(meta.id);
          broadcast({
            taskId: meta.id,
            action: meta.action,
            kind: "error",
            data: error instanceof Error ? error.message : "无法补充写入安装配置。",
          });
          return;
        }
      }

      tasks.delete(meta.id);
      broadcast({
        taskId: meta.id,
        action: meta.action,
        kind: "exit",
        code,
        data: code === 0 ? "任务结束" : `任务退出，状态码 ${code}`,
      });
    })();
  });

  return {
    ok: true,
    message: actionLabels[meta.action],
    taskId: meta.id,
  };
}

function buildInstallCommand(portable: boolean): CommandSpec {
  if (process.platform === "win32") {
    return {
      file: "powershell.exe",
      args: [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        "iwr -useb https://openclaw.ai/install.ps1 | iex",
      ],
      env: buildEnv(),
    };
  }

  const shellSpec = getShellExecutable();
  const script = portable
    ? "curl -fsSL --proto '=https' --tlsv1.2 https://openclaw.ai/install-cli.sh | bash"
    : "curl -fsSL --proto '=https' --tlsv1.2 https://openclaw.ai/install.sh | bash";

  return {
    file: shellSpec.file,
    args: [...shellSpec.args, script],
    env: buildEnv(),
  };
}

async function buildUpgradeCommand() {
  const openclawPath = await resolveOpenclawBinary();
  const portablePath = portableBinaryPath();
  const usePortable = !openclawPath ? process.platform !== "win32" : openclawPath === portablePath;
  return buildInstallCommand(usePortable);
}

async function resolveLatestWindowsNodeMsi() {
  const arch = process.arch === "arm64" ? "arm64" : "x64";
  const token = `win-${arch}-msi`;
  const response = await fetch("https://nodejs.org/dist/index.json");

  if (!response.ok) {
    throw new Error(`无法获取 Node.js 版本列表（${response.status} ${response.statusText}）`);
  }

  const versions = (await response.json()) as Array<{
    version?: string;
    lts?: string | boolean;
    files?: string[];
  }>;

  const match = versions.find((entry) => entry.lts && entry.version && Array.isArray(entry.files) && entry.files.includes(token));
  if (!match?.version) {
    throw new Error(`没有找到适用于 Windows ${arch} 的 Node.js LTS 安装包。`);
  }

  return {
    version: match.version,
    url: `https://nodejs.org/dist/${match.version}/node-${match.version}-${arch}.msi`,
  };
}

async function installNodeOnWindows(
  runCommand: (spec: CommandSpec) => Promise<{ code: number | null; stdout: string; stderr: string }>,
  info: (message: string) => void,
  warn: (message: string) => void,
) {
  if (await commandExists("winget")) {
    info("检测到 winget，先尝试用 winget 安装 Node.js LTS。");
    const wingetResult = await runCommand({
      file: "winget",
      args: [
        "install",
        "OpenJS.NodeJS.LTS",
        "-e",
        "--accept-package-agreements",
        "--accept-source-agreements",
        "--disable-interactivity",
        "--silent",
      ],
      env: buildEnv(),
    });

    if (wingetResult.code === 0) {
      info("winget 已完成 Node.js LTS 安装。");
      return;
    }

    warn(`winget 安装 Node.js 失败，准备回退到官方 MSI。${toSingleLine(`${wingetResult.stderr}\n${wingetResult.stdout}`) || ""}`.trim());
  } else {
    info("当前机器没有可用的 winget，改用官方 MSI 安装 Node.js LTS。");
  }

  const latest = await resolveLatestWindowsNodeMsi();
  info(`正在下载 Node.js ${latest.version} 安装包。`);

  const response = await fetch(latest.url);
  if (!response.ok) {
    throw new Error(`下载 Node.js 安装包失败（${response.status} ${response.statusText}）`);
  }

  const downloadDir = path.join(os.tmpdir(), "ClawStart", "downloads");
  await mkdir(downloadDir, { recursive: true });
  const installerPath = path.join(downloadDir, `node-${latest.version}-${process.arch}.msi`);
  await writeFile(installerPath, Buffer.from(await response.arrayBuffer()));
  info(`Node.js 安装包已下载到 ${installerPath}`);

  const installResult = await runCommand({
    file: "msiexec.exe",
    args: ["/i", installerPath, "/passive", "/norestart"],
    env: buildEnv(),
  });

  if (![0, 3010, 1641].includes(installResult.code ?? -1)) {
    throw new Error(toSingleLine(`${installResult.stderr}\n${installResult.stdout}`) || "Node.js MSI 安装失败。");
  }

  info("Node.js LTS 已通过官方安装包完成安装。");
}

async function bootstrapEnvironment() {
  return startManagedTask("bootstrapEnvironment", async ({ info, warn, runCommand }) => {
    info("开始自动检测当前机器上的 Node.js、npm 和 OpenClaw。");

    let node = await probeNode();
    let npm = await probeNpm();
    let openclaw = await probeOpenclaw();

    info(`Node.js：${node.value || node.note || "未检测到"}`);
    info(`npm：${npm.value || npm.note || "未检测到"}`);
    info(`OpenClaw：${openclaw.value || openclaw.note || "未检测到"}`);

    if (process.platform === "win32" && (!node.ok || !npm.ok)) {
      info("当前 Windows 环境缺少 Node.js 或 npm，开始自动补齐。");
      await installNodeOnWindows(runCommand, info, warn);
      node = await probeNode();
      npm = await probeNpm();
      info(`重新检测 Node.js：${node.value || node.note || "未检测到"}`);
      info(`重新检测 npm：${npm.value || npm.note || "未检测到"}`);

      if (!node.ok || !npm.ok) {
        throw new Error("Node.js / npm 安装完成后仍无法检测到命令，请先关闭并重新打开 ClawStart 再试。");
      }
    }

    if (!openclaw.ok) {
      const installMode = process.platform === "win32" ? "官方推荐安装" : "本地可移植安装";
      info(`开始${installMode} OpenClaw CLI。`);
      const installResult = await runCommand(buildInstallCommand(process.platform !== "win32"));
      if (installResult.code !== 0) {
        throw new Error(toSingleLine(`${installResult.stderr}\n${installResult.stdout}`) || "OpenClaw 安装失败。");
      }

      openclaw = await probeOpenclaw();
      info(`重新检测 OpenClaw：${openclaw.value || openclaw.note || "未检测到"}`);
      if (!openclaw.ok) {
        throw new Error("OpenClaw 安装任务已经跑完，但当前仍然没有检测到可用的 openclaw 命令。");
      }
    }

    info("环境已准备完成，可以继续写入配置并进入 Onboarding。");
  });
}

async function buildOpenclawCommand(args: string[]): Promise<CommandSpec | undefined> {
  const openclaw = await resolveOpenclawBinary();
  if (!openclaw) {
    return undefined;
  }

  return {
    file: openclaw,
    args,
    env: buildEnv(),
  };
}

export async function getSystemInfo(): Promise<SystemInfo> {
  const configState = await getConfigState();
  const dashboardUrl = dashboardUrlFromSummary(configState.valid ? configState.summary : undefined);
  const dashboardProbe = await probeHttpService(dashboardUrl);

  return {
    platform: process.platform,
    arch: process.arch,
    shell: process.platform === "win32" ? "PowerShell" : expandHome(process.env.SHELL || "/bin/bash"),
    dashboardUrl,
    configPath: configFilePath(),
    defaultWorkspacePath: defaultWorkspacePath(),
    recommendedInstallMode: process.platform === "win32" ? "recommended" : "portable",
    checks: {
      node: await probeNode(),
      npm: await probeNpm(),
      openclaw: await probeOpenclaw(),
      portableInstall: await probePortableInstall(),
    },
    services: {
      dashboard: dashboardProbe,
      gateway: dashboardProbe.ok
        ? { ok: true, value: dashboardProbe.value, note: "Dashboard 已响应，Gateway 当前可达。" }
        : { ok: false, note: dashboardProbe.note || "当前没有检测到本地 Gateway 响应。" },
    },
    tasks: taskList(),
  };
}

export async function getConfigState(): Promise<ConfigState> {
  const template = renderStarterConfig();
  const configPath = configFilePath();

  if (!(await exists(configPath))) {
    const parsedTemplate = JSON5.parse(template);
    return {
      path: configPath,
      exists: false,
      valid: true,
      content: template,
      template,
      summary: await buildConfigSummary(parsedTemplate),
    };
  }

  const content = await readFile(configPath, "utf8");

  try {
    const parsed = JSON5.parse(content);
    return {
      path: configPath,
      exists: true,
      valid: true,
      content,
      template,
      summary: await buildConfigSummary(parsed),
    };
  } catch (error) {
    return {
      path: configPath,
      exists: true,
      valid: false,
      content,
      template,
      parseError: parseErrorMessage(error),
      summary: await buildConfigSummary(),
    };
  }
}

export async function saveConfig(content: string): Promise<SaveConfigResponse> {
  const configPath = configFilePath();

  let parsed: unknown;
  try {
    parsed = JSON5.parse(content);
  } catch (error) {
    return {
      ok: false,
      message: `配置无效：${parseErrorMessage(error)}`,
      path: configPath,
    };
  }

  await ensureParentDirectory(configPath);

  let backupPath: string | undefined;
  if (await exists(configPath)) {
    backupPath = `${configPath}.bak-${makeTimestamp()}`;
    await copyFile(configPath, backupPath);
  }

  await writeFile(configPath, content.endsWith("\n") ? content : `${content}\n`, "utf8");

  const workspace = (await buildConfigSummary(parsed)).workspace;
  const resolvedWorkspace = workspace ? resolveWritablePath(workspace) : undefined;
  if (resolvedWorkspace) {
    await mkdir(resolvedWorkspace, { recursive: true });
  }

  return {
    ok: true,
    message: backupPath ? "配置已保存，并备份了旧文件。" : "配置已保存。",
    path: configPath,
    backupPath,
  };
}

export async function revealPath(targetPath: string): Promise<ActionResponse> {
  const resolvedTarget = expandHome(targetPath);
  const targetExists = await exists(resolvedTarget);

  if (targetExists) {
    const details = await stat(resolvedTarget);
    if (details.isDirectory()) {
      const error = await shell.openPath(resolvedTarget);
      return {
        ok: !error,
        message: error || "已打开目录。",
      };
    }

    shell.showItemInFolder(resolvedTarget);
    return {
      ok: true,
      message: "已在系统文件管理器中定位路径。",
    };
  }

  const fallbackDir = path.extname(resolvedTarget) ? path.dirname(resolvedTarget) : resolvedTarget;
  await mkdir(fallbackDir, { recursive: true });
  const error = await shell.openPath(fallbackDir);

  return {
    ok: !error,
    message: error || "已打开目录。",
  };
}

async function runOnboardingInTerminal() {
  const openclaw = await resolveOpenclawBinary();
  if (!openclaw) {
    return {
      ok: false,
      message: "没有找到 openclaw，请先完成安装。",
    };
  }

  return await runCommandInSystemTerminal(`"${openclaw}" onboard --install-daemon`, {
    macos: "已在 Terminal 中打开 onboarding。",
    windows: "已在 PowerShell 中打开 onboarding。",
    linux: "已在终端中打开 onboarding。",
    missingTerminal: "没有找到可用的终端模拟器，无法打开 onboarding。",
  });
}

async function runCommandInSystemTerminal(
  command: string,
  messages: {
    macos: string;
    windows: string;
    linux: string;
    missingTerminal: string;
  },
) {
  const openclaw = await resolveOpenclawBinary();
  if (!openclaw) {
    return {
      ok: false,
      message: "没有找到 openclaw，请先完成安装。",
    };
  }

  if (process.platform === "darwin") {
    const script = [
      "tell application \"Terminal\"",
      `do script ${JSON.stringify(command)}`,
      "activate",
      "end tell",
    ].join("\n");

    const result = await runCapture("osascript", ["-e", script]);
    return {
      ok: result.code === 0,
      message: result.code === 0 ? messages.macos : result.stderr || "无法打开 Terminal。",
    };
  }

  if (process.platform === "win32") {
    const result = await runCapture("cmd.exe", [
      "/c",
      "start",
      "powershell.exe",
      "-NoExit",
      "-Command",
      command,
    ]);

    return {
      ok: result.code === 0,
      message: result.code === 0 ? messages.windows : result.stderr || "无法打开 PowerShell。",
    };
  }

  const emulators = [
    ["x-terminal-emulator", "-e", command],
    ["gnome-terminal", "--", process.env.SHELL || "/bin/bash", "-lc", command],
    ["konsole", "-e", command],
    ["xfce4-terminal", "-e", command],
    ["xterm", "-e", command],
  ];

  for (const candidate of emulators) {
    if (await commandExists(candidate[0])) {
      const result = await runCapture(candidate[0], candidate.slice(1));
      if (result.code === 0) {
        return {
          ok: true,
          message: messages.linux,
        };
      }
    }
  }

  return {
    ok: false,
    message: messages.missingTerminal,
  };
}

export async function loginOpenaiCodex() {
  const openclaw = await resolveOpenclawBinary();
  if (!openclaw) {
    return {
      ok: false,
      message: "没有找到 openclaw，请先完成安装。",
    };
  }

  return await runCommandInSystemTerminal(`"${openclaw}" models auth login --provider openai-codex`, {
    macos: "已在 Terminal 中打开 OpenAI Codex 登录，浏览器会继续完成 OAuth。",
    windows: "已在 PowerShell 中打开 OpenAI Codex 登录，浏览器会继续完成 OAuth。",
    linux: "已在终端中打开 OpenAI Codex 登录，浏览器会继续完成 OAuth。",
    missingTerminal: "没有找到可用的终端模拟器，无法打开 OpenAI Codex 登录。",
  });
}

export async function stopTask(taskId: string): Promise<ActionResponse> {
  const current = tasks.get(taskId);
  if (!current) {
    return {
      ok: false,
      message: "任务已经结束。",
    };
  }

  current.child?.kill("SIGTERM");
  tasks.delete(taskId);

  broadcast({
    taskId,
    action: current.meta.action,
    kind: "exit",
    code: 0,
    data: "任务已停止",
  });

  return {
    ok: true,
    message: "任务已停止。",
  };
}

export async function openDashboardUrl() {
  const configState = await getConfigState();
  await shell.openExternal(dashboardUrlFromSummary(configState.valid ? configState.summary : undefined));
  return {
    ok: true,
    message: "已在默认浏览器中打开 Dashboard。",
  };
}

export async function stopTasksByActions(actions: LauncherAction[]) {
  let stoppedCount = 0;

  for (const [taskId, current] of tasks.entries()) {
    if (!actions.includes(current.meta.action)) {
      continue;
    }

    current.child?.kill("SIGTERM");
    tasks.delete(taskId);
    stoppedCount += 1;

    broadcast({
      taskId,
      action: current.meta.action,
      kind: "exit",
      code: 0,
      data: "任务已停止",
    });
  }

  return {
    stoppedCount,
  };
}

export async function runAction(action: LauncherAction): Promise<ActionResponse> {
  if (action === "applyInstallerSetup") {
    return {
      ok: false,
      message: "请通过安装向导提交安装字段，而不是直接调用通用动作。",
    };
  }

  if (action === "bootstrapEnvironment") {
    return await bootstrapEnvironment();
  }

  if (action === "installPortable") {
    return startTask(action, buildInstallCommand(true));
  }

  if (action === "installRecommended") {
    return startTask(action, buildInstallCommand(false));
  }

  if (action === "upgradeOpenclaw") {
    return startTask(action, await buildUpgradeCommand());
  }

  if (action === "runDoctor") {
    const spec = await buildOpenclawCommand(["doctor"]);
    if (!spec) {
      return { ok: false, message: "没有找到 openclaw，请先安装。" };
    }

    return startTask(action, spec);
  }

  if (action === "runStatus") {
    const spec = await buildOpenclawCommand(["status"]);
    if (!spec) {
      return { ok: false, message: "没有找到 openclaw，请先安装。" };
    }

    return startTask(action, spec);
  }

  if (action === "runDashboard") {
    const spec = await buildOpenclawCommand(["dashboard"]);
    if (!spec) {
      return { ok: false, message: "没有找到 openclaw，请先安装。" };
    }

    return startTask(action, spec);
  }

  const spec = await buildOpenclawCommand(["gateway"]);
  if (!spec) {
    return { ok: false, message: "没有找到 openclaw，请先安装。" };
  }

  return startTask(action, spec);
}

export { runOnboardingInTerminal };
export { buildEnv, getStarterConfigTemplate, resolveOpenclawBinary };

function getStarterConfigTemplate() {
  return renderStarterConfig();
}
