import type { IntentControls, TerminalControls } from "../app/model";
import type { TerminalSession } from "../../main/types";
import EmbeddedTerminal from "../EmbeddedTerminal";
import IntentButton from "./IntentButton";

interface TerminalWorkspaceProps {
  title: string;
  description: string;
  sessions: TerminalSession[];
  activeTerminal: TerminalSession | null;
  activeBuffer: string;
  intentControls: IntentControls;
  terminalControls: TerminalControls;
}

export default function TerminalWorkspace({
  title,
  description,
  sessions,
  activeTerminal,
  activeBuffer,
  intentControls,
  terminalControls,
}: TerminalWorkspaceProps) {
  const hasOnboardingSession = sessions.some((session) => session.kind === "onboarding");
  const hasShellSession = sessions.some((session) => session.kind === "shell");
  const showLauncherRow = !hasOnboardingSession || !hasShellSession;

  return (
    <div className="terminal-workspace">
      <div className="terminal-copy">
        <p>{description}</p>
      </div>

      {showLauncherRow ? (
        <div className="intent-row">
          {!hasOnboardingSession ? (
            <IntentButton intent="openTerminalOnboarding" fallbackLabel="打开应用内 Onboarding" variant="primary" {...intentControls} />
          ) : null}
          {!hasShellSession ? <IntentButton intent="openTerminalShell" fallbackLabel="打开调试 Shell" {...intentControls} /> : null}
        </div>
      ) : null}

      <div className="session-strip">
        {sessions.length === 0 ? (
          <p className="empty-copy">还没有终端会话。需要交互时再从这里打开。</p>
        ) : (
          sessions.map((session) => (
            <button
              key={session.id}
              className={`session-pill${session.id === terminalControls.activeTerminalId ? " active" : ""}`}
              onClick={() => terminalControls.setActiveTerminalId(session.id)}
            >
              <strong>{session.label}</strong>
              <span>{session.running ? "运行中" : `退出 ${session.exitCode ?? "-"}`}</span>
            </button>
          ))
        )}
      </div>

      <div className="terminal-stage">
        {activeTerminal ? (
          <EmbeddedTerminal
            sessionId={terminalControls.activeTerminalId}
            buffer={activeBuffer}
            onInput={terminalControls.sendTerminalInput}
            onResize={terminalControls.resizeTerminal}
          />
        ) : (
          <div className="terminal-empty">
            <p>先启动一个应用内终端，会话就会显示在这里。</p>
          </div>
        )}
      </div>
    </div>
  );
}
