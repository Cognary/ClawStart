import type { DiagnosticAction, IntentControls, StepCard } from "../app/model";
import IntentButton from "../shared/IntentButton";
import StatusBadge from "../shared/StatusBadge";

interface StepHeaderProps {
  step: StepCard;
  summary: string;
  primaryAction: DiagnosticAction;
  secondaryAction: DiagnosticAction;
  controls: IntentControls;
  showActions?: boolean;
}

export default function StepHeader({ step, summary, primaryAction, secondaryAction, controls, showActions = true }: StepHeaderProps) {
  return (
    <section className="stage-header">
      <div className="stage-header-copy">
        <div className="inline-meta">
          <p className="section-eyebrow">Current Step</p>
          <StatusBadge tone={step.status === "done" ? "ready" : "active"}>{step.label}</StatusBadge>
        </div>
        <h2>{step.title}</h2>
        <p>{step.description}</p>
        <p className="support-copy">{summary}</p>
      </div>

      {showActions ? (
        <div className="stage-actions">
          <IntentButton intent={primaryAction.intent} fallbackLabel={primaryAction.label} variant="primary" {...controls} />
          <IntentButton intent={secondaryAction.intent} fallbackLabel={secondaryAction.label} {...controls} />
          <IntentButton intent="refreshAll" fallbackLabel="重新检测" {...controls} />
        </div>
      ) : null}
    </section>
  );
}
