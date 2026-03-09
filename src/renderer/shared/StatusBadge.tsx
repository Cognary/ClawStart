import type { ReactNode } from "react";

interface StatusBadgeProps {
  tone: "ready" | "active" | "warning" | "neutral";
  children: ReactNode;
}

export default function StatusBadge({ tone, children }: StatusBadgeProps) {
  return <span className={`status-badge status-badge-${tone}`}>{children}</span>;
}
