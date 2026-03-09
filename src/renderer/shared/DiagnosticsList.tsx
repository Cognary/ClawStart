import type { DiagnosticCard, IntentControls } from "../app/model";
import IntentButton from "./IntentButton";
import StatusBadge from "./StatusBadge";

interface DiagnosticsListProps {
  diagnostics: DiagnosticCard[];
  controls: IntentControls;
  emptyTitle: string;
  emptyBody: string;
}

export default function DiagnosticsList({ diagnostics, controls, emptyTitle, emptyBody }: DiagnosticsListProps) {
  if (diagnostics.length === 0) {
    return (
      <article className="diagnostic-item diagnostic-item-info">
        <div className="inline-meta">
          <span className="mini-label">Healthy</span>
          <StatusBadge tone="ready">没有阻塞项</StatusBadge>
        </div>
        <h3>{emptyTitle}</h3>
        <p>{emptyBody}</p>
        <div className="intent-row">
          <IntentButton intent="runDoctor" fallbackLabel="运行 Doctor" variant="primary" {...controls} />
          <IntentButton intent="openTerminalShell" fallbackLabel="打开调试 Shell" {...controls} />
        </div>
      </article>
    );
  }

  return (
    <div className="diagnostic-list">
      {diagnostics.map((item) => (
        <article key={item.id} className={`diagnostic-item diagnostic-item-${item.severity}`}>
          <div className="inline-meta">
            <span className="mini-label">{item.severity}</span>
            <StatusBadge tone={item.severity === "blocking" ? "warning" : item.severity === "warning" ? "active" : "ready"}>
              {item.severity === "blocking" ? "阻塞项" : item.severity === "warning" ? "注意项" : "建议项"}
            </StatusBadge>
          </div>
          <h3>{item.title}</h3>
          <p>{item.body}</p>
          {item.evidence?.length ? (
            <div className="evidence-list">
              {item.evidence.map((entry) => (
                <code key={entry}>{entry}</code>
              ))}
            </div>
          ) : null}
          <div className="intent-row">
            {item.primaryAction ? (
              <IntentButton intent={item.primaryAction.intent} fallbackLabel={item.primaryAction.label} variant="primary" {...controls} />
            ) : null}
            {item.secondaryAction ? (
              <IntentButton intent={item.secondaryAction.intent} fallbackLabel={item.secondaryAction.label} {...controls} />
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}
