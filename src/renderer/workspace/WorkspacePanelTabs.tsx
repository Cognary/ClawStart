import type { RunningTask, TerminalSession } from "../../main/types";
import type { DerivedAppModel, IntentControls, TerminalControls, WorkspacePanel } from "../app/model";
import WorkspaceOverview from "./WorkspaceOverview";
import ConfigPanel from "./panels/ConfigPanel";
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

const panelDescriptions: Record<WorkspacePanel, string> = {
  overview: "控制台首页只保留运行状态、问题和当前任务。",
  models: "把 provider、模型目录和认证凭证收在一个地方。",
  skills: "只维护搜索与 skills，不混入别的设置。",
  channels: "渠道接入独立成页，避免配置页变成长表单。",
  terminal: "应用内终端只在这里出现，不再挤占其他区域。",
  logs: "日志内容在这个面板里单独滚动，默认停在最新输出。",
  settings: "基础设置和高级 JSON5 只放在这里。",
};

const panelTitles: Record<WorkspacePanel, string> = {
  overview: "概览",
  models: "模型",
  skills: "Skills",
  channels: "渠道",
  terminal: "终端",
  logs: "日志",
  settings: "设置",
};

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
          <h2>{panelTitles[activePanel]}</h2>
        </div>
        <p className="section-description">{panelDescriptions[activePanel]}</p>
      </header>

      <div className="section-card-body">
        {activePanel === "overview" ? (
          <WorkspaceOverview
            model={model}
            controls={controls}
            message={model.doctorVerified ? "当前环境已经通过基础验证，可以直接进入维护。" : "建议先完成验证，再开始长期维护。"}
            tasks={tasks}
            busyTaskId={busyTaskId}
            onStopTask={onStopTask}
          />
        ) : null}
        {activePanel === "models" ? (
          <ConfigPanel
            model={model}
            configDraft={configDraft}
            setConfigDraft={setConfigDraft}
            configDirty={configDirty}
            controls={controls}
            section="models"
          />
        ) : null}
        {activePanel === "skills" ? (
          <ConfigPanel
            model={model}
            configDraft={configDraft}
            setConfigDraft={setConfigDraft}
            configDirty={configDirty}
            controls={controls}
            section="skills"
          />
        ) : null}
        {activePanel === "channels" ? (
          <ConfigPanel
            model={model}
            configDraft={configDraft}
            setConfigDraft={setConfigDraft}
            configDirty={configDirty}
            controls={controls}
            section="channels"
          />
        ) : null}
        {activePanel === "terminal" ? (
          <TerminalPanel model={model} terminalSessions={terminalSessions} intentControls={controls} terminalControls={terminalControls} />
        ) : null}
        {activePanel === "logs" ? <LogsPanel model={model} /> : null}
        {activePanel === "settings" ? (
          <ConfigPanel
            model={model}
            configDraft={configDraft}
            setConfigDraft={setConfigDraft}
            configDirty={configDirty}
            controls={controls}
            section="settings"
          />
        ) : null}
      </div>
    </section>
  );
}
