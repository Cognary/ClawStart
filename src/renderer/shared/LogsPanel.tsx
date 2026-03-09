import { useEffect, useMemo, useRef } from "react";
import type { LogEntry } from "../app/model";

interface LogsPanelProps {
  logs: LogEntry[];
  emptyMessage: string;
}

export default function LogsPanel({ logs, emptyMessage }: LogsPanelProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const orderedLogs = useMemo(() => [...logs].reverse(), [logs]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) {
      return;
    }

    node.scrollTop = node.scrollHeight;
  }, [orderedLogs]);

  if (logs.length === 0) {
    return <p className="empty-copy">{emptyMessage}</p>;
  }

  return (
    <div ref={scrollRef} className="logs-panel-scroll">
      <div className="logs-list">
        {orderedLogs.map((entry) => (
          <article key={entry.id} className={`log-entry log-entry-${entry.kind}`}>
            <div className="log-entry-head">
              <span className="log-chip">{entry.action}</span>
              {entry.kind === "exit" ? <span className="log-chip log-chip-muted">exit {entry.code ?? "-"}</span> : null}
            </div>
            <pre>{entry.text}</pre>
          </article>
        ))}
      </div>
    </div>
  );
}
