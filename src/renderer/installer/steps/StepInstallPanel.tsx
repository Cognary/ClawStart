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
    <div className="step-stage-grid">
      <section className="stage-panel environment-panel-main">
        <div className="panel-heading">
          <p className="section-eyebrow">CLI Install</p>
          <h3>安装 OpenClaw CLI</h3>
        </div>

        <article className={`environment-hero ${installRunning ? "is-running" : ""}`}>
          <div className="environment-hero-head">
            <div className={`environment-orb ${installRunning ? "is-running" : ""}`} />
            <div>
              <strong>{installRunning ? "正在安装 OpenClaw CLI" : "准备安装 OpenClaw CLI"}</strong>
              <p>这一步只处理 OpenClaw CLI 本身，不再混入 Node.js、npm 或配置表单。</p>
            </div>
          </div>
          <div className="message-inline">
            <strong>当前阶段只做一件事</strong>
            <p>确认前置环境已经就绪，然后把 `openclaw` 命令真正装到当前机器上。</p>
          </div>
        </article>

        <div className="fact-grid">
          {facts.map((fact) => (
            <article key={fact.label} className="fact-card">
              <span>{fact.label}</span>
              <strong>{fact.value}</strong>
              <p>{fact.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="stage-panel environment-panel-side">
        <div className="panel-heading">
          <p className="section-eyebrow">Install Output</p>
          <h3>安装过程</h3>
        </div>

        <div className="environment-log-shell">
          <div className="environment-log-head">
            <strong>最近输出</strong>
            <StatusBadge tone={installRunning ? "active" : "neutral"}>{installRunning ? "安装中" : "待开始"}</StatusBadge>
          </div>

          {installLogs.length > 0 ? (
            <div className="environment-log-list">
              {[...installLogs].reverse().map((entry) => (
                <article key={entry.id} className={`environment-log-item environment-log-item-${entry.kind}`}>
                  <span>{entry.kind === "stderr" || entry.kind === "error" ? "异常" : "过程"}</span>
                  <p>{latestLogLine(entry)}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-copy">开始安装后，这里会显示 OpenClaw CLI 的下载和安装输出。</p>
          )}
        </div>
      </section>
    </div>
  );
}
