import os from "node:os";
import path from "node:path";
import { BrowserWindow } from "electron";
import { buildEnv, resolveOpenclawBinary } from "./openclaw";
import { buildInstallerSetupCommand } from "./installerSetup";
import {
  ActionResponse,
  InstallerSetupPayload,
  TerminalActionResponse,
  TerminalEvent,
  TerminalSession,
  TerminalSessionKind,
} from "./types";

type PtyModule = typeof import("node-pty");
type PtyProcess = import("node-pty").IPty;

interface TerminalEntry {
  meta: TerminalSession;
  process?: PtyProcess;
  buffer: string;
}

const sessions = new Map<string, TerminalEntry>();
let cachedNodePty: PtyModule | null | undefined;
let cachedNodePtyError: string | undefined;

function getNodePty() {
  if (cachedNodePty !== undefined) {
    return cachedNodePty;
  }

  try {
    cachedNodePty = require("node-pty") as PtyModule;
    cachedNodePtyError = undefined;
  } catch (error) {
    cachedNodePty = null;
    cachedNodePtyError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  }

  return cachedNodePty;
}

function nodePtyUnavailableMessage() {
  return `应用内终端当前不可用，node-pty 没有在这台机器上正确加载。你仍然可以先使用系统终端继续安装或维护 OpenClaw。${cachedNodePtyError ? `\n\n详细原因：${cachedNodePtyError}` : ""}`;
}

function shellQuote(value: string) {
  if (/^[A-Za-z0-9_./:=+-]+$/.test(value)) {
    return value;
  }

  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function broadcast(event: TerminalEvent) {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send("launcher:terminal-event", event);
  }
}

function toPtyEnv(source: NodeJS.ProcessEnv) {
  const env: Record<string, string> = {};

  for (const [key, value] of Object.entries(source)) {
    if (typeof value === "string") {
      env[key] = value;
    }
  }

  return env;
}

function shellSpec(command?: string) {
  if (process.platform === "win32") {
    return command
      ? {
          file: "powershell.exe",
          args: ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
        }
      : {
          file: "powershell.exe",
          args: ["-NoLogo"],
        };
  }

  const shell = process.env.SHELL || "/bin/bash";

  return command
    ? {
        file: shell,
        args: ["-lc", command],
      }
    : {
        file: shell,
        args: ["-l"],
      };
}

function listSessions() {
  return Array.from(sessions.values())
    .map((entry) => entry.meta)
    .sort((left, right) => right.startedAt - left.startedAt);
}

function findRunningSession(kind: TerminalSessionKind) {
  return listSessions().find((session) => session.kind === kind && session.running);
}

export function getTerminalSessions() {
  return listSessions();
}

export function getTerminalSnapshot() {
  return {
    sessions: listSessions(),
    buffers: Object.fromEntries(Array.from(sessions.entries()).map(([id, entry]) => [id, entry.buffer])),
  };
}

export async function openTerminalSession(
  kind: TerminalSessionKind,
  setup?: InstallerSetupPayload,
): Promise<TerminalActionResponse> {
  const nodePty = getNodePty();
  if (!nodePty) {
    return {
      ok: false,
      message: nodePtyUnavailableMessage(),
    };
  }

  const current = findRunningSession(kind);
  if (current) {
    return {
      ok: true,
      message: "已有相同类型的终端会话在运行。",
      sessionId: current.id,
    };
  }

  let command: string | undefined;
  let label: string;

  if (kind === "onboarding") {
    const openclaw = await resolveOpenclawBinary();
    if (!openclaw) {
      return {
        ok: false,
        message: "没有找到 openclaw，请先完成安装。",
      };
    }

    const args = setup
      ? buildInstallerSetupCommand(setup, { nonInteractive: false, includeSecrets: false })
      : ["onboard", "--install-daemon"];
    command = [shellQuote(openclaw), ...args.map(shellQuote)].join(" ");
    label = "应用内 Onboarding";
  } else {
    label = "应用内调试 Shell";
  }

  const spec = shellSpec(command);
  const meta: TerminalSession = {
    id: `${kind}-${Date.now()}`,
    kind,
    label,
    command: command || spec.file,
    startedAt: Date.now(),
    running: true,
  };
  const startBanner = `${label}\n$ ${command || spec.file}`;

  const ptyProcess = nodePty.spawn(spec.file, spec.args, {
    name: "xterm-color",
    cols: 120,
    rows: 34,
    cwd: os.homedir(),
    env: toPtyEnv(buildEnv()),
  });

  sessions.set(meta.id, { meta, process: ptyProcess, buffer: startBanner });

  broadcast({
    sessionId: meta.id,
    kind: "start",
    data: startBanner,
  });

  ptyProcess.onData((data) => {
    const entry = sessions.get(meta.id);
    if (entry) {
      entry.buffer = `${entry.buffer}${data}`.slice(-160000);
    }

    broadcast({
      sessionId: meta.id,
      kind: "data",
      data,
    });
  });

  ptyProcess.onExit(({ exitCode }) => {
    const entry = sessions.get(meta.id);
    if (!entry) {
      return;
    }

    entry.meta.running = false;
    entry.meta.exitCode = exitCode;
    entry.process = undefined;
    entry.buffer = `${entry.buffer}\n终端退出，状态码 ${exitCode}`.slice(-160000);

    broadcast({
      sessionId: meta.id,
      kind: "exit",
      exitCode,
      data: `终端退出，状态码 ${exitCode}`,
    });
  });

  return {
    ok: true,
    message: `${label}已打开。`,
    sessionId: meta.id,
  };
}

export async function writeTerminal(sessionId: string, data: string): Promise<ActionResponse> {
  const entry = sessions.get(sessionId);
  if (!entry?.process || !entry.meta.running) {
    return {
      ok: false,
      message: "终端会话已经结束。",
    };
  }

  entry.process.write(data);
  return {
    ok: true,
    message: "输入已发送。",
  };
}

export async function resizeTerminal(sessionId: string, cols: number, rows: number): Promise<ActionResponse> {
  const entry = sessions.get(sessionId);
  if (!entry?.process || !entry.meta.running) {
    return {
      ok: false,
      message: "终端会话已经结束。",
    };
  }

  entry.process.resize(Math.max(cols, 40), Math.max(rows, 12));
  return {
    ok: true,
    message: "终端尺寸已更新。",
  };
}

export async function closeTerminalSession(sessionId: string): Promise<ActionResponse> {
  const entry = sessions.get(sessionId);
  if (!entry?.process || !entry.meta.running) {
    return {
      ok: false,
      message: "终端会话已经结束。",
    };
  }

  entry.process.kill();
  return {
    ok: true,
    message: "终端会话已关闭。",
  };
}
