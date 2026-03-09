import type { WorkspacePanel } from "../app/model";

interface WorkspaceSidebarProps {
  activePanel: WorkspacePanel;
  onOpenUpdates: () => void;
  onSwitchToInstaller: () => void;
  setActivePanel: (panel: WorkspacePanel) => void;
}

const workspacePanelItems: Array<{ id: WorkspacePanel; label: string; description: string }> = [
  { id: "diagnostics", label: "诊断", description: "看当前问题和修复建议。" },
  { id: "terminal", label: "终端", description: "处理 Onboarding 和调试 Shell。" },
  { id: "config", label: "配置", description: "维护 OpenClaw 配置。" },
  { id: "logs", label: "日志", description: "查看最近输出和运行痕迹。" },
];

export default function WorkspaceSidebar({
  activePanel,
  onOpenUpdates,
  onSwitchToInstaller,
  setActivePanel,
}: WorkspaceSidebarProps) {
  return (
    <aside className="sidebar sidebar-workspace">
      <section className="sidebar-panel hero-panel">
        <p className="section-eyebrow">ClawStart</p>
        <h1>OpenClaw 工作台</h1>
        <p className="hero-copy">安装已经完成，现在这里专门负责启动、检查、配置和日志维护。</p>
      </section>

      <nav className="workspace-menu" aria-label="维护面板">
        <p className="section-eyebrow">Workspace</p>
        <div className="workspace-menu-list">
          {workspacePanelItems.map((item) => (
            <button
              key={item.id}
              className={`workspace-menu-item${activePanel === item.id ? " active" : ""}`}
              onClick={() => setActivePanel(item.id)}
            >
              <strong>{item.label}</strong>
              <span>{item.description}</span>
            </button>
          ))}
        </div>
      </nav>

      <div className="sidebar-footer-actions">
        <button className="sidebar-text-button" onClick={onSwitchToInstaller}>
          重新进入安装引导
        </button>
        <button className="ghost-button sidebar-footer-button" onClick={onOpenUpdates}>
          更新中心
        </button>
      </div>
    </aside>
  );
}
