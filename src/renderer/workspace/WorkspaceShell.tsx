import type { RunningTask, TerminalSession } from "../../main/types";
import type { DerivedAppModel, IntentControls, TerminalControls, WorkspacePanel } from "../app/model";
import WorkspaceOverview from "./WorkspaceOverview";
import WorkspacePanelTabs from "./WorkspacePanelTabs";
import WorkspaceSidebar from "./WorkspaceSidebar";
import WorkspaceStatusBar from "./WorkspaceStatusBar";

interface WorkspaceShellProps {
  model: DerivedAppModel;
  message: string;
  controls: IntentControls;
  terminalControls: TerminalControls;
  terminalSessions: TerminalSession[];
  tasks: RunningTask[];
  busyTaskId: string | null;
  onStopTask: (taskId: string) => Promise<void>;
  onOpenUpdates: () => void;
  onSwitchToInstaller: () => void;
  activePanel: WorkspacePanel;
  setActivePanel: (panel: WorkspacePanel) => void;
  configDraft: string;
  setConfigDraft: (next: string) => void;
  configDirty: boolean;
}

export default function WorkspaceShell({
  model,
  message,
  controls,
  terminalControls,
  terminalSessions,
  tasks,
  busyTaskId,
  onStopTask,
  onOpenUpdates,
  onSwitchToInstaller,
  activePanel,
  setActivePanel,
  configDraft,
  setConfigDraft,
  configDirty,
}: WorkspaceShellProps) {
  return (
    <div className="surface surface-workspace">
      <WorkspaceSidebar
        activePanel={activePanel}
        onOpenUpdates={onOpenUpdates}
        onSwitchToInstaller={onSwitchToInstaller}
        setActivePanel={setActivePanel}
      />

      <section className="stage stage-workspace">
        <WorkspaceStatusBar model={model} />
        <WorkspaceOverview model={model} controls={controls} message={message} />
        <WorkspacePanelTabs
          model={model}
          activePanel={activePanel}
          controls={controls}
          terminalControls={terminalControls}
          terminalSessions={terminalSessions}
          tasks={tasks}
          busyTaskId={busyTaskId}
          onStopTask={onStopTask}
          configDraft={configDraft}
          setConfigDraft={setConfigDraft}
          configDirty={configDirty}
        />
      </section>
    </div>
  );
}
