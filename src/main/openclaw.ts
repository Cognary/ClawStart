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

const tasks = new Map<string, { meta: RunningTask; child: ChildProcessWithoutNullStreams }>();

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

function buildEnv() {
  const pathEntries = [portableBinDir(), process.env.PATH || ""];

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
    const result = await runCapture("cmd.exe", ["/c", "where", command]);
    return result.code === 0;
  }

  const result = await runShellCapture(`command -v ${command} >/dev/null 2>&1`);
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

async function runShellCapture(command: string) {
  const shellSpec = getShellExecutable();
  return await runCapture(shellSpec.file, [...shellSpec.args, command]);
}

async function locateOpenclawFromPath() {
  if (process.platform === "win32") {
    const result = await runShellCapture(
      "(Get-Command openclaw -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source) -join \"`n\"",
    );

    const located = toSingleLine(result.stdout);
    return located || undefined;
  }

  const result = await runShellCapture("command -v openclaw || true");
  const located = toSingleLine(result.stdout);
  return located || undefined;
}

async function locateOpenclawFromNpmPrefix() {
  const prefix = await runShellCapture("npm config get prefix");
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
    return await probeVersion("node", ["-v"]);
  }

  const result = await runShellCapture("node -v");
  const output = toSingleLine(`${result.stdout}\n${result.stderr}`);
  if (result.code === 0 && output) {
    return { ok: true, value: output };
  }

  return { ok: false, note: output || "系统环境中没有 node" };
}

async function probeNpm() {
  if (process.platform === "win32") {
    return await probeVersion("npm", ["-v"]);
  }

  const result = await runShellCapture("npm -v");
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

  current.child.kill("SIGTERM");
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

    current.child.kill("SIGTERM");
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
