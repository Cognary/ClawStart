import { access, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { ActionResponse } from "./types";
import { getConfigState, getStarterConfigTemplate, saveConfig, stopTasksByActions } from "./openclaw";

interface PortOwner {
  pid: number;
  command: string;
}

const PATH_MARKER_START = "# >>> ClawStart OpenClaw PATH >>>";
const PATH_MARKER_END = "# <<< ClawStart OpenClaw PATH <<<";

async function exists(targetPath: string) {
  try {
    await access(targetPath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
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

async function runCapture(file: string, args: string[]) {
  return await new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(file, args, {
      env: process.env,
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

function shellFamily() {
  const shell = process.env.SHELL || "";
  const name = path.basename(shell);

  if (name === "fish") {
    return "fish";
  }

  if (name === "bash") {
    return "bash";
  }

  if (name === "zsh") {
    return "zsh";
  }

  return "sh";
}

async function defaultShellProfilePath() {
  const family = shellFamily();

  if (family === "fish") {
    return path.join(os.homedir(), ".config", "fish", "config.fish");
  }

  if (family === "zsh") {
    return path.join(os.homedir(), ".zshrc");
  }

  if (family === "bash") {
    const candidates = process.platform === "darwin"
      ? [".bash_profile", ".bashrc"]
      : [".bashrc", ".profile"];

    for (const candidate of candidates) {
      const target = path.join(os.homedir(), candidate);
      if (await exists(target)) {
        return target;
      }
    }

    return path.join(os.homedir(), candidates[0]);
  }

  return path.join(os.homedir(), ".profile");
}

function pathSnippet() {
  const target = "$HOME/.openclaw/bin";
  const family = shellFamily();

  if (family === "fish") {
    return [
      PATH_MARKER_START,
      `if not contains "${target}" $PATH`,
      `  fish_add_path "${target}"`,
      "end",
      PATH_MARKER_END,
      "",
    ].join("\n");
  }

  return [
    PATH_MARKER_START,
    `export PATH="${target}:$PATH"`,
    PATH_MARKER_END,
    "",
  ].join("\n");
}

function looksConfigured(content: string) {
  return content.includes(PATH_MARKER_START) || content.includes(".openclaw/bin");
}

async function detectPortOwners(port: number): Promise<PortOwner[]> {
  if (process.platform === "win32") {
    const psCommand = [
      "$connections = Get-NetTCPConnection -State Listen -LocalPort " + port + " -ErrorAction SilentlyContinue;",
      "foreach ($c in $connections) {",
      '  $proc = Get-CimInstance Win32_Process -Filter "ProcessId = $($c.OwningProcess)" -ErrorAction SilentlyContinue;',
      '  if ($proc) { Write-Output "$($c.OwningProcess)|$($proc.CommandLine)" }',
      "}",
    ].join(" ");
    const result = await runCapture("powershell.exe", ["-NoProfile", "-Command", psCommand]);
    return result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [pidText, ...commandParts] = line.split("|");
        return {
          pid: Number(pidText),
          command: commandParts.join("|").trim(),
        };
      })
      .filter((item) => Number.isFinite(item.pid) && item.command);
  }

  const lsof = await runCapture("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"]);
  const pids = lsof.stdout
    .split(/\r?\n/)
    .map((line) => Number(line.trim()))
    .filter((value) => Number.isFinite(value) && value > 0);

  const owners: PortOwner[] = [];
  for (const pid of pids) {
    const result = await runCapture("ps", ["-p", String(pid), "-o", "command="]);
    const command = result.stdout.trim();
    if (command) {
      owners.push({ pid, command });
    }
  }

  return owners;
}

function canSafelyTerminate(command: string) {
  return /openclaw|\.openclaw|gateway|dashboard/i.test(command);
}

export async function repairShellPathForOpenclaw(): Promise<ActionResponse> {
  if (process.platform === "win32") {
    return {
      ok: false,
      message: "Windows 的 PATH 自动修复暂未实现，请先使用官方推荐安装方式。",
    };
  }

  const profilePath = await defaultShellProfilePath();
  await mkdir(path.dirname(profilePath), { recursive: true });

  const currentContent = (await exists(profilePath)) ? await readFile(profilePath, "utf8") : "";
  if (looksConfigured(currentContent)) {
    return {
      ok: true,
      message: `检测到 ${profilePath} 已经包含 OpenClaw PATH 配置，重新打开终端后再试。`,
    };
  }

  let backupPath: string | undefined;
  if (currentContent) {
    backupPath = `${profilePath}.bak-${makeTimestamp()}`;
    await copyFile(profilePath, backupPath);
  }

  const separator = currentContent && !currentContent.endsWith("\n") ? "\n" : "";
  await writeFile(profilePath, `${currentContent}${separator}${pathSnippet()}`, "utf8");

  return {
    ok: true,
    message: backupPath
      ? `已把 OpenClaw PATH 写入 ${profilePath}，并备份了旧文件。重新打开终端后生效。`
      : `已把 OpenClaw PATH 写入 ${profilePath}。重新打开终端后生效。`,
  };
}

export async function restoreConfigFromStarter(): Promise<ActionResponse> {
  const result = await saveConfig(getStarterConfigTemplate());
  return {
    ok: result.ok,
    message: result.ok ? "已用 starter 模板重建配置文件。" : result.message,
  };
}

export async function repairDashboardPortConflict(): Promise<ActionResponse> {
  const stopResult = await stopTasksByActions(["runDashboard", "startGateway"]);
  if (stopResult.stoppedCount > 0) {
    return {
      ok: true,
      message: `已停止 ${stopResult.stoppedCount} 个由 ClawStart 启动的 dashboard/gateway 任务。`,
    };
  }

  const configState = await getConfigState();
  const targetPort = configState.summary.gatewayPort || 18789;
  const owners = await detectPortOwners(targetPort);

  if (owners.length === 0) {
    return {
      ok: false,
      message: `没有检测到 ${targetPort} 端口上的监听进程。请重新运行 dashboard 或 gateway。`,
    };
  }

  const safeOwners = owners.filter((owner) => canSafelyTerminate(owner.command));
  if (safeOwners.length === 0) {
    return {
      ok: false,
      message: `检测到 ${targetPort} 端口被外部进程占用，但不是明显的 OpenClaw 进程，请先手动确认后再处理。`,
    };
  }

  for (const owner of safeOwners) {
    try {
      process.kill(owner.pid, "SIGTERM");
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "无法终止占用端口的进程。",
      };
    }
  }

  return {
    ok: true,
    message: `已尝试终止 ${safeOwners.length} 个占用 ${targetPort} 端口的 OpenClaw 相关进程。`,
  };
}
