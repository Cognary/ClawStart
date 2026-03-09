import type { RunningTask, TerminalSession } from "../../main/types";
import type { DerivedAppModel, IntentControls, TerminalControls, WorkspacePanel } from "../app/model";
import TaskList from "../shared/TaskList";
import ConfigPanel from "./panels/ConfigPanel";
import DiagnosticsPanel from "./panels/DiagnosticsPanel";
import LogsPanel from "./panels/LogsPanel";
import TerminalPanel from "./panels/TerminalPanel";

interface WorkspacePanelTabsProps {
  model: DerivedAppModel;
  activePanel: WorkspacePanel;
  controls: IntentControls;
  terminalControls: TerminalControls;
  terminalSessions: TerminalSession[];
  tasks: RunningTask[];
  busyTaskId: string | null;
  onStopTask: (taskId: string) => Promise<void>;
  configDraft: string;
  setConfigDraft: (next: string) => void;
  configDirty: boolean;
}

export default function WorkspacePanelTabs({
  model,
  activePanel,
  controls,
  terminalControls,
  terminalSessions,
  tasks,
  busyTaskId,
  onStopTask,
  configDraft,
  setConfigDraft,
  configDirty,
}: WorkspacePanelTabsProps) {
  return (
    <section className={`section-card workspace-panel-shell workspace-panel-${activePanel}`}>
      <header className="section-card-header">
        <div>
          <h2>
            {activePanel === "diagnostics"
              ? "诊断"
              : activePanel === "terminal"
                ? "终端"
                : activePanel === "config"
                  ? "配置"
                  : "日志"}
          </h2>
        </div>
        <p className="section-description">
          {activePanel === "diagnostics"
            ? "只显示当前真正需要处理的问题和修复建议。"
            : activePanel === "terminal"
              ? "应用内终端只在这里出现，不再挤占其他区域。"
              : activePanel === "config"
                ? "这里专门维护 OpenClaw 配置，不混入别的内容。"
                : "日志内容在这个面板里单独滚动，默认停在最新输出。"}
        </p>
      </header>

      <div className="section-card-body">
        {activePanel === "diagnostics" ? <DiagnosticsPanel model={model} controls={controls} /> : null}
        {activePanel === "terminal" ? (
          <TerminalPanel model={model} terminalSessions={terminalSessions} intentControls={controls} terminalControls={terminalControls} />
        ) : null}
        {activePanel === "config" ? (
          <ConfigPanel model={model} configDraft={configDraft} setConfigDraft={setConfigDraft} configDirty={configDirty} controls={controls} />
        ) : null}
        {activePanel === "logs" ? <LogsPanel model={model} /> : null}
      </div>

      {tasks.length > 0 ? (
        <div className="section-card-body section-card-footer">
          <div className="panel-heading">
            <p className="section-eyebrow">Runtime</p>
            <h3>当前任务</h3>
          </div>
          <TaskList tasks={tasks} busyTaskId={busyTaskId} onStopTask={onStopTask} emptyMessage="当前没有活动任务。" />
        </div>
      ) : null}
    </section>
  );
}
