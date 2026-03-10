import type { RunningTask } from "../../../main/types";
import type { FactCard, LogEntry } from "../../app/model";
import StatusBadge from "../../shared/StatusBadge";

interface StepInstallPanelProps {
  facts: FactCard[];
  logs: LogEntry[];
  tasks: RunningTask[];
}

function latestLogLine(entry: LogEntry) {
  return entry.text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)[0];
}

export default function StepInstallPanel({ facts, logs, tasks }: StepInstallPanelProps) {
  const installRunning = tasks.some((task) => task.action === "installPortable" || task.action === "installRecommended");
  const installLogs = logs
    .filter(
      (entry) =>
        (entry.action === "installPortable" || entry.action === "installRecommended") &&
        (entry.kind === "stdout" || entry.kind === "stderr" || entry.kind === "error"),
    )
    .slice(0, 8);

  return (
    <div className="wizard-step-content">
      <div className={`wizard-progress-card${installRunning ? " is-running" : ""}`}>
        <div className="wizard-progress-head">
          <div className={`environment-orb ${installRunning ? "is-running" : ""}`} />
          <div>
            <strong>{installRunning ? "正在安装 OpenClaw CLI" : "准备安装 OpenClaw CLI"}</strong>
            <p>这一步只安装 `openclaw` 命令本身，不再混入 Node.js、npm 或配置表单。</p>
          </div>
        </div>
      </div>

      <div className="wizard-inline-log">
        <div className="wizard-inline-log-head">
          <strong>安装过程</strong>
          <span>{installRunning ? "安装中" : "待开始"}</span>
        </div>
        {installLogs.length > 0 ? (
          <div className="wizard-inline-log-list">
            {[...installLogs].reverse().map((entry) => (
              <article key={entry.id} className="wizard-inline-log-item">
                <div>
                  <strong>{entry.kind === "stderr" || entry.kind === "error" ? "异常" : "过程"}</strong>
                  <p>{latestLogLine(entry)}</p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-copy">开始安装后，这里会显示 OpenClaw CLI 的下载和安装输出。</p>
        )}
      </div>

      <div className="wizard-fact-grid">
        {facts.map((fact) => (
          <article key={fact.label} className="fact-card">
            <span>{fact.label}</span>
            <strong>{fact.value}</strong>
            <p>{fact.detail}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
