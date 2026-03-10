import type { WorkspacePanel } from "../app/model";

interface WorkspaceSidebarProps {
  activePanel: WorkspacePanel;
  onOpenUpdates: () => void;
  onSwitchToInstaller: () => void;
  setActivePanel: (panel: WorkspacePanel) => void;
}

const workspacePanelItems: Array<{ id: WorkspacePanel; label: string; description: string }> = [
  { id: "overview", label: "概览", description: "查看服务状态、当前问题和运行任务。" },
  { id: "models", label: "模型", description: "切换提供商、模型和认证凭证。" },
  { id: "skills", label: "Skills", description: "管理搜索、bundled skills 和加载策略。" },
  { id: "channels", label: "渠道", description: "维护 Telegram、Discord、WhatsApp、Signal。" },
  { id: "terminal", label: "终端", description: "处理 Onboarding 和调试 Shell。" },
  { id: "logs", label: "日志", description: "查看最近输出和运行痕迹。" },
  { id: "settings", label: "设置", description: "维护 workspace、gateway 和高级 JSON5。" },
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
        <h1>OpenClaw 控制台</h1>
        <p className="hero-copy">安装完成后，这里只负责运行、配置、渠道、日志和长期维护。</p>
      </section>

      <nav className="workspace-menu" aria-label="控制台导航">
        <p className="section-eyebrow">Console</p>
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
