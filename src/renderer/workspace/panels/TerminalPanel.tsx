import type { TerminalSession } from "../../../main/types";
import type { DerivedAppModel, IntentControls, TerminalControls } from "../../app/model";
import TerminalWorkspace from "../../shared/TerminalWorkspace";

interface TerminalPanelProps {
  model: DerivedAppModel;
  terminalSessions: TerminalSession[];
  intentControls: IntentControls;
  terminalControls: TerminalControls;
}

export default function TerminalPanel({ model, terminalSessions, intentControls, terminalControls }: TerminalPanelProps) {
  return (
    <TerminalWorkspace
      title="终端"
      description="Onboarding、调试 Shell 和实时输出都被收在这个面板里，不再挤占其他面板。"
      sessions={terminalSessions}
      activeTerminal={model.activeTerminal}
      activeBuffer={model.activeTerminalBuffer}
      intentControls={intentControls}
      terminalControls={terminalControls}
    />
  );
}
