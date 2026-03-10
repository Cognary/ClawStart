import type { DerivedAppModel } from "../app/model";
import StatusBadge from "../shared/StatusBadge";

interface InstallerSidebarProps {
  model: DerivedAppModel;
}

function stepTone(status: DerivedAppModel["steps"][number]["status"]) {
  if (status === "done") {
    return "ready" as const;
  }

  if (status === "current") {
    return "active" as const;
  }

  return "neutral" as const;
}

export default function InstallerSidebar({ model }: InstallerSidebarProps) {
  return (
    <aside className="sidebar sidebar-installer">
      <section className="sidebar-panel hero-panel">
        <p className="section-eyebrow">ClawStart</p>
        <h1>OpenClaw 安装向导</h1>
        <p className="hero-copy">第一次打开只做安装这一件事。左边告诉你当前做到哪一步，右边只显示当前步骤需要的操作。</p>
        <div className="progress-shell">
          <div>
            <span>安装进度</span>
            <strong>
              {model.completedSteps} / {model.steps.length}
            </strong>
          </div>
          <StatusBadge tone="active">{model.progressPercent}%</StatusBadge>
        </div>
        <div className="progress-track">
          <span style={{ width: `${model.progressPercent}%` }} />
        </div>
        <div className="summary-stack">
          {model.installerSidebarSummary.map((item) => (
            <div key={item.label} className="summary-row">
              <strong>{item.label}</strong>
              <StatusBadge tone={item.value.includes("未") ? "warning" : "ready"}>{item.value}</StatusBadge>
            </div>
          ))}
        </div>
        <p className="support-copy">当前阶段：{model.currentStep.title}</p>
      </section>

      <section className="sidebar-panel">
        <div className="sidebar-heading">
          <p className="section-eyebrow">Guide</p>
          <h2>安装步骤</h2>
        </div>
        <div className="step-nav">
          {model.steps.map((step) => (
            <article key={step.id} className={`step-nav-item step-nav-item-${step.status}`}>
              <div className="step-nav-head">
                <div className="step-number">{step.order}</div>
                <StatusBadge tone={stepTone(step.status)}>
                  {step.status === "done" ? "已完成" : step.status === "current" ? "当前步骤" : "未开始"}
                </StatusBadge>
              </div>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </article>
          ))}
        </div>
      </section>
    </aside>
  );
}
