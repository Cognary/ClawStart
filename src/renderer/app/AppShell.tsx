import type { InstallerSetupPayload, RunningTask, TerminalSession } from "../../main/types";
import type { DerivedAppModel, IntentControls, TerminalControls, WorkspacePanel } from "./model";
import { updateStatusLabel, updateStatusTone } from "./model";
import InstallerShell from "../installer/InstallerShell";
import WorkspaceShell from "../workspace/WorkspaceShell";
import StatusBadge from "../shared/StatusBadge";
import IntentButton from "../shared/IntentButton";

interface AppShellProps {
  model: DerivedAppModel;
  message: string;
  controls: IntentControls;
  terminalControls: TerminalControls;
  terminalSessions: TerminalSession[];
  tasks: RunningTask[];
  busyTaskId: string | null;
  onStopTask: (taskId: string) => Promise<void>;
  configDraft: string;
  setConfigDraft: (next: string) => void;
  configDirty: boolean;
  installerSetup: InstallerSetupPayload;
  setInstallerSetup: (next: InstallerSetupPayload) => void;
  workspacePanel: WorkspacePanel;
  setWorkspacePanel: (panel: WorkspacePanel) => void;
  isUpdateDialogOpen: boolean;
  openUpdateDialog: () => void;
  closeUpdateDialog: () => void;
  switchToInstaller: () => void;
}

function UpdateDialog({ model, controls, onClose }: { model: DerivedAppModel; controls: IntentControls; onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-shell" onClick={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <div>
            <p className="section-eyebrow">Updates</p>
            <h2>更新中心</h2>
            <p className="section-description">应用更新和 OpenClaw CLI 升级都放在这里，不进入首页主流程。</p>
          </div>
          <button className="ghost-button" onClick={onClose}>
            关闭
          </button>
        </header>

        <div className="modal-grid">
          <section className="section-card">
            <header className="section-card-header">
              <div>
                <p className="section-eyebrow">ClawStart App</p>
                <h2>桌面应用更新</h2>
              </div>
              <StatusBadge tone={updateStatusTone(model.appUpdateState.status)}>{updateStatusLabel(model.appUpdateState.status)}</StatusBadge>
            </header>
            <div className="section-card-body">
              <div className="fact-grid">
                <article className="fact-card">
                  <span>当前版本</span>
                  <strong>{model.appUpdateState.currentVersion}</strong>
                  <p>{model.appUpdateState.message}</p>
                </article>
                <article className="fact-card">
                  <span>更新源</span>
                  <strong>{model.appUpdateState.sourceLabel}</strong>
                  <p>{model.appUpdateState.sourceDetail || "未提供额外来源说明"}</p>
                </article>
                <article className="fact-card">
                  <span>候选版本</span>
                  <strong>{model.appUpdateState.availableVersion || "尚未检测"}</strong>
                  <p>{model.latestReleaseDate ? `发布日期 ${model.latestReleaseDate}` : "还没有拿到远端版本元数据"}</p>
                </article>
              </div>
              <div className="intent-row">
                <IntentButton intent="checkAppUpdates" fallbackLabel="检查更新" variant="primary" {...controls} />
                <IntentButton intent="downloadAppUpdate" fallbackLabel="下载更新" {...controls} />
                <IntentButton intent="installAppUpdate" fallbackLabel="重启并安装" {...controls} />
              </div>
            </div>
          </section>

          <section className="section-card">
            <header className="section-card-header">
              <div>
                <p className="section-eyebrow">OpenClaw CLI</p>
                <h2>CLI 升级</h2>
              </div>
              <StatusBadge tone={model.installed ? "ready" : "warning"}>{model.installed ? "已安装" : "未安装"}</StatusBadge>
            </header>
            <div className="section-card-body">
              <div className="fact-grid">
                <article className="fact-card">
                  <span>当前命令</span>
                  <strong>{model.systemInfo.checks.openclaw.value || "尚未检测到 openclaw"}</strong>
                  <p>{model.systemInfo.checks.openclaw.note || "升级时会尽量沿用当前安装方式。"}</p>
                </article>
                <article className="fact-card">
                  <span>升级策略</span>
                  <strong>{model.installAction.title}</strong>
                  <p>不会把升级入口放到首页主路径里，只在维护时使用。</p>
                </article>
              </div>
              <div className="intent-row">
                <IntentButton intent="upgradeOpenclaw" fallbackLabel={model.installed ? "升级 / 重装 CLI" : "安装 CLI"} variant="primary" {...controls} />
                <IntentButton intent="runStatus" fallbackLabel="查看 Status" {...controls} />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function AppShell({
  model,
  message,
  controls,
  terminalControls,
  terminalSessions,
  tasks,
  busyTaskId,
  onStopTask,
  configDraft,
  setConfigDraft,
  configDirty,
  installerSetup,
  setInstallerSetup,
  workspacePanel,
  setWorkspacePanel,
  isUpdateDialogOpen,
  openUpdateDialog,
  closeUpdateDialog,
  switchToInstaller,
}: AppShellProps) {
  return (
    <main className="app-frame">
      {model.surface === "installer" ? (
        <InstallerShell
          model={model}
          message={message}
          installerSetup={installerSetup}
          setInstallerSetup={setInstallerSetup}
          controls={controls}
          terminalControls={terminalControls}
          terminalSessions={terminalSessions}
          tasks={tasks}
          busyTaskId={busyTaskId}
          onStopTask={onStopTask}
        />
      ) : (
        <WorkspaceShell
          model={model}
          message={message}
          controls={controls}
          terminalControls={terminalControls}
          terminalSessions={terminalSessions}
          tasks={tasks}
          busyTaskId={busyTaskId}
          onStopTask={onStopTask}
          onOpenUpdates={openUpdateDialog}
          onSwitchToInstaller={switchToInstaller}
          activePanel={workspacePanel}
          setActivePanel={setWorkspacePanel}
          configDraft={configDraft}
          setConfigDraft={setConfigDraft}
          configDirty={configDirty}
        />
      )}

      {isUpdateDialogOpen ? <UpdateDialog model={model} controls={controls} onClose={closeUpdateDialog} /> : null}
    </main>
  );
}
