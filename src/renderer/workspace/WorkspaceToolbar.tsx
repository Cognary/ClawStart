import type { IntentControls, WorkspacePanel } from "../app/model";
import IntentButton from "../shared/IntentButton";

interface WorkspaceToolbarProps {
  activePanel: WorkspacePanel;
  controls: IntentControls;
}

const panelMeta: Record<WorkspacePanel, { eyebrow: string; title: string; description: string }> = {
  overview: {
    eyebrow: "Console",
    title: "运行概览",
    description: "服务状态在上面，当前问题、任务和入口都集中在这里。",
  },
  models: {
    eyebrow: "Models",
    title: "模型与认证",
    description: "管理当前 provider、模型目录、API Key 和 Codex 登录。",
  },
  skills: {
    eyebrow: "Skills",
    title: "Skills 与搜索",
    description: "调整 bundled skills、额外目录和搜索提供商。",
  },
  channels: {
    eyebrow: "Channels",
    title: "渠道配置",
    description: "维护 Telegram、Discord、WhatsApp、Signal 等接入。",
  },
  terminal: {
    eyebrow: "Terminal",
    title: "应用内终端",
    description: "Onboarding 和调试 Shell 只在这里出现。",
  },
  logs: {
    eyebrow: "Logs",
    title: "运行日志",
    description: "日志区域内部滚动，默认停在最新输出。",
  },
  settings: {
    eyebrow: "Settings",
    title: "基础设置",
    description: "维护 workspace、gateway、原始配置和高级入口。",
  },
};

export default function WorkspaceToolbar({ activePanel, controls }: WorkspaceToolbarProps) {
  const meta = panelMeta[activePanel];

  return (
    <section className="section-card workspace-toolbar">
      <div className="workspace-toolbar-copy">
        <p className="section-eyebrow">{meta.eyebrow}</p>
        <h2>{meta.title}</h2>
        <p className="section-description">{meta.description}</p>
      </div>

      <div className="intent-row workspace-toolbar-actions">
        <IntentButton intent="openDashboardUrl" fallbackLabel="打开 Dashboard" {...controls} />
        <IntentButton intent="runDoctor" fallbackLabel="重跑 Doctor" {...controls} />
        <IntentButton intent="runStatus" fallbackLabel="查看 Status" {...controls} />
      </div>
    </section>
  );
}
