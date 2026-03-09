import type { EnvironmentCheck, FactCard } from "../../app/model";
import StatusBadge from "../../shared/StatusBadge";

interface StepEnvironmentCheckPanelProps {
  checks: EnvironmentCheck[];
  facts: FactCard[];
}

export default function StepEnvironmentCheckPanel({ checks, facts }: StepEnvironmentCheckPanelProps) {
  return (
    <div className="step-stage-grid">
      <section className="stage-panel environment-panel-main">
        <div className="panel-heading">
          <p className="section-eyebrow">Environment Check</p>
          <h3>检查安装前置条件</h3>
        </div>

        <article className="environment-hero">
          <div className="environment-hero-head">
            <div className="environment-orb" />
            <div>
              <strong>正在确认当前机器是否具备安装条件</strong>
              <p>这一页只看前置环境，不看 OpenClaw 是否已经安装。缺少的前置项会在下一步自动补齐。</p>
            </div>
          </div>
          <div className="message-inline">
            <strong>这一页只回答一个问题</strong>
            <p>这台机器能不能开始安装 OpenClaw。真正缺什么，下一步再补。</p>
          </div>
        </article>

        <div className="check-list">
          {checks.map((check) => (
            <article key={check.label} className="check-item">
              <div>
                <strong>{check.label}</strong>
                <p>{check.probe.value || check.probe.note || "无详细信息"}</p>
              </div>
              <StatusBadge tone={check.probe.ok ? "ready" : "warning"}>{check.probe.ok ? "已就绪" : "待补齐"}</StatusBadge>
            </article>
          ))}
        </div>
      </section>

      <section className="stage-panel environment-panel-side">
        <div className="panel-heading">
          <p className="section-eyebrow">Check Result</p>
          <h3>当前判断</h3>
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
