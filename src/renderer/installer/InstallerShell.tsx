import type { InstallerSetupPayload, RunningTask, TerminalSession } from "../../main/types";
import type { DerivedAppModel, InstallerSupportTab, IntentControls, TerminalControls } from "../app/model";
import SectionCard from "../shared/SectionCard";
import IntentButton from "../shared/IntentButton";
import InstallerSidebar from "./InstallerSidebar";
import InstallerSupportPanel from "./InstallerSupportPanel";
import StepHeader from "./StepHeader";
import StepConfigPanel from "./steps/StepConfigPanel";
import StepEnvironmentCheckPanel from "./steps/StepEnvironmentCheckPanel";
import StepEnvironmentPanel from "./steps/StepEnvironmentPanel";
import StepInstallPanel from "./steps/StepInstallPanel";
import StepOnboardingPanel from "./steps/StepOnboardingPanel";
import StepVerifyPanel from "./steps/StepVerifyPanel";

interface InstallerShellProps {
  model: DerivedAppModel;
  message: string;
  installerSetup: InstallerSetupPayload;
  setInstallerSetup: (next: InstallerSetupPayload) => void;
  supportTab: InstallerSupportTab;
  setSupportTab: (tab: InstallerSupportTab) => void;
  controls: IntentControls;
  terminalControls: TerminalControls;
  terminalSessions: TerminalSession[];
  tasks: RunningTask[];
  busyTaskId: string | null;
  onStopTask: (taskId: string) => Promise<void>;
  onOpenUpdates: () => void;
}

export default function InstallerShell({
  model,
  message,
  installerSetup,
  setInstallerSetup,
  supportTab,
  setSupportTab,
  controls,
  terminalControls,
  terminalSessions,
  tasks,
  busyTaskId,
  onStopTask,
  onOpenUpdates,
}: InstallerShellProps) {
  return (
    <div className="surface surface-installer">
      <InstallerSidebar model={model} />

      <section className="stage stage-installer">
        <header className="surface-toolbar installer-toolbar">
          <div className="installer-toolbar-copy">
            <p className="section-eyebrow">Setup Wizard</p>
            <h2>首次安装 OpenClaw</h2>
            <p className="support-copy">{message}</p>
          </div>
          <div className="installer-toolbar-actions">
            <button className="ghost-button" onClick={onOpenUpdates}>
              更新中心
            </button>
            <button className="sidebar-text-button" onClick={() => void controls.executeIntent("refreshAll")}>
              重新检测
            </button>
          </div>
        </header>

        <StepHeader
          step={model.currentStep}
          totalSteps={model.steps.length}
          summary={model.installerHeroSummary}
          primaryAction={model.installerPrimaryAction}
          secondaryAction={model.installerSecondaryAction}
          controls={controls}
          showActions={model.currentStep.id !== "config"}
        />

        {model.currentStep.id === "environmentCheck" ? (
          <StepEnvironmentCheckPanel checks={model.checks} facts={model.installerFactCards} />
        ) : null}
        {model.currentStep.id === "environmentRepair" ? (
          <StepEnvironmentPanel
            checks={model.checks}
            facts={model.installerFactCards}
            logs={model.logs}
            tasks={tasks}
          />
        ) : null}
        {model.currentStep.id === "install" ? <StepInstallPanel facts={model.installerFactCards} logs={model.logs} tasks={tasks} /> : null}
        {model.currentStep.id === "config" ? (
          <SectionCard
            eyebrow="Step 4"
            title="首次配置"
            description="这里只写入第一次使用真正需要的配置。高级项和维护项都留到工作台。"
          >
            <StepConfigPanel
              configState={model.configState}
              setup={installerSetup}
              setSetup={setInstallerSetup}
              controls={controls}
            />
          </SectionCard>
        ) : null}
        {model.currentStep.id === "onboarding" ? (
          <SectionCard
            eyebrow="Step 5"
            title="完成 Onboarding"
            description="这一页只完成官方交互式配对，不提前暴露验证和维护动作。"
          >
            <StepOnboardingPanel
              sessions={terminalSessions}
              activeTerminal={model.activeTerminal}
              activeBuffer={model.activeTerminalBuffer}
              intentControls={controls}
              terminalControls={terminalControls}
            />
          </SectionCard>
        ) : null}
        {model.currentStep.id === "verify" ? (
          <StepVerifyPanel doctorVerified={model.doctorVerified} facts={model.installerFactCards} diagnostics={model.diagnostics} />
        ) : null}

        <details className="support-disclosure">
          <summary>遇到问题时展开排障与最近输出</summary>
          <InstallerSupportPanel
            activeTab={supportTab}
            setActiveTab={setSupportTab}
            diagnostics={model.highlightedDiagnostics}
            logs={model.compactLogs}
            tasks={tasks}
            controls={controls}
            busyTaskId={busyTaskId}
            onStopTask={onStopTask}
          />
        </details>
      </section>
    </div>
  );
}
