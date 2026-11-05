import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function Card({ title, icon: Icon, action, children, className = "" }: {
  title?: string;
  icon?: LucideIcon;
  action?: ReactNode;   // e.g. a button in the card's top-right corner
  children: ReactNode;
  className?: string;   // extra classes, e.g. to span two columns
}) {
  return (
    <section className={`rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${className}`}>
      {(title || Icon || action) && (
        <div className="mb-4 flex items-center gap-2">
          {Icon && <Icon className="size-4 text-zinc-400" />}
          {title && <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{title}</h2>}
          {action && <div className="ml-auto">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}