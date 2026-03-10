import type { InstallerSetupPayload, RunningTask, TerminalSession } from "../../main/types";
import type { DerivedAppModel, IntentControls, TerminalControls } from "../app/model";
import IntentButton from "../shared/IntentButton";
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
  controls: IntentControls;
  terminalControls: TerminalControls;
  terminalSessions: TerminalSession[];
  tasks: RunningTask[];
  busyTaskId: string | null;
  onStopTask: (taskId: string) => Promise<void>;
}

export default function InstallerShell({
  model,
  message,
  installerSetup,
  setInstallerSetup,
  controls,
  terminalControls,
  terminalSessions,
  tasks,
  busyTaskId,
  onStopTask,
}: InstallerShellProps) {
  const showShellActions =
    model.currentStep.id === "environmentCheck" ||
    model.currentStep.id === "environmentRepair" ||
    model.currentStep.id === "install" ||
    model.currentStep.id === "verify";

  return (
    <main className="wizard-shell">
      <div className="wizard-frame">
        <div className="wizard-brand">
          <p className="section-eyebrow">ClawStart</p>
          <h1>OpenClaw 启动器</h1>
          <p className="support-copy">第一次只做安装，安装完成后再进入控制台。</p>
        </div>

        <div className="wizard-stepper" aria-label="安装步骤">
          {model.steps.map((step, index) => (
            <div key={step.id} className="wizard-step-node-wrap">
              <div className={`wizard-step-node wizard-step-node-${step.status}`}>
                <span>{step.status === "done" ? "✓" : step.order}</span>
              </div>
              <div className={`wizard-step-label wizard-step-label-${step.status}`}>{step.title}</div>
              {index < model.steps.length - 1 ? <div className={`wizard-step-line wizard-step-line-${step.status === "done" ? "done" : "idle"}`} /> : null}
            </div>
          ))}
        </div>

        <section className="wizard-card">
          <header className="wizard-card-header">
            <div>
              <h2>{model.currentStep.title}</h2>
              <p>{message}</p>
            </div>
            <span className="wizard-card-step">
              {model.currentStep.order} / {model.steps.length}
            </span>
          </header>

          {model.currentStep.id === "environmentCheck" ? (
            <StepEnvironmentCheckPanel checks={model.checks} facts={model.installerFactCards} />
          ) : null}

          {model.currentStep.id === "environmentRepair" ? (
            <StepEnvironmentPanel checks={model.checks} facts={model.installerFactCards} logs={model.logs} tasks={tasks} />
          ) : null}

          {model.currentStep.id === "install" ? (
            <StepInstallPanel facts={model.installerFactCards} logs={model.logs} tasks={tasks} />
          ) : null}

          {model.currentStep.id === "config" ? (
            <StepConfigPanel configState={model.configState} setup={installerSetup} setSetup={setInstallerSetup} controls={controls} />
          ) : null}

          {model.currentStep.id === "onboarding" ? (
            <StepOnboardingPanel
              sessions={terminalSessions}
              activeTerminal={model.activeTerminal}
              activeBuffer={model.activeTerminalBuffer}
              intentControls={controls}
              terminalControls={terminalControls}
            />
          ) : null}

          {model.currentStep.id === "verify" ? (
            <StepVerifyPanel doctorVerified={model.doctorVerified} facts={model.installerFactCards} diagnostics={model.diagnostics} />
          ) : null}

          {showShellActions ? (
            <div className="wizard-primary-actions">
              <IntentButton intent={model.installerPrimaryAction.intent} fallbackLabel={model.installerPrimaryAction.label} variant="primary" {...controls} />
              <IntentButton intent={model.installerSecondaryAction.intent} fallbackLabel={model.installerSecondaryAction.label} {...controls} />
            </div>
          ) : null}

        </section>
      </div>
    </main>
  );
}
