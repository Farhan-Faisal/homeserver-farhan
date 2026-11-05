import type { LucideIcon } from "lucide-react";

export function PageHeader({ icon: Icon, title, description }: {
  icon: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-6 flex items-center gap-3">
      <div className="rounded-xl bg-indigo-500/10 p-2.5 text-indigo-500">
        <Icon className="size-6" />
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-zinc-500">{description}</p>}
      </div>
    </div>
  );
}