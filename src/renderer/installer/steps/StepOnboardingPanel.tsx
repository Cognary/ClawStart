import type { IntentControls, TerminalControls } from "../../app/model";
import type { TerminalSession } from "../../../main/types";
import TerminalWorkspace from "../../shared/TerminalWorkspace";

interface StepOnboardingPanelProps {
  sessions: TerminalSession[];
  activeTerminal: TerminalSession | null;
  activeBuffer: string;
  intentControls: IntentControls;
  terminalControls: TerminalControls;
}

export default function StepOnboardingPanel(props: StepOnboardingPanelProps) {
  return (
    <TerminalWorkspace
      title="应用内 Onboarding"
      description="这一阶段只需要在应用内完成配对。调试 Shell 只在遇到 PATH、网络或权限问题时使用。"
      {...props}
    />
  );
}
