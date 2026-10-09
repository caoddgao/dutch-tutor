import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import "./EmptyState.css";

interface Props {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, children, action }: Props) {
  return (
    <section className="card empty-state">
      <div className="empty-icon">
        <Icon size={30} strokeWidth={1.8} aria-hidden />
      </div>
      <h2 className="empty-title">{title}</h2>
      {children && <p className="empty-text">{children}</p>}
      {action && <div className="empty-action">{action}</div>}
    </section>
  );
}
