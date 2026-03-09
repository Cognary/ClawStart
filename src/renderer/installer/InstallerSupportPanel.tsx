import type { RunningTask } from "../../main/types";
import type { DiagnosticCard, InstallerSupportTab, IntentControls, LogEntry } from "../app/model";
import DiagnosticsList from "../shared/DiagnosticsList";
import LogsPanel from "../shared/LogsPanel";
import TaskList from "../shared/TaskList";

interface InstallerSupportPanelProps {
  activeTab: InstallerSupportTab;
  setActiveTab: (tab: InstallerSupportTab) => void;
  diagnostics: DiagnosticCard[];
  logs: LogEntry[];
  tasks: RunningTask[];
  controls: IntentControls;
  busyTaskId: string | null;
  onStopTask: (taskId: string) => Promise<void>;
}

export default function InstallerSupportPanel({
  activeTab,
  setActiveTab,
  diagnostics,
  logs,
  tasks,
  controls,
  busyTaskId,
  onStopTask,
}: InstallerSupportPanelProps) {
  return (
    <section className="section-card support-panel-card">
      <header className="section-card-header">
        <div>
          <p className="section-eyebrow">Support</p>
          <h2>辅助区</h2>
        </div>
        <p className="section-description">辅助信息必须切换着看，不再和主任务区同时争抢注意力。</p>
      </header>

      <div className="view-tabs">
        <button className={activeTab === "issues" ? "primary-button" : "ghost-button"} onClick={() => setActiveTab("issues")}>
          问题排查
        </button>
        <button className={activeTab === "output" ? "primary-button" : "ghost-button"} onClick={() => setActiveTab("output")}>
          最近输出
        </button>
        <button className={activeTab === "tasks" ? "primary-button" : "ghost-button"} onClick={() => setActiveTab("tasks")}>
          运行任务
        </button>
      </div>

      <div className="section-card-body">
        {activeTab === "issues" ? (
          <DiagnosticsList diagnostics={diagnostics} controls={controls} emptyTitle="当前没有明显阻塞项" emptyBody="当前步骤的主面板已经足够，只有出问题时再回来查看这里。" />
        ) : null}
        {activeTab === "output" ? <LogsPanel logs={logs} emptyMessage="还没有命令输出。当前步骤执行后，最近输出会显示在这里。" /> : null}
        {activeTab === "tasks" ? <TaskList tasks={tasks} busyTaskId={busyTaskId} onStopTask={onStopTask} emptyMessage="当前没有活动任务。" /> : null}
      </div>
    </section>
  );
}
