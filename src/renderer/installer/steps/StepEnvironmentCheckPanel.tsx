import type { EnvironmentCheck, FactCard } from "../../app/model";
import StatusBadge from "../../shared/StatusBadge";

interface StepEnvironmentCheckPanelProps {
  checks: EnvironmentCheck[];
  facts: FactCard[];
}

export default function StepEnvironmentCheckPanel({ checks, facts }: StepEnvironmentCheckPanelProps) {
  return (
    <div className="wizard-step-content">
      <div className="wizard-notice">
        <strong>这一步只检查前置环境</strong>
        <p>这里只看系统、Shell、Node.js 和 npm。OpenClaw 本体会在后面的独立步骤里安装。</p>
      </div>

      <div className="wizard-check-list">
        {checks.map((check) => (
          <article key={check.label} className="wizard-check-row">
            <div>
              <strong>{check.label}</strong>
              <p>{check.probe.value || check.probe.note || "无详细信息"}</p>
            </div>
            <StatusBadge tone={check.probe.ok ? "ready" : "warning"}>{check.probe.ok ? "已就绪" : "待补齐"}</StatusBadge>
          </article>
        ))}
      </div>

      <div className="wizard-fact-grid">
        {facts.map((fact) => (
          <article key={fact.label} className="fact-card">
            <span>{fact.label}</span>
            <strong>{fact.value}</strong>
            <p>{fact.detail}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
