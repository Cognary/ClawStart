import { startTransition, useDeferredValue, useEffect, useEffectEvent, useRef, useState } from "react";
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
  TerminalSession,
  TerminalSessionKind,
} from "../main/types";
import AppShell from "./app/AppShell";
import {
  launcherActionTitles,
  type AppSurface,
  type InstallerSupportTab,
  type IntentControls,
  type LogEntry,
  type SetupIntent,
  type TerminalControls,
  type WorkspacePanel,
} from "./app/model";
import { deriveAppModel } from "./app/selectors";
import { installerSetupFromConfig } from "./installer/setupDraft";

function isLauncherIntent(intent: SetupIntent): intent is LauncherAction {
  return intent in launcherActionTitles;
}

export default function App() {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [configState, setConfigState] = useState<ConfigState | null>(null);
  const [appUpdateState, setAppUpdateState] = useState<AppUpdateState | null>(null);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [surfacePreference, setSurfacePreference] = useState<AppSurface>("installer");
  const [installerSupportTab, setInstallerSupportTab] = useState<InstallerSupportTab>("issues");
  const [workspacePanel, setWorkspacePanel] = useState<WorkspacePanel>("diagnostics");
  const [configDraft, setConfigDraft] = useState("");
  const [configDirty, setConfigDirty] = useState(false);
  const [installerSetup, setInstallerSetup] = useState<InstallerSetupPayload | null>(null);
  const [installerSetupDirty, setInstallerSetupDirty] = useState(false);
  const [terminalSessions, setTerminalSessions] = useState<TerminalSession[]>([]);
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null);
  const [terminalBuffers, setTerminalBuffers] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("正在检测当前机器上的 OpenClaw 环境...");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const deferredLogs = useDeferredValue(logs);
  const autoBootstrapTriggeredRef = useRef(false);

  const refreshAll = useEffectEvent(async (forceConfigDraft = false, forceInstallerSetup = false) => {
    const [info, config, updateState, terminalSnapshot] = await Promise.all([
      window.clawstart.getSystemInfo(),
      window.clawstart.getConfigState(),
      window.clawstart.getAppUpdateState(),
      window.clawstart.getTerminalSnapshot(),
    ]);
    const sessions = terminalSnapshot.sessions;

    setSystemInfo(info);
    setConfigState(config);
    setAppUpdateState(updateState);
    setTerminalSessions(sessions);
    setTerminalBuffers(terminalSnapshot.buffers);
    setActiveTerminalId((current) => {
      if (current && sessions.some((session) => session.id === current)) {
        return current;
      }

      return sessions[0]?.id || null;
    });

    if (forceConfigDraft || !configDirty) {
      setConfigDraft(config.content);
      setConfigDirty(false);
    }

    if (forceInstallerSetup || !installerSetupDirty || !installerSetup) {
      setInstallerSetup(installerSetupFromConfig(config, info));
      setInstallerSetupDirty(false);
    }
  });

  const appendLog = useEffectEvent((event: TaskEvent) => {
    startTransition(() => {
      setLogs((current) => [
        {
          id: `${event.taskId}-${current.length}-${Date.now()}`,
          taskId: event.taskId,
          kind: event.kind,
          text: event.data || "",
          action: event.action,
          code: event.code,
        },
        ...current,
      ].slice(0, 200));
    });

    if (event.kind === "start") {
      setMessage(`${launcherActionTitles[event.action]} 已开始，请等待结果。`);
    }

    if (event.kind === "exit") {
      setMessage(
        event.code === 0
          ? `${launcherActionTitles[event.action]} 已完成。`
          : `${launcherActionTitles[event.action]} 失败，退出码 ${event.code ?? "-"}`,
      );
    }

    if (event.kind === "error") {
      setMessage(`${launcherActionTitles[event.action]} 失败：${event.data || "未知错误"}`);
    }

    if (event.kind === "exit" || event.kind === "error") {
      void refreshAll(false, false);
    }
  });

  const appendTerminalEvent = useEffectEvent((event: TerminalEvent) => {
    startTransition(() => {
      setTerminalBuffers((current) => {
        const nextData = `${current[event.sessionId] || ""}${event.data || ""}`;

        return {
          ...current,
          [event.sessionId]: nextData.slice(-160000),
        };
      });
    });

    if (event.kind === "start") {
      setActiveTerminalId(event.sessionId);
      setMessage("应用内终端已打开。");
    }

    if (event.kind === "exit") {
      setMessage(`终端会话已退出（${event.exitCode ?? 0}）。`);
    }

    if (event.kind === "error") {
      setMessage(`终端会话失败：${event.data || "未知错误"}`);
    }

    if (event.kind === "start" || event.kind === "exit" || event.kind === "error") {
      void refreshAll(false, false);
    }
  });

  useEffect(() => {
    void refreshAll(true, true);

    const detachTask = window.clawstart.onTaskEvent((event) => {
      appendLog(event);
    });
    const detachTerminal = window.clawstart.onTerminalEvent((event) => {
      appendTerminalEvent(event);
    });
    const detachUpdate = window.clawstart.onUpdateState((state) => {
      setAppUpdateState(state);

      if (state.status === "available" || state.status === "not-available" || state.status === "downloaded" || state.status === "error") {
        setMessage(state.message);
      }
    });

    return () => {
      detachTask();
      detachTerminal();
      detachUpdate();
    };
  }, [appendLog, appendTerminalEvent, refreshAll]);

  useEffect(() => {
    if (!isUpdateDialogOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsUpdateDialogOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isUpdateDialogOpen]);

  const successfulActions = new Set(logs.filter((entry) => entry.kind === "exit" && entry.code === 0).map((entry) => entry.action));
  const canOperate = Boolean(
    systemInfo &&
      configState &&
      systemInfo.checks.openclaw.ok &&
      configState.exists &&
      configState.valid &&
      Boolean(configState.summary.workspace) &&
      (successfulActions.has("runDoctor") || successfulActions.has("runStatus")),
  );

  useEffect(() => {
    if (!canOperate) {
      setSurfacePreference("installer");
      return;
    }

    setSurfacePreference((current) => (current === "workspace" ? current : "workspace"));
  }, [canOperate]);

  useEffect(() => {
    if (!systemInfo || !configState) {
      return;
    }

    const installed = systemInfo.checks.openclaw.ok;
    const ready = configState.exists && configState.valid && Boolean(configState.summary.workspace);
    const verified = successfulActions.has("runDoctor") || successfulActions.has("runStatus");
    const onboardingSession = terminalSessions.find(
      (session) => session.kind === "onboarding" && (session.running || session.exitCode === 0),
    );

    if (!installed || !ready || !verified) {
      setWorkspacePanel("diagnostics");
    }

    if (!installed || !ready || (!onboardingSession && !verified)) {
      setInstallerSupportTab("issues");
      return;
    }

    setInstallerSupportTab("output");
  }, [configState, successfulActions, systemInfo, terminalSessions]);

  async function runCommand(action: LauncherAction) {
    setBusyAction(action);
    const result = await window.clawstart.runAction(action);
    setBusyAction(null);
    setMessage(result.message);
    await refreshAll(false);
  }

  async function runMethod(kind: "openDashboardUrl" | "openOnboardingTerminal") {
    setBusyAction(kind);
    const result =
      kind === "openDashboardUrl"
        ? await window.clawstart.openDashboardUrl()
        : await window.clawstart.openOnboardingTerminal();
    setBusyAction(null);
    setMessage(result.message);
    await refreshAll(false);
  }

  async function loginWithOpenaiCodex() {
    setBusyAction("loginOpenaiCodex");
    const result = await window.clawstart.loginOpenaiCodex();
    setBusyAction(null);
    setMessage(result.message);
    await refreshAll(false);
  }

  async function saveCurrentConfig() {
    setBusyAction("saveConfig");
    const result: SaveConfigResponse = await window.clawstart.saveConfig(configDraft);
    setBusyAction(null);
    setMessage(result.message);

    if (result.ok) {
      setConfigDirty(false);
      await refreshAll(true);
    }
  }

  async function applyCurrentInstallerSetup() {
    if (!installerSetup) {
      return;
    }

    setBusyAction("applyInstallerSetup");
    const result = await window.clawstart.applyInstallerSetup(installerSetup);
    setBusyAction(null);
    setMessage(result.message);
    await refreshAll(false, false);
  }

  async function revealPath(targetPath: string, busyKey: "revealConfigPath" | "revealWorkspacePath") {
    setBusyAction(busyKey);
    const result = await window.clawstart.revealPath(targetPath);
    setBusyAction(null);
    setMessage(result.message);
  }

  async function reloadConfigFromDisk() {
    setBusyAction("reloadConfig");
    await refreshAll(true);
    setBusyAction(null);
    setMessage("已重新加载本地配置文件。");
  }

  async function refreshManually() {
    setBusyAction("refreshAll");
    await refreshAll(false);
    setBusyAction(null);
    setMessage("已重新检测系统与配置状态。");
  }

  async function stopTask(taskId: string) {
    setBusyAction(taskId);
    const result = await window.clawstart.stopTask(taskId);
    setBusyAction(null);
    setMessage(result.message);
    await refreshAll(false);
  }

  async function openIntegratedTerminal(kind: TerminalSessionKind) {
    const busyKey = kind === "onboarding" ? "openTerminalOnboarding" : "openTerminalShell";
    setBusyAction(busyKey);
    const result =
      kind === "onboarding"
        ? await window.clawstart.openTerminalSession(kind, installerSetup || undefined)
        : await window.clawstart.openTerminalSession(kind);
    setBusyAction(null);
    setMessage(result.message);

    if (result.sessionId) {
      setActiveTerminalId(result.sessionId);
    }

    await refreshAll(false);
  }

  async function runAppUpdateAction(intent: "checkAppUpdates" | "downloadAppUpdate" | "installAppUpdate") {
    setBusyAction(intent);

    const result: ActionResponse =
      intent === "checkAppUpdates"
        ? await window.clawstart.checkForAppUpdates()
        : intent === "downloadAppUpdate"
          ? await window.clawstart.downloadAppUpdate()
          : await window.clawstart.installAppUpdate();

    setBusyAction(null);
    setMessage(result.message);

    if (intent !== "installAppUpdate") {
      const latest = await window.clawstart.getAppUpdateState();
      setAppUpdateState(latest);
    }
  }

  async function closeActiveTerminal() {
    if (!activeTerminalId) {
      return;
    }

    setBusyAction("closeTerminal");
    const result = await window.clawstart.closeTerminalSession(activeTerminalId);
    setBusyAction(null);
    setMessage(result.message);
    await refreshAll(false);
  }

  const sendTerminalInput = useEffectEvent((data: string) => {
    if (!activeTerminalId) {
      return;
    }

    void window.clawstart.writeTerminal(activeTerminalId, data);
  });

  const resizeTerminal = useEffectEvent((cols: number, rows: number) => {
    if (!activeTerminalId) {
      return;
    }

    void window.clawstart.resizeTerminal(activeTerminalId, cols, rows);
  });

  function resetConfigDraft() {
    if (!configState) {
      return;
    }

    setConfigDraft(configState.template);
    setConfigDirty(true);
    setMessage("已恢复为 starter 配置模板，记得点击保存。");
  }

  async function runIntent(intent: SetupIntent) {
    if (intent === "applyInstallerSetup") {
      await applyCurrentInstallerSetup();
      return;
    }

    if (intent === "saveConfig") {
      await saveCurrentConfig();
      return;
    }

    if (intent === "reloadConfig") {
      await reloadConfigFromDisk();
      return;
    }

    if (intent === "resetConfigDraft") {
      resetConfigDraft();
      return;
    }

    if (intent === "refreshAll") {
      await refreshManually();
      return;
    }

    if (intent === "repairShellPath") {
      setBusyAction(intent);
      const result = await window.clawstart.repairShellPath();
      setBusyAction(null);
      setMessage(result.message);
      await refreshAll(false);
      return;
    }

    if (intent === "restoreStarterConfig") {
      setBusyAction(intent);
      const result = await window.clawstart.restoreConfigFromStarter();
      setBusyAction(null);
      setMessage(result.message);
      await refreshAll(true);
      return;
    }

    if (intent === "repairDashboardPort") {
      setBusyAction(intent);
      const result = await window.clawstart.repairDashboardPort();
      setBusyAction(null);
      setMessage(result.message);
      await refreshAll(false);
      return;
    }

    if (intent === "openTerminalOnboarding") {
      await openIntegratedTerminal("onboarding");
      return;
    }

    if (intent === "openTerminalShell") {
      await openIntegratedTerminal("shell");
      return;
    }

    if (intent === "revealConfigPath") {
      const target = configState?.path || systemInfo?.configPath;
      if (target) {
        await revealPath(target, "revealConfigPath");
      }
      return;
    }

    if (intent === "revealWorkspacePath") {
      const target = configState?.summary.workspace || systemInfo?.defaultWorkspacePath;
      if (target) {
        await revealPath(target, "revealWorkspacePath");
      }
      return;
    }

    if (intent === "openDashboardUrl" || intent === "openOnboardingTerminal") {
      await runMethod(intent);
      return;
    }

    if (intent === "loginOpenaiCodex") {
      await loginWithOpenaiCodex();
      return;
    }

    if (intent === "checkAppUpdates" || intent === "downloadAppUpdate" || intent === "installAppUpdate") {
      await runAppUpdateAction(intent);
      return;
    }

    await runCommand(intent);
  }

  useEffect(() => {
    if (!systemInfo || !configState || !appUpdateState || !installerSetup) {
      return;
    }

    const envReady =
      systemInfo.recommendedInstallMode === "portable" || (systemInfo.checks.node.ok && systemInfo.checks.npm.ok);
    const bootstrapRunning = systemInfo.tasks.some((task) => task.action === "bootstrapEnvironment");
    if (envReady || bootstrapRunning || autoBootstrapTriggeredRef.current) {
      return;
    }

    autoBootstrapTriggeredRef.current = true;
    void runIntent("bootstrapEnvironment");
  }, [appUpdateState, configState, installerSetup, systemInfo]);

  if (!systemInfo || !configState || !appUpdateState || !installerSetup) {
    return (
      <main className="loading-shell">
        <section className="loading-card">
          <p className="section-eyebrow">ClawStart</p>
          <h1>正在准备 OpenClaw 启动器</h1>
          <p>{message}</p>
        </section>
      </main>
    );
  }

  const model = deriveAppModel({
    systemInfo,
    configState,
    appUpdateState,
    terminalSessions,
    activeTerminalId,
    terminalBuffers,
    logs: deferredLogs,
    preferredSurface: surfacePreference,
  });
  const updateState = appUpdateState;
  const currentConfigState = configState;

  const runningActions = new Set(systemInfo.tasks.map((task) => task.action));
  const latestActionOutcome = new Map<LauncherAction, "success" | "error">();
  for (const entry of logs) {
    if (latestActionOutcome.has(entry.action)) {
      continue;
    }

    if (entry.kind === "error") {
      latestActionOutcome.set(entry.action, "error");
      continue;
    }

    if (entry.kind === "exit") {
      latestActionOutcome.set(entry.action, entry.code === 0 ? "success" : "error");
    }
  }

  function getIntentState(intent: SetupIntent) {
    if (busyAction === intent) {
      return "busy" as const;
    }

    if (isLauncherIntent(intent)) {
      if (runningActions.has(intent)) {
        return "busy" as const;
      }

      return latestActionOutcome.get(intent) || ("idle" as const);
    }

    if (intent === "openTerminalOnboarding") {
      if (busyAction === intent) {
        return "busy" as const;
      }

      return model.onboardingSession ? ("success" as const) : ("idle" as const);
    }

    if (intent === "openTerminalShell") {
      if (busyAction === intent) {
        return "busy" as const;
      }

      return model.shellSession ? ("success" as const) : ("idle" as const);
    }

    if (intent === "checkAppUpdates") {
      if (updateState.status === "checking") {
        return "busy" as const;
      }
      if (updateState.status === "available" || updateState.status === "not-available") {
        return "success" as const;
      }
      if (updateState.status === "error") {
        return "error" as const;
      }
    }

    if (intent === "downloadAppUpdate") {
      if (updateState.status === "downloading") {
        return "busy" as const;
      }
      if (updateState.status === "downloaded") {
        return "success" as const;
      }
      if (updateState.status === "error") {
        return "error" as const;
      }
    }

    if (intent === "installAppUpdate" && busyAction === intent) {
      return "busy" as const;
    }

    if (intent === "saveConfig" && !configDirty && currentConfigState.exists && currentConfigState.valid) {
      return "success" as const;
    }

    return "idle" as const;
  }

  const controls: IntentControls = {
    executeIntent: runIntent,
    isIntentDisabled: (intent) => getIntentState(intent) === "busy",
    resolveIntentLabel: (intent, fallbackLabel) => {
      const state = getIntentState(intent);

      if (state === "busy") {
        if (isLauncherIntent(intent)) {
          return intent === "bootstrapEnvironment"
            ? "补齐环境中..."
            : intent === "installPortable" || intent === "installRecommended" || intent === "upgradeOpenclaw"
            ? "执行中..."
            : intent === "applyInstallerSetup"
              ? "写入中..."
              : "运行中...";
        }

        if (intent === "openTerminalOnboarding" || intent === "openTerminalShell") {
          return intent === "openTerminalOnboarding" ? "打开中..." : "启动中...";
        }

        if (intent === "loginOpenaiCodex") {
          return "打开登录中...";
        }

        if (intent === "checkAppUpdates") {
          return "检查中...";
        }

        if (intent === "downloadAppUpdate") {
          return "下载中...";
        }

        if (intent === "installAppUpdate") {
          return "安装中...";
        }

        return "处理中...";
      }

      if (state === "success") {
        if (intent === "runDoctor") {
          return model.surface === "workspace" ? "重跑 Doctor" : "已通过";
        }
        if (intent === "runStatus") {
          return model.surface === "workspace" ? "查看 Status" : "已完成";
        }
        if (intent === "checkAppUpdates") {
          return updateState.status === "available" ? "发现新版本" : "已最新";
        }
        if (intent === "downloadAppUpdate") {
          return "已下载";
        }
        if (intent === "openTerminalOnboarding") {
          return model.onboardingSession?.running ? "切换到 Onboarding" : "重新打开 Onboarding";
        }
        if (intent === "openTerminalShell") {
          return model.shellSession?.running ? "切换到调试 Shell" : "重新打开调试 Shell";
        }
        if (intent === "saveConfig") {
          return "已保存";
        }
        if (intent === "applyInstallerSetup") {
          return "已写入";
        }
        if (intent === "bootstrapEnvironment") {
          return "已补齐";
        }
        if (intent === "loginOpenaiCodex") {
          return "重新打开 Codex 登录";
        }
        return "已完成";
      }

      if (state === "error") {
        if (intent === "checkAppUpdates") {
          return "重试检查";
        }
        if (intent === "downloadAppUpdate") {
          return "重试下载";
        }
      }

      return fallbackLabel;
    },
  };

  const terminalControls: TerminalControls = {
    activeTerminalId,
    setActiveTerminalId,
    closeActiveTerminal,
    sendTerminalInput,
    resizeTerminal,
    closing: busyAction === "closeTerminal",
  };

  return (
    <AppShell
      model={model}
      message={message}
      controls={controls}
      terminalControls={terminalControls}
      terminalSessions={terminalSessions}
      tasks={systemInfo.tasks}
      busyTaskId={busyAction}
      onStopTask={stopTask}
      configDraft={configDraft}
      setConfigDraft={(next) => {
        setConfigDraft(next);
        setConfigDirty(true);
      }}
      configDirty={configDirty}
      installerSetup={installerSetup}
      setInstallerSetup={(next) => {
        setInstallerSetup(next);
        setInstallerSetupDirty(true);
      }}
      installerSupportTab={installerSupportTab}
      setInstallerSupportTab={setInstallerSupportTab}
      workspacePanel={workspacePanel}
      setWorkspacePanel={setWorkspacePanel}
      isUpdateDialogOpen={isUpdateDialogOpen}
      openUpdateDialog={() => setIsUpdateDialogOpen(true)}
      closeUpdateDialog={() => setIsUpdateDialogOpen(false)}
      switchToInstaller={() => setSurfacePreference("installer")}
    />
  );
}
