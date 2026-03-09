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
      description="这一步只完成官方 Onboarding 配对。完成后回到最后一步跑 Doctor / Status。"
      {...props}
    />
  );
}
