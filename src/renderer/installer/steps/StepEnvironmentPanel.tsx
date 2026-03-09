import type { EnvironmentCheck, FactCard } from "../../app/model";
import StatusBadge from "../../shared/StatusBadge";

interface StepEnvironmentPanelProps {
  checks: EnvironmentCheck[];
  facts: FactCard[];
}

export default function StepEnvironmentPanel({ checks, facts }: StepEnvironmentPanelProps) {
  return (
    <div className="step-stage-grid">
      <section className="stage-panel">
        <div className="panel-heading">
          <p className="section-eyebrow">Checks</p>
          <h3>环境确认</h3>
        </div>
        <div className="check-list">
          {checks.map((check) => (
            <article key={check.label} className="check-item">
              <div>
                <strong>{check.label}</strong>
                <p>{check.probe.value || check.probe.note || "无详细信息"}</p>
              </div>
              <StatusBadge tone={check.probe.ok ? "ready" : "warning"}>{check.probe.ok ? "已满足" : "待处理"}</StatusBadge>
            </article>
          ))}
        </div>
      </section>

      <section className="stage-panel">
        <div className="panel-heading">
          <p className="section-eyebrow">What This Step Does</p>
          <h3>当前阶段说明</h3>
        </div>
        <div className="fact-grid">
          {facts.map((fact) => (
            <article key={fact.label} className="fact-card">
              <span>{fact.label}</span>
              <strong>{fact.value}</strong>
              <p>{fact.detail}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
