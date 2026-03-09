import type { FactCard } from "../../app/model";

interface StepInstallPanelProps {
  facts: FactCard[];
}

export default function StepInstallPanel({ facts }: StepInstallPanelProps) {
  return (
    <section className="stage-panel">
      <div className="panel-heading">
        <p className="section-eyebrow">Install</p>
        <h3>安装说明</h3>
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
      <div className="message-inline">
        <strong>当前阶段只做一件事</strong>
        <p>先把 CLI 装好。配置、Onboarding 和维护工具都留到后面的步骤。</p>
      </div>
    </section>
  );
}
