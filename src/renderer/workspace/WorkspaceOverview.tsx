import { useState } from "react";
import type { DerivedAppModel, IntentControls } from "../app/model";
import IntentButton from "../shared/IntentButton";

interface WorkspaceOverviewProps {
  model: DerivedAppModel;
  controls: IntentControls;
  message: string;
}

export default function WorkspaceOverview({ model, controls, message }: WorkspaceOverviewProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className={`section-card workspace-overview-shell${expanded ? " expanded" : " collapsed"}`}>
      <header className="section-card-header workspace-overview-toolbar">
        <button className="sidebar-text-button workspace-overview-toggle" onClick={() => setExpanded((current) => !current)}>
          {expanded ? "收起运行概览" : "展开运行概览"}
        </button>

        <div className="intent-row workspace-overview-actions">
          <IntentButton intent="openDashboardUrl" fallbackLabel="打开 Dashboard" {...controls} />
          <IntentButton intent="runDoctor" fallbackLabel="重跑 Doctor" {...controls} />
          <IntentButton intent="runStatus" fallbackLabel="查看 Status" {...controls} />
        </div>
      </header>
      {expanded ? (
        <div className="section-card-body workspace-overview-body">
          <div className="workspace-overview-copy">
            <p className="section-eyebrow">Overview</p>
            <h2>运行概览</h2>
            <p className="section-description">{message}</p>
          </div>

          <div className="overview-grid">
            {model.workspaceOverviewCards.map((card) => (
              <article key={card.id} className={`overview-card overview-card-${card.tone}`}>
                <span>{card.label}</span>
                <strong>{card.value}</strong>
                <p>{card.detail}</p>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
