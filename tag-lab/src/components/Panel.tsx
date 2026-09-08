import type { PropsWithChildren } from "react";

interface PanelProps extends PropsWithChildren {
  title: string;
  eyebrow?: string;
  className?: string;
}

export function Panel({ title, eyebrow, className = "", children }: PanelProps) {
  return (
    <section className={`panel ${className}`.trim()}>
      <header className="panel-header">
        <h2>{title}</h2>
        {eyebrow && <span>{eyebrow}</span>}
      </header>
      <div className="panel-body">{children}</div>
    </section>
  );
}
