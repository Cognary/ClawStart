import type { RunningTask } from "../../main/types";
import type { DerivedAppModel, IntentControls } from "../app/model";
import DiagnosticsList from "../shared/DiagnosticsList";
import TaskList from "../shared/TaskList";

interface WorkspaceOverviewProps {
  model: DerivedAppModel;
  controls: IntentControls;
  message: string;
  tasks: RunningTask[];
  busyTaskId: string | null;
  onStopTask: (taskId: string) => Promise<void>;
}

export default function WorkspaceOverview({
  model,
  controls,
  message,
  tasks,
  busyTaskId,
  onStopTask,
}: WorkspaceOverviewProps) {
  return (
    <div className="workspace-overview-panel">
      <section className="section-card">
        <header className="section-card-header">
          <div>
            <p className="section-eyebrow">Overview</p>
            <h2>当前运行状态</h2>
          </div>
          <p className="section-description">{message}</p>
        </header>
        <div className="section-card-body">
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
      </section>

      <section className="section-card">
        <header className="section-card-header">
          <div>
            <p className="section-eyebrow">Diagnostics</p>
            <h2>当前问题</h2>
          </div>
          <p className="section-description">控制台首页只保留真正要处理的阻塞项和修复建议。</p>
        </header>
        <div className="section-card-body">
          <DiagnosticsList
            diagnostics={model.diagnostics}
            controls={controls}
            emptyTitle="当前没有明显阻塞项"
            emptyBody="环境、配置和服务都在可用范围内。"
          />
        </div>
      </section>

      <section className="section-card">
        <header className="section-card-header">
          <div>
            <p className="section-eyebrow">Runtime</p>
            <h2>当前任务</h2>
          </div>
          <p className="section-description">安装、验证、Gateway 或更新任务会出现在这里。</p>
        </header>
        <div className="section-card-body">
          <TaskList tasks={tasks} busyTaskId={busyTaskId} onStopTask={onStopTask} emptyMessage="当前没有活动任务。" />
        </div>
      </section>
    </div>
  );
}
