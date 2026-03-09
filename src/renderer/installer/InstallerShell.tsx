import type { InstallerSetupPayload, RunningTask, TerminalSession } from "../../main/types";
import type { DerivedAppModel, InstallerSupportTab, IntentControls, TerminalControls } from "../app/model";
import SectionCard from "../shared/SectionCard";
import IntentButton from "../shared/IntentButton";
import InstallerSidebar from "./InstallerSidebar";
import InstallerSupportPanel from "./InstallerSupportPanel";
import StepHeader from "./StepHeader";
import StepConfigPanel from "./steps/StepConfigPanel";
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
        <header className="surface-toolbar">
          <div>
            <p className="section-eyebrow">Setup</p>
            <h2>{model.currentStep.label} · {model.currentStep.title}</h2>
            <p className="support-copy">{message}</p>
          </div>
          <div className="intent-row">
            <button className="primary-button" onClick={onOpenUpdates}>
              更新中心
            </button>
            <IntentButton intent="refreshAll" fallbackLabel="刷新状态" {...controls} />
          </div>
        </header>

        <StepHeader
          step={model.currentStep}
          summary={model.installerHeroSummary}
          primaryAction={model.installerPrimaryAction}
          secondaryAction={model.installerSecondaryAction}
          controls={controls}
          showActions={model.currentStep.id !== "config"}
        />

        {model.currentStep.id === "environment" ? (
          <StepEnvironmentPanel checks={model.checks} facts={model.installerFactCards} />
        ) : null}
        {model.currentStep.id === "install" ? <StepInstallPanel facts={model.installerFactCards} /> : null}
        {model.currentStep.id === "config" ? (
          <SectionCard
            eyebrow="Config"
            title="写入 OpenClaw"
            description="只保留首次安装真正需要的字段。可选集成默认收起来，不再把所有配置同时摊开。"
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
            eyebrow="Interactive"
            title="应用内 Onboarding"
            description="终端只在这一步成为主舞台，不提前占据整个页面。"
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
          <summary>排障与最近输出</summary>
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
