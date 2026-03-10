import type { InstallerSetupPayload, RunningTask, TerminalSession } from "../../main/types";
import type { DerivedAppModel, IntentControls, TerminalControls } from "../app/model";
import IntentButton from "../shared/IntentButton";
import SectionCard from "../shared/SectionCard";
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
              <p>{model.currentStep.description}</p>
            </div>
            <span className="wizard-card-step">
              {model.currentStep.order} / {model.steps.length}
            </span>
          </header>

          <div className="wizard-callout">
            <strong>当前状态</strong>
            <p>{message}</p>
          </div>

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
            <SectionCard
              eyebrow="Setup"
              title="首次配置"
              description="只写入第一次真正需要的配置，安装完成后再进控制台做维护级设置。"
              className="wizard-embedded-card"
            >
              <StepConfigPanel configState={model.configState} setup={installerSetup} setSetup={setInstallerSetup} controls={controls} />
            </SectionCard>
          ) : null}

          {model.currentStep.id === "onboarding" ? (
            <SectionCard
              eyebrow="Interactive"
              title="完成 Onboarding"
              description="这一页只做官方交互式配对，不提前暴露维护动作。"
              className="wizard-embedded-card"
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

          {showShellActions ? (
            <div className="wizard-primary-actions">
              <IntentButton intent={model.installerPrimaryAction.intent} fallbackLabel={model.installerPrimaryAction.label} variant="primary" {...controls} />
              <IntentButton intent={model.installerSecondaryAction.intent} fallbackLabel={model.installerSecondaryAction.label} {...controls} />
            </div>
          ) : null}

          {tasks.length > 0 ? (
            <div className="wizard-inline-log">
              <div className="wizard-inline-log-head">
                <strong>当前任务</strong>
                <span>{tasks.length} 个运行中</span>
              </div>
              <div className="wizard-inline-log-list">
                {tasks.map((task) => (
                  <article key={task.id} className="wizard-inline-log-item">
                    <div>
                      <strong>{task.label}</strong>
                      <p>{new Date(task.startedAt).toLocaleTimeString()}</p>
                    </div>
                    <button className="ghost-button" disabled={busyTaskId === task.id} onClick={() => void onStopTask(task.id)}>
                      {busyTaskId === task.id ? "停止中..." : "停止"}
                    </button>
                  </article>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
