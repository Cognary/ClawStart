import type { DerivedAppModel } from "../app/model";

interface WorkspaceStatusBarProps {
  model: DerivedAppModel;
}

function serviceToneFor(value: string) {
  if (value === "运行中") {
    return "active";
  }

  if (value === "未启动") {
    return "warning";
  }

  return "neutral";
}

export default function WorkspaceStatusBar({ model }: WorkspaceStatusBarProps) {
  return (
    <div className="workspace-status-bar" aria-label="服务状态">
      <div className="workspace-status-strip">
        {model.workspaceSidebarStatus.map((item) => (
          <div key={item.label} className={`workspace-status-pill workspace-status-pill-${serviceToneFor(item.value)}`}>
            <span className="workspace-status-dot" aria-hidden="true" />
            <span className="workspace-status-label">{item.label}</span>
            <span className="workspace-status-value">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
