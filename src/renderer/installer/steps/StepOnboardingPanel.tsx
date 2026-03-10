import type { IntentControls, TerminalControls } from "../../app/model";
import type { TerminalSession } from "../../../main/types";
import EmbeddedTerminal from "../../EmbeddedTerminal";
import IntentButton from "../../shared/IntentButton";

interface StepOnboardingPanelProps {
  sessions: TerminalSession[];
  activeTerminal: TerminalSession | null;
  activeBuffer: string;
  intentControls: IntentControls;
  terminalControls: TerminalControls;
}

export default function StepOnboardingPanel({
  sessions,
  activeTerminal,
  activeBuffer,
  intentControls,
  terminalControls,
}: StepOnboardingPanelProps) {
  const onboardingSession = sessions.find((session) => session.kind === "onboarding");
  const shellSession = sessions.find((session) => session.kind === "shell");

  return (
    <div className="wizard-step-content">
      <div className="wizard-notice">
        <strong>这一步只做官方交互式配对</strong>
        <p>先完成 Onboarding。真的需要排障时，再打开调试 Shell。</p>
      </div>

      <div className="wizard-primary-actions wizard-primary-actions-start">
        <IntentButton intent="openTerminalOnboarding" fallbackLabel="开始 Onboarding" variant="primary" {...intentControls} />
        <IntentButton intent="openTerminalShell" fallbackLabel="打开调试 Shell" {...intentControls} />
      </div>

      {sessions.length > 0 ? (
        <div className="session-strip">
          {onboardingSession ? (
            <button
              className={`session-pill${onboardingSession.id === terminalControls.activeTerminalId ? " active" : ""}`}
              onClick={() => terminalControls.setActiveTerminalId(onboardingSession.id)}
            >
              <strong>应用内 Onboarding</strong>
              <span>{onboardingSession.running ? "运行中" : `退出 ${onboardingSession.exitCode ?? "-"}`}</span>
            </button>
          ) : null}
          {shellSession ? (
            <button
              className={`session-pill${shellSession.id === terminalControls.activeTerminalId ? " active" : ""}`}
              onClick={() => terminalControls.setActiveTerminalId(shellSession.id)}
            >
              <strong>调试 Shell</strong>
              <span>{shellSession.running ? "运行中" : `退出 ${shellSession.exitCode ?? "-"}`}</span>
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="terminal-stage wizard-terminal-stage">
        {activeTerminal ? (
          <EmbeddedTerminal
            sessionId={terminalControls.activeTerminalId}
            buffer={activeBuffer}
            onInput={terminalControls.sendTerminalInput}
            onResize={terminalControls.resizeTerminal}
          />
        ) : (
          <div className="terminal-empty">
            <p>点击“开始 Onboarding”后，终端会显示在这里。</p>
          </div>
        )}
      </div>
    </div>
  );
}
