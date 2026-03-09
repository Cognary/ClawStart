import type { AppUpdateState, ConfigState, SystemInfo, TerminalSession } from "../../main/types";
import type { DerivedAppModel, DiagnosticCard, DiagnosticSeverity, FactCard, LogEntry, SetupIntent, SetupStageId, StepCard } from "./model";
import { checkStateLabel, formatUpdateDate, getInstallAction, platformLabel } from "./model";

function evidenceMatch(pattern: RegExp, source: string) {
  return new RegExp(pattern.source, pattern.flags).test(source);
}

function compactEvidence(source: string) {
  const line = source.replace(/\s+/g, " ").trim();
  if (line.length <= 180) {
    return line;
  }

  return `${line.slice(0, 177)}...`;
}

function gatherDiagnosticSources(logs: LogEntry[], terminalSessions: TerminalSession[], terminalBuffers: Record<string, string>) {
  const logSources = logs
    .filter((entry) => entry.kind === "stderr" || entry.kind === "error" || (entry.kind === "exit" && entry.code && entry.code !== 0))
    .slice(0, 80)
    .map((entry) => `[${entry.action}] ${entry.text}`);

  const terminalSources = terminalSessions.slice(0, 3).flatMap((session) => {
    const buffer = terminalBuffers[session.id];
    if (!buffer) {
      return [];
    }

    return [`[terminal:${session.kind}] ${buffer.slice(-6000)}`];
  });

  return [...logSources, ...terminalSources];
}

function findEvidence(sources: string[], pattern: RegExp) {
  return sources
    .filter((source) => evidenceMatch(pattern, source))
    .slice(0, 2)
    .map(compactEvidence);
}

function sortDiagnostics(items: DiagnosticCard[]) {
  const severityOrder: Record<DiagnosticSeverity, number> = {
    blocking: 0,
    warning: 1,
    info: 2,
  };

  return items.sort((left, right) => severityOrder[left.severity] - severityOrder[right.severity]);
}

function buildDiagnostics(params: {
  systemInfo: SystemInfo;
  configState: ConfigState;
  logs: LogEntry[];
  terminalSessions: TerminalSession[];
  terminalBuffers: Record<string, string>;
  configReady: boolean;
  doctorVerified: boolean;
  onboardingSession: TerminalSession | null;
  dashboardRunning: boolean;
}) {
  const { systemInfo, configState, logs, terminalSessions, terminalBuffers, configReady, doctorVerified, onboardingSession, dashboardRunning } =
    params;
  const installAction = getInstallAction(systemInfo);
  const diagnostics: DiagnosticCard[] = [];
  const addDiagnostic = (card: DiagnosticCard) => {
    if (!diagnostics.some((current) => current.id === card.id)) {
      diagnostics.push(card);
    }
  };

  const sources = gatherDiagnosticSources(logs, terminalSessions, terminalBuffers);
  const installRunning = systemInfo.tasks.some(
    (task) =>
      task.action === "bootstrapEnvironment" || task.action === "installPortable" || task.action === "installRecommended",
  );

  if (systemInfo.recommendedInstallMode === "recommended" && !systemInfo.checks.node.ok) {
    addDiagnostic({
      id: "missing-node",
      severity: "blocking",
      title: "缺少 Node.js",
      body: "当前平台更依赖官方推荐安装路径，但系统里没有可用的 Node.js。先自动补齐环境，再继续安装 OpenClaw CLI。",
      evidence: systemInfo.checks.node.note ? [systemInfo.checks.node.note] : undefined,
      primaryAction: { intent: "bootstrapEnvironment", label: "自动补齐环境" },
      secondaryAction: { intent: "openTerminalShell", label: "打开调试 Shell" },
    });
  }

  if (systemInfo.recommendedInstallMode === "recommended" && !systemInfo.checks.npm.ok) {
    addDiagnostic({
      id: "missing-npm",
      severity: "blocking",
      title: "缺少 npm",
      body: "OpenClaw 官方推荐安装路径需要 npm。先自动补齐环境，再继续安装 OpenClaw CLI。",
      evidence: systemInfo.checks.npm.note ? [systemInfo.checks.npm.note] : undefined,
      primaryAction: { intent: "bootstrapEnvironment", label: "自动补齐环境" },
      secondaryAction: { intent: "openTerminalShell", label: "打开调试 Shell" },
    });
  }

  if (!systemInfo.checks.openclaw.ok && !installRunning) {
    const looksLikePathOnly = systemInfo.checks.portableInstall.ok;
    addDiagnostic({
      id: "missing-openclaw",
      severity: "blocking",
      title: looksLikePathOnly ? "OpenClaw 已安装，但 PATH 还没接好" : "还没有检测到 OpenClaw CLI",
      body: looksLikePathOnly
        ? "已经检测到 ~/.openclaw/bin/openclaw，但当前 shell 里还没有可用的 openclaw 命令。优先修 PATH。"
        : "当前机器上没有可用的 openclaw 命令。先完成安装，后续 doctor、dashboard 和 onboarding 才能继续。",
      evidence: systemInfo.checks.openclaw.note ? [systemInfo.checks.openclaw.note] : undefined,
      primaryAction: {
        intent: looksLikePathOnly ? "repairShellPath" : installAction.id,
        label: looksLikePathOnly ? "一键修复 PATH" : installAction.title,
      },
      secondaryAction: { intent: "openTerminalShell", label: "打开调试 Shell" },
    });
  }

  if (configState.exists && !configState.valid) {
    addDiagnostic({
      id: "invalid-config",
      severity: "blocking",
      title: "配置文件无法解析",
      body: "当前 ~/.openclaw/openclaw.json 不是有效的 JSON5。先修好配置，后面的 onboarding、doctor 和 gateway 才有意义。",
      evidence: configState.parseError ? [configState.parseError] : undefined,
      primaryAction: { intent: "restoreStarterConfig", label: "恢复默认模板" },
      secondaryAction: { intent: "revealConfigPath", label: "打开配置位置" },
    });
  } else if (systemInfo.checks.openclaw.ok && !configReady) {
    addDiagnostic({
      id: "config-not-ready",
      severity: "warning",
      title: "基础配置还没落盘",
      body: "OpenClaw 已安装，但还没有一份可用的基础配置。先保存 workspace 和 gateway，再继续后面的验证。",
      primaryAction: { intent: "saveConfig", label: "保存配置" },
      secondaryAction: { intent: "resetConfigDraft", label: "恢复默认模板" },
    });
  }

  const certificatePattern = /(ssl_error_syscall|certificate|cert_|unable to verify|self signed|tlsv1\.2|ssl connect)/i;
  const permissionPattern = /(permission denied|operation not permitted|eacces|eperm)/i;
  const dnsPattern = /(eai_again|enotfound|temporary failure in name resolution|timed out|timeout|connection reset|econnreset)/i;
  const pathPattern = /(command not found|is not recognized as an internal or external command|no such file or directory)/i;
  const portPattern = /(eaddrinuse|address already in use|listen eacces|port 18789|bind: address already in use)/i;
  const dashboardPattern = /(econnrefused|err_connection_refused|connection refused)/i;

  if (findEvidence(sources, certificatePattern).length > 0) {
    addDiagnostic({
      id: "certificate-network",
      severity: "warning",
      title: "检测到 TLS / 证书问题",
      body: "最近日志更像是网络、代理或根证书问题，而不是 OpenClaw 本身损坏。",
      evidence: findEvidence(sources, certificatePattern),
      primaryAction: { intent: "openTerminalShell", label: "打开调试 Shell" },
      secondaryAction: { intent: "runDoctor", label: "运行 Doctor" },
    });
  }

  if (findEvidence(sources, permissionPattern).length > 0) {
    addDiagnostic({
      id: "permission-denied",
      severity: "warning",
      title: "检测到权限错误",
      body: "最近失败日志里出现了权限相关错误。通常是目录写入、可执行权限或系统安全策略拦截导致的。",
      evidence: findEvidence(sources, permissionPattern),
      primaryAction: { intent: "openTerminalShell", label: "打开调试 Shell" },
      secondaryAction: { intent: "revealWorkspacePath", label: "打开 workspace" },
    });
  }

  if (findEvidence(sources, dnsPattern).length > 0) {
    addDiagnostic({
      id: "network-resolution",
      severity: "warning",
      title: "检测到网络或 DNS 问题",
      body: "最近日志更像是下载源、域名解析或网络超时失败。先确认网络再继续安装。",
      evidence: findEvidence(sources, dnsPattern),
      primaryAction: { intent: "runDoctor", label: "运行 Doctor" },
      secondaryAction: { intent: "openTerminalShell", label: "打开调试 Shell" },
    });
  }

  if (findEvidence(sources, pathPattern).length > 0) {
    const prefersPathRepair = systemInfo.checks.portableInstall.ok;
    addDiagnostic({
      id: "path-command",
      severity: "warning",
      title: "检测到命令路径问题",
      body: "有命令找不到的迹象。通常是 PATH 没生效，或者 OpenClaw / Node / npm 没装到当前 shell 能看到的位置。",
      evidence: findEvidence(sources, pathPattern),
      primaryAction: {
        intent: prefersPathRepair ? "repairShellPath" : "runDoctor",
        label: prefersPathRepair ? "一键修复 PATH" : "运行 Doctor",
      },
      secondaryAction: { intent: "openTerminalShell", label: "打开调试 Shell" },
    });
  }

  if (findEvidence(sources, portPattern).length > 0) {
    addDiagnostic({
      id: "port-in-use",
      severity: "warning",
      title: "Gateway / Dashboard 端口可能被占用",
      body: "最近日志像是端口冲突。最常见的是已有 gateway 实例在跑，或者 18789 已被别的进程占用。",
      evidence: findEvidence(sources, portPattern),
      primaryAction: { intent: "repairDashboardPort", label: "尝试释放端口" },
      secondaryAction: { intent: "runStatus", label: "查看 Status" },
    });
  }

  if (!dashboardRunning && findEvidence(sources, dashboardPattern).length > 0) {
    addDiagnostic({
      id: "dashboard-refused",
      severity: "warning",
      title: "Dashboard 当前没有在监听",
      body: "日志显示本地地址能被请求到，但 Dashboard / Gateway 进程没有真正跑起来。",
      evidence: findEvidence(sources, dashboardPattern),
      primaryAction: { intent: "runDashboard", label: "启动 Dashboard" },
      secondaryAction: { intent: "startGateway", label: "启动 Gateway" },
    });
  }

  if (systemInfo.checks.openclaw.ok && configReady && !onboardingSession && !doctorVerified) {
    addDiagnostic({
      id: "next-doctor",
      severity: "info",
      title: "建议先跑一次 Doctor",
      body: "安装和配置已经差不多就绪，现在最有价值的是先跑 openclaw doctor，把 PATH、配置和网络问题一次性扫出来。",
      primaryAction: { intent: "runDoctor", label: "运行 Doctor" },
      secondaryAction: { intent: "openTerminalOnboarding", label: "打开应用内 Onboarding" },
    });
  }

  if (onboardingSession?.running) {
    addDiagnostic({
      id: "onboarding-running",
      severity: "info",
      title: "应用内 Onboarding 正在运行",
      body: "优先在终端里完成交互，完成后再回到主流程里跑 doctor 或启动 dashboard。",
      primaryAction: { intent: "openTerminalOnboarding", label: "回到 Onboarding" },
      secondaryAction: { intent: "refreshAll", label: "刷新状态" },
    });
  }

  return sortDiagnostics(diagnostics);
}

function getCurrentStepId(params: {
  envReady: boolean;
  installed: boolean;
  configReady: boolean;
  onboardingComplete: boolean;
  doctorVerified: boolean;
}): SetupStageId {
  const { envReady, installed, configReady, onboardingComplete, doctorVerified } = params;

  if (!envReady) {
    return "environmentRepair";
  }

  if (!installed) {
    return "install";
  }

  if (!configReady) {
    return "config";
  }

  if (!onboardingComplete) {
    return "onboarding";
  }

  if (!doctorVerified) {
    return "verify";
  }

  return "verify";
}

function getInstallerFactCards(params: {
  currentStepId: SetupStageId;
  installActionTitle: string;
  openclawLabel: string;
  openclawNote: string;
  configState: ConfigState;
  workspacePath: string;
  dashboardUrl: string;
  onboardingSession: TerminalSession | null;
  doctorVerified: boolean;
  dashboardRunning: boolean;
  systemInfo: SystemInfo;
}): FactCard[] {
  const {
    currentStepId,
    installActionTitle,
    openclawLabel,
    openclawNote,
    configState,
    workspacePath,
    dashboardUrl,
    onboardingSession,
    doctorVerified,
    dashboardRunning,
    systemInfo,
  } = params;

  switch (currentStepId) {
    case "environmentCheck":
      return [
        { label: "当前平台", value: platformLabel(systemInfo.platform), detail: "先确认系统和安装模式，再决定是否需要补环境。" },
        { label: "安装方式", value: installActionTitle, detail: systemInfo.recommendedInstallMode === "portable" ? "当前平台优先本地可移植安装。" : "当前平台建议走官方推荐安装。" },
        { label: "当前 Shell", value: systemInfo.shell, detail: "后续调试 Shell 会复用这个环境。" },
      ];
    case "environmentRepair":
      return [
        { label: "Node.js", value: systemInfo.checks.node.value || checkStateLabel(systemInfo.checks.node.ok), detail: systemInfo.checks.node.note || "缺失时会在这一步自动补齐。" },
        { label: "npm", value: systemInfo.checks.npm.value || checkStateLabel(systemInfo.checks.npm.ok), detail: systemInfo.checks.npm.note || "通常会跟随 Node.js 一起补齐。" },
        { label: "当前动作", value: "自动补齐环境", detail: "这里只处理前置条件，不在这一步安装 OpenClaw CLI。" },
      ];
    case "install":
      return [
        { label: "推荐安装", value: installActionTitle, detail: "当前阶段只做 OpenClaw CLI 安装，不引入配置和维护信息。" },
        { label: "当前检测", value: openclawLabel, detail: openclawNote },
        { label: "安装位置", value: systemInfo.checks.portableInstall.path || "~/.openclaw/bin/openclaw", detail: "安装完成后会自动进入配置步骤。" },
      ];
    case "config":
      return [
        { label: "配置文件", value: configState.path, detail: "ClawStart 会调用官方 onboard，再补充写入搜索、渠道和维护默认项。" },
        { label: "workspace", value: configState.summary.workspace || workspacePath, detail: "首次安装优先把 workspace 和 gateway 定好。" },
        { label: "Dashboard", value: dashboardUrl, detail: "写入成功并验证通过后，这个地址会成为主要入口。" },
      ];
    case "onboarding":
      return [
        { label: "终端状态", value: onboardingSession?.running ? "进行中" : onboardingSession ? "已打开过" : "尚未开始", detail: "这一步只在需要补充交互设置时使用。" },
        { label: "当前命令", value: "openclaw onboard", detail: "会沿用安装页里选好的 flow / mode / daemon / skills 选项。" },
        { label: "调试入口", value: "应用内 Shell", detail: "只在需要排障时才使用。" },
      ];
      default:
      return [
        { label: "验证命令", value: "openclaw doctor / status", detail: "优先跑 doctor，问题会暴露得更完整。" },
        { label: "最近状态", value: doctorVerified ? "已通过" : "待验证", detail: doctorVerified ? "通过后会切到维护工作台。" : "通过后安装流程结束。" },
        { label: "服务入口", value: dashboardRunning ? "Dashboard 运行中" : "Dashboard 待启动", detail: dashboardRunning ? dashboardUrl : "验证通过后再启动服务。" },
      ];
  }
}

function createSteps(params: {
  currentStepId: SetupStageId;
  installActionId: SetupIntent;
  installActionTitle: string;
  envReady: boolean;
  configReady: boolean;
  installed: boolean;
  configState: ConfigState;
  workspacePath: string;
  doctorVerified: boolean;
  onboardingComplete: boolean;
  dashboardUrl: string;
}): StepCard[] {
  const { currentStepId, installActionId, installActionTitle, envReady, configReady, installed, configState, workspacePath, doctorVerified, onboardingComplete, dashboardUrl } =
    params;
  const order: SetupStageId[] = ["environmentCheck", "environmentRepair", "install", "config", "onboarding", "verify"];
  const currentIndex = order.indexOf(currentStepId);

  const statusFor = (id: SetupStageId) => {
    if (id === "environmentCheck") {
      return "done" as const;
    }

    const index = order.indexOf(id);
    if (index < currentIndex || (doctorVerified && id === "verify")) {
      return "done" as const;
    }
    if (index === currentIndex && !doctorVerified) {
      return "current" as const;
    }
    return "upcoming" as const;
  };

  const steps: StepCard[] = [
    {
      id: "environmentCheck",
      order: 1,
      label: "Step 1",
      title: "检查环境",
      description: "先确认系统、Shell 和运行前置条件。",
      status: "done",
      primaryIntent: "refreshAll",
      primaryLabel: "重新检测",
      completionHint: "环境已经检查完成，下一步决定是否需要自动补齐。",
    },
    {
      id: "environmentRepair",
      order: 2,
      label: "Step 2",
      title: "自动补齐环境",
      description: envReady ? "当前机器的前置环境已经齐了，可以直接继续安装 OpenClaw CLI。" : "缺少的 Node.js / npm 会在这一步自动补齐。",
      status: statusFor("environmentRepair"),
      primaryIntent: "bootstrapEnvironment",
      primaryLabel: "自动补齐环境",
      completionHint: envReady ? "前置环境已经齐了，继续安装 OpenClaw CLI。" : "缺少的环境会自动补齐，完成后进入 OpenClaw CLI 安装。",
    },
    {
      id: "install",
      order: 3,
      label: "Step 3",
      title: "安装 OpenClaw CLI",
      description: installed ? "已经检测到 openclaw，可继续下一步。" : `这一步只安装 OpenClaw CLI。默认使用“${installActionTitle}”。`,
      status: statusFor("install"),
      primaryIntent: installActionId,
      primaryLabel: installActionTitle,
      completionHint: "CLI 安装完成后再进入首次配置。",
    },
    {
      id: "config",
      order: 4,
      label: "Step 4",
      title: "写入 OpenClaw",
      description: configReady ? `当前 workspace 指向 ${workspacePath}。` : "填写安装字段，并一次性写入 OpenClaw 向导。",
      status: statusFor("config"),
      primaryIntent: "applyInstallerSetup",
      primaryLabel: "一键写入 OpenClaw",
      completionHint: configState.valid ? "安装字段已写入，可继续补充 Onboarding。" : "先把安装字段写进去。",
    },
    {
      id: "onboarding",
      order: 5,
      label: "Step 5",
      title: "完成 Onboarding",
      description: onboardingComplete
        ? "基础 Onboarding 已完成，可以继续验证。"
        : "如需补充认证、渠道或 Skills 细节，可继续应用内向导。",
      status: statusFor("onboarding"),
      primaryIntent: "openTerminalOnboarding",
      primaryLabel: "开始 Onboarding",
      completionHint: "完成补充配置后进入最后验证。",
    },
    {
      id: "verify",
      order: 6,
      label: "Step 6",
      title: "验证并完成安装",
      description: doctorVerified ? "最近一次 Doctor / Status 已成功完成。" : "运行 Doctor / Status 做最终验证。",
      status: doctorVerified ? "done" : statusFor("verify"),
      primaryIntent: doctorVerified ? "openDashboardUrl" : "runDoctor",
      primaryLabel: doctorVerified ? "打开 Dashboard" : "运行 Doctor",
      completionHint: doctorVerified ? `安装完成，主要入口是 ${dashboardUrl}。` : "通过后将进入维护工作台。",
    },
  ];

  return steps.map((step) => {
    if (step.id === "environmentRepair" && envReady) {
      return {
        ...step,
        primaryIntent: "refreshAll",
        primaryLabel: "重新检测",
      };
    }

    if (step.id === "install") {
      return {
        ...step,
        primaryIntent: installed ? "refreshAll" : step.primaryIntent,
        primaryLabel: installed ? "重新检测" : step.primaryLabel,
      };
    }

    return step;
  });
}

export function deriveAppModel(params: {
  systemInfo: SystemInfo;
  configState: ConfigState;
  appUpdateState: AppUpdateState;
  terminalSessions: TerminalSession[];
  activeTerminalId: string | null;
  terminalBuffers: Record<string, string>;
  logs: LogEntry[];
  preferredSurface: "installer" | "workspace";
}): DerivedAppModel {
  const { systemInfo, configState, appUpdateState, terminalSessions, activeTerminalId, terminalBuffers, logs, preferredSurface } = params;
  const installAction = getInstallAction(systemInfo);
  const envReady =
    systemInfo.recommendedInstallMode === "portable" || (systemInfo.checks.node.ok && systemInfo.checks.npm.ok);
  const installed = systemInfo.checks.openclaw.ok;
  const configReady = configState.exists && configState.valid && Boolean(configState.summary.workspace);
  const successfulActions = new Set(
    logs.filter((entry) => entry.kind === "exit" && entry.code === 0).map((entry) => entry.action),
  );
  const doctorVerified = successfulActions.has("runDoctor") || successfulActions.has("runStatus");
  const onboardingSession =
    terminalSessions.find((session) => session.kind === "onboarding" && (session.running || session.exitCode === 0)) || null;
  const shellSession =
    terminalSessions.find((session) => session.kind === "shell" && (session.running || session.exitCode === 0)) || null;
  const onboardingComplete = Boolean(onboardingSession) || doctorVerified || successfulActions.has("applyInstallerSetup");
  const dashboardRunning = systemInfo.services.dashboard.ok;
  const gatewayRunning = systemInfo.services.gateway.ok;
  const canOperate = installed && configReady && doctorVerified;
  const surface = canOperate && preferredSurface === "workspace" ? "workspace" : "installer";
  const currentStepId = getCurrentStepId({ envReady, installed, configReady, onboardingComplete, doctorVerified });
  const steps = createSteps({
    currentStepId,
    installActionId: installAction.id,
    installActionTitle: installAction.title,
    envReady,
    configReady,
    installed,
    configState,
    workspacePath: configState.summary.workspace || systemInfo.defaultWorkspacePath,
    doctorVerified,
    onboardingComplete,
    dashboardUrl: systemInfo.dashboardUrl,
  });
  const currentStep = steps.find((step) => step.id === currentStepId) || steps[steps.length - 1];
  const completedSteps = steps.filter((step) => step.status === "done").length;
  const progressPercent = Math.round((completedSteps / steps.length) * 100);
  const workspacePath = configState.summary.workspace || systemInfo.defaultWorkspacePath;
  const activeTerminal = terminalSessions.find((session) => session.id === activeTerminalId) || null;
  const activeTerminalBuffer = activeTerminalId ? terminalBuffers[activeTerminalId] || "" : "";
  const diagnostics = buildDiagnostics({
    systemInfo,
    configState,
    logs,
    terminalSessions,
    terminalBuffers,
    configReady,
    doctorVerified,
    onboardingSession,
    dashboardRunning,
  });
  const highlightedDiagnostics = surface === "installer" ? diagnostics.slice(0, 2) : diagnostics.slice(0, 3);
  const openclawLabel = systemInfo.checks.openclaw.value || "尚未检测到 openclaw";
  const openclawNote = systemInfo.checks.openclaw.note || "安装完成后会自动进入配置步骤。";

  const installerPrimaryActionMap: Record<SetupStageId, { intent: SetupIntent; label: string }> = {
    environmentCheck: { intent: "refreshAll", label: "重新检测" },
    environmentRepair: { intent: "bootstrapEnvironment", label: "自动补齐环境" },
    install: { intent: installAction.id, label: installAction.title },
    config: { intent: "applyInstallerSetup", label: "一键写入 OpenClaw" },
    onboarding: { intent: "openTerminalOnboarding", label: "开始 Onboarding" },
    verify: { intent: doctorVerified ? "openDashboardUrl" : "runDoctor", label: doctorVerified ? "打开 Dashboard" : "运行 Doctor" },
  };
  const installerSecondaryActionMap: Record<SetupStageId, { intent: SetupIntent; label: string }> = {
    environmentCheck: { intent: "openTerminalShell", label: "打开调试 Shell" },
    environmentRepair: { intent: "openTerminalShell", label: "打开调试 Shell" },
    install: { intent: "openTerminalShell", label: "打开调试 Shell" },
    config: { intent: "revealConfigPath", label: "打开配置位置" },
    onboarding: { intent: "openTerminalShell", label: "打开调试 Shell" },
    verify: { intent: "runStatus", label: "查看 Status" },
  };

  return {
    surface,
    installAction,
    platformLabel: platformLabel(systemInfo.platform),
    steps,
    currentStep,
    completedSteps,
    progressPercent,
    checks: [
      { label: "Node.js", probe: systemInfo.checks.node },
      { label: "npm", probe: systemInfo.checks.npm },
    ],
    diagnostics,
    highlightedDiagnostics,
    compactLogs: logs.slice(0, 8),
    logs,
    workspacePath,
    latestReleaseDate: formatUpdateDate(appUpdateState.releaseDate),
    installed,
    configReady,
    doctorVerified,
    dashboardRunning,
    onboardingSession,
    shellSession,
    activeTerminal,
    activeTerminalBuffer,
    installerHeroSummary: doctorVerified ? "安装流程已完成，可以进入维护工作台。" : currentStep.completionHint,
    installerSidebarSummary: [
      { label: "CLI", value: installed ? "已安装" : "未安装" },
      { label: "配置", value: configReady ? "已保存" : "未完成" },
      { label: "验证", value: doctorVerified ? "已通过" : "未通过" },
    ],
    installerFactCards: getInstallerFactCards({
      currentStepId,
      installActionTitle: installAction.title,
      openclawLabel,
      openclawNote,
      configState,
      workspacePath,
      dashboardUrl: systemInfo.dashboardUrl,
      onboardingSession,
      doctorVerified,
      dashboardRunning,
      systemInfo,
    }),
    installerPrimaryAction: installerPrimaryActionMap[currentStepId],
    installerSecondaryAction: installerSecondaryActionMap[currentStepId],
    workspaceSidebarStatus: [
      { label: "Dashboard", value: dashboardRunning ? "运行中" : "未启动" },
      { label: "Gateway", value: gatewayRunning ? "运行中" : "未启动" },
      { label: "CLI", value: systemInfo.checks.openclaw.value || "已安装" },
    ],
    workspaceOverviewCards: [
      {
        id: "workspace",
        label: "workspace",
        value: workspacePath,
        detail: "当前维护和日志都会围绕这个工作目录展开。",
        tone: "ready",
      },
      {
        id: "verify",
        label: "验证状态",
        value: doctorVerified ? "已通过" : "未通过",
        detail: doctorVerified ? "最近一次 Doctor / Status 成功完成。" : "建议先重跑 Doctor。",
        tone: doctorVerified ? "ready" : "warning",
      },
      {
        id: "entry",
        label: "服务入口",
        value: systemInfo.dashboardUrl,
        detail: dashboardRunning ? "当前地址可达，可以直接从这里进入。" : "服务启动后会从这个地址进入。",
        tone: dashboardRunning ? "active" : "warning",
      },
      {
        id: "config",
        label: "配置文件",
        value: configState.path,
        detail: configState.exists ? "当前维护都围绕这份配置展开。" : "还没有检测到本地配置文件。",
        tone: configState.exists ? "ready" : "warning",
      },
    ],
    workspaceFacts: [
      { label: "配置文件", value: configState.path, detail: configState.exists ? "当前配置文件已存在，可随时维护。" : "尚未生成配置文件。" },
      { label: "Dashboard 地址", value: systemInfo.dashboardUrl, detail: dashboardRunning ? "可以直接打开。" : "服务启动后从这里进入。" },
      { label: "当前 Shell", value: systemInfo.shell, detail: "调试 Shell 会复用当前环境。" },
    ],
    workspacePrimaryAction: {
      intent: dashboardRunning ? "openDashboardUrl" : "runDashboard",
      label: dashboardRunning ? "打开 Dashboard" : "启动 Dashboard",
    },
    workspaceSecondaryActions: gatewayRunning
      ? [
          { intent: "runDoctor", label: "运行 Doctor" },
          { intent: "runStatus", label: "查看 Status" },
        ]
      : [
          { intent: "startGateway", label: "启动 Gateway" },
          { intent: "runDoctor", label: "运行 Doctor" },
          { intent: "runStatus", label: "查看 Status" },
        ],
    appUpdateState,
    configState,
    systemInfo,
  };
}
