import type { DiagnosticAction, IntentControls, StepCard } from "../app/model";
import IntentButton from "../shared/IntentButton";
import StatusBadge from "../shared/StatusBadge";

interface StepHeaderProps {
  step: StepCard;
  totalSteps: number;
  summary: string;
  primaryAction: DiagnosticAction;
  secondaryAction: DiagnosticAction;
  controls: IntentControls;
  showActions?: boolean;
}

export default function StepHeader({
  step,
  totalSteps,
  summary,
  primaryAction,
  secondaryAction,
  controls,
  showActions = true,
}: StepHeaderProps) {
  return (
    <section className="stage-header installer-step-header">
      <div className="stage-header-copy">
        <div className="inline-meta">
          <p className="section-eyebrow">Current Step</p>
          <StatusBadge tone={step.status === "done" ? "ready" : "active"}>
            {step.order} / {totalSteps}
          </StatusBadge>
        </div>
        <h2>{step.title}</h2>
        <p>{step.description}</p>
        <div className="message-inline installer-step-summary">
          <strong>完成这一页后会发生什么</strong>
          <p>{summary}</p>
        </div>
      </div>

      {showActions ? (
        <div className="stage-actions">
          <IntentButton intent={primaryAction.intent} fallbackLabel={primaryAction.label} variant="primary" {...controls} />
          <IntentButton intent={secondaryAction.intent} fallbackLabel={secondaryAction.label} {...controls} />
        </div>
      ) : null}
    </section>
  );
}
