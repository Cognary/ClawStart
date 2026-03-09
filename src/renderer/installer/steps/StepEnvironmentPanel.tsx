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
  const openclawReady = checks.find((item) => item.label === "openclaw")?.probe.ok ?? false;
  const dependencyReady = nodeReady && npmReady;

  const phases = [
    {
      key: "scan",
      label: "检测当前环境",
      detail: "逐项检查 Node.js、npm 和 OpenClaw CLI。",
      state: bootstrapRunning || openclawReady ? "done" : "active",
    },
    {
      key: "deps",
      label: "补齐运行依赖",
      detail: dependencyReady ? "Node.js 和 npm 已就绪。" : "缺少时会自动补齐所需依赖。",
      state: dependencyReady ? "done" : bootstrapRunning ? "active" : "pending",
    },
    {
      key: "openclaw",
      label: "安装 OpenClaw CLI",
      detail: openclawReady ? "当前已经检测到可用的 openclaw 命令。" : "依赖就绪后会继续安装 OpenClaw CLI。",
      state: openclawReady ? "done" : bootstrapRunning ? "active" : "pending",
    },
  ] as const;

  return (
    <div className="step-stage-grid">
      <section className="stage-panel environment-panel-main">
        <div className="panel-heading">
          <p className="section-eyebrow">Environment Bootstrap</p>
          <h3>自动检测并补齐环境</h3>
        </div>

        <article className={`environment-hero ${bootstrapRunning ? "is-running" : openclawReady ? "is-ready" : ""}`}>
          <div className="environment-hero-head">
            <div className={`environment-orb ${bootstrapRunning ? "is-running" : openclawReady ? "is-ready" : ""}`} />
            <div>
              <strong>{bootstrapRunning ? "正在自动准备环境" : openclawReady ? "环境已经准备完成" : "等待开始自动准备"}</strong>
              <p>{bootstrapRunning ? "缺少的环境会按顺序自动补齐，完成后直接进入配置步骤。" : "首次安装会先检查当前机器，再自动补齐缺失的依赖和 OpenClaw。"}</p>
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
        </article>

        <div className="check-list">
          {checks.map((check) => (
            <article key={check.label} className="check-item">
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
      </section>

      <section className="stage-panel environment-panel-side">
        <div className="panel-heading">
          <p className="section-eyebrow">Current Progress</p>
          <h3>过程与说明</h3>
        </div>

        <div className="fact-grid">
          {facts.map((fact) => (
            <article key={fact.label} className="fact-card">
              <span>{fact.label}</span>
              <strong>{fact.value}</strong>
              <p>{fact.detail}</p>
            </article>
          ))}
        </div>

        <div className="environment-log-shell">
          <div className="environment-log-head">
            <strong>最近过程</strong>
            <StatusBadge tone={bootstrapRunning ? "active" : openclawReady ? "ready" : "neutral"}>
              {bootstrapRunning ? "进行中" : openclawReady ? "已完成" : "待开始"}
            </StatusBadge>
          </div>

          {bootstrapLogs.length > 0 ? (
            <div className="environment-log-list">
              {[...bootstrapLogs].reverse().map((entry) => (
                <article key={entry.id} className={`environment-log-item environment-log-item-${entry.kind}`}>
                  <span>{entry.kind === "stderr" || entry.kind === "error" ? "异常" : "过程"}</span>
                  <p>{latestLogLine(entry)}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-copy">开始后，这里会实时显示检测、下载和安装过程。</p>
          )}
        </div>
      </section>
    </div>
  );
}
