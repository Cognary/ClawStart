import type { DiagnosticCard, FactCard } from "../../app/model";
import StatusBadge from "../../shared/StatusBadge";

interface StepVerifyPanelProps {
  doctorVerified: boolean;
  facts: FactCard[];
  diagnostics: DiagnosticCard[];
}

export default function StepVerifyPanel({ doctorVerified, facts, diagnostics }: StepVerifyPanelProps) {
  const topIssue = diagnostics[0];

  return (
    <div className="step-stage-grid">
      <section className="stage-panel">
        <div className="panel-heading">
          <p className="section-eyebrow">Verify</p>
          <h3>{doctorVerified ? "安装完成" : "等待最终验证"}</h3>
        </div>
        <div className={`status-hero${doctorVerified ? " success" : ""}`}>
          <StatusBadge tone={doctorVerified ? "ready" : "active"}>{doctorVerified ? "已通过" : "待执行"}</StatusBadge>
          <strong>{doctorVerified ? "Doctor / Status 已成功完成" : "运行 Doctor 或 Status，确认环境真正可用"}</strong>
          <p>{doctorVerified ? "现在可以进入维护工作台，后续所有操作都会集中到维护界面。" : "通过后，安装向导会结束，页面切换成维护工作台。"}</p>
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

      <section className="stage-panel">
        <div className="panel-heading">
          <p className="section-eyebrow">Most Important Issue</p>
          <h3>{doctorVerified ? "安装已经完成" : "最终验证提醒"}</h3>
        </div>
        {doctorVerified ? (
          <div className="message-inline">
            <strong>下一步进入维护工作台</strong>
            <p>安装链路到这里结束。后续启动服务、改配置、看日志都进入维护界面处理。</p>
          </div>
        ) : topIssue ? (
          <article className={`diagnostic-item diagnostic-item-${topIssue.severity}`}>
            <h3>{topIssue.title}</h3>
            <p>{topIssue.body}</p>
          </article>
        ) : (
          <p className="empty-copy">当前没有明显阻塞项，可以直接完成安装。</p>
        )}
      </section>
    </div>
  );
}
