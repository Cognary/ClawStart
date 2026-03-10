import type { RunningTask } from "../../../main/types";
import type { EnvironmentCheck, FactCard, LogEntry } from "../../app/model";
import StatusBadge from "../../shared/StatusBadge";

interface StepEnvironmentPanelProps {
  checks: EnvironmentCheck[];
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

export default function StepEnvironmentPanel({ checks, facts, logs, tasks }: StepEnvironmentPanelProps) {
  const bootstrapRunning = tasks.some((task) => task.action === "bootstrapEnvironment");
  const bootstrapLogs = logs
    .filter((entry) => entry.action === "bootstrapEnvironment" && (entry.kind === "stdout" || entry.kind === "stderr" || entry.kind === "error"))
    .slice(0, 8);

  const nodeReady = checks.find((item) => item.label === "Node.js")?.probe.ok ?? false;
  const npmReady = checks.find((item) => item.label === "npm")?.probe.ok ?? false;
  const dependencyReady = nodeReady && npmReady;

  const phases = [
    {
      key: "scan",
      label: "检测当前环境",
      detail: "逐项检查 Node.js 和 npm 是否已经可用。",
      state: dependencyReady || bootstrapRunning ? "done" : "active",
    },
    {
      key: "deps",
      label: "补齐运行依赖",
      detail: dependencyReady ? "Node.js 和 npm 已就绪。" : "缺少时会自动补齐所需依赖。",
      state: dependencyReady ? "done" : bootstrapRunning ? "active" : "pending",
    },
    {
      key: "finish",
      label: "结束前置准备",
      detail: dependencyReady ? "环境前置条件已经齐了，可以继续安装 OpenClaw CLI。" : "前置环境补齐后，下一步才开始安装 OpenClaw CLI。",
      state: dependencyReady ? "done" : bootstrapRunning ? "active" : "pending",
    },
  ] as const;

  return (
    <div className="wizard-step-content">
      <div className={`wizard-progress-card${bootstrapRunning ? " is-running" : dependencyReady ? " is-ready" : ""}`}>
        <div className="wizard-progress-head">
          <div className={`environment-orb ${bootstrapRunning ? "is-running" : dependencyReady ? "is-ready" : ""}`} />
          <div>
            <strong>{bootstrapRunning ? "正在自动补齐环境" : dependencyReady ? "环境准备完成" : "等待开始自动补齐环境"}</strong>
            <p>这里只补前置依赖，不会在这一步偷偷安装 OpenClaw CLI。</p>
          </div>
        </div>

        <div className="environment-phase-list">
          {phases.map((phase) => (
            <article key={phase.key} className={`environment-phase environment-phase-${phase.state}`}>
              <div className="environment-phase-mark" />
              <div>
                <strong>{phase.label}</strong>
                <p>{phase.detail}</p>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="wizard-check-list">
        {checks.map((check) => (
          <article key={check.label} className="wizard-check-row">
            <div>
              <strong>{check.label}</strong>
              <p>{check.probe.value || check.probe.note || "无详细信息"}</p>
            </div>
            <StatusBadge tone={check.probe.ok ? "ready" : bootstrapRunning ? "active" : "warning"}>
              {check.probe.ok ? "已就绪" : bootstrapRunning ? "处理中" : "待处理"}
            </StatusBadge>
          </article>
        ))}
      </div>

      <div className="wizard-inline-log">
        <div className="wizard-inline-log-head">
          <strong>最近过程</strong>
          <span>{bootstrapRunning ? "进行中" : dependencyReady ? "已完成" : "待开始"}</span>
        </div>
        {bootstrapLogs.length > 0 ? (
          <div className="wizard-inline-log-list">
            {[...bootstrapLogs].reverse().map((entry) => (
              <article key={entry.id} className="wizard-inline-log-item">
                <div>
                  <strong>{entry.kind === "stderr" || entry.kind === "error" ? "异常" : "过程"}</strong>
                  <p>{latestLogLine(entry)}</p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-copy">开始后，这里会实时显示环境检测、下载和安装过程。</p>
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
