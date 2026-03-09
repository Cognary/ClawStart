import type { ReactNode } from "react";

interface SectionCardProps {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export default function SectionCard({ eyebrow, title, description, children, className }: SectionCardProps) {
  return (
    <section className={`section-card${className ? ` ${className}` : ""}`}>
      <header className="section-card-header">
        <div>
          <p className="section-eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        {description ? <p className="section-description">{description}</p> : null}
      </header>
      <div className="section-card-body">{children}</div>
    </section>
  );
}
