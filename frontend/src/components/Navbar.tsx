"use client";  // it needs the current URL, which only the browser knows

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity, Clapperboard, FolderOpen, HardDrive, Images, Network, Server, Users,
  type LucideIcon,
} from "lucide-react";

const TABS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "General", icon: Activity },
  { href: "/people", label: "People", icon: Users },
  { href: "/samba", label: "Samba", icon: FolderOpen },
  { href: "/immich", label: "Immich", icon: Images },
  { href: "/media", label: "Media", icon: Clapperboard },
  { href: "/storage", label: "Storage", icon: HardDrive },
  { href: "/tailscale", label: "Tailscale", icon: Network },
  { href: "/system", label: "System", icon: Server },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2 py-3 font-semibold">
          <Server className="size-5 text-indigo-500" />
          server-fbf
        </Link>

        {/* scrolls sideways on a phone instead of wrapping */}
        <nav className="-mb-px flex gap-1 overflow-x-auto">
          {TABS.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
                  active
                    ? "border-indigo-500 text-zinc-900 dark:text-white"
                    : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                }`}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}