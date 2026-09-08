"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { LogoFull, LogoMark } from "@/components/brand/logo";
import { navGroups } from "@/config/nav";
import { cn } from "@/lib/utils";
import { AgentPulse } from "@/components/agent/agent-pulse";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-hairline bg-ink lg:flex">
      <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-brand-500/25 to-transparent" />

      <div className="px-5 pb-6 pt-6">
        <Link href="/" className="block text-brand-500 transition-opacity hover:opacity-80">
          <LogoFull className="w-[150px]" />
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="eyebrow px-3 pb-2">{group.label}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      data-selected={active}
                      className={cn(
                        "selectable group flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-[13px] font-medium",
                        active ? "text-fg" : "text-fg-muted hover:text-fg",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-[17px] w-[17px] shrink-0 transition-colors",
                          active
                            ? "text-brand-400"
                            : "text-fg-faint group-hover:text-fg-muted",
                        )}
                        strokeWidth={1.8}
                      />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge && (
                        <span
                          className={cn(
                            "rounded-md px-1.5 py-0.5 text-[10px] font-bold",
                            item.badge === "IA"
                              ? "bg-brand-500/15 text-brand-300 ring-1 ring-inset ring-brand-500/30"
                              : "bg-white/[0.07] text-fg-muted ring-1 ring-inset ring-white/10",
                          )}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="px-3 pb-3">
        <AgentPulse />
      </div>

      <div className="border-t border-hairline p-3">
        <button className="selectable group flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left">
          <div className="relative">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-[12px] font-bold text-white">
              MZ
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-ink bg-positive" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-fg">Mateus Zumach</p>
            <p className="truncate text-[11px] text-fg-faint">Administrador</p>
          </div>
          <LogOut
            className="h-4 w-4 text-fg-ghost transition-colors group-hover:text-fg-muted"
            strokeWidth={1.8}
          />
        </button>
      </div>
    </aside>
  );
}

/** Barra inferior para telas estreitas. */
export function MobileNav() {
  const pathname = usePathname();
  const items = navGroups.flatMap((g) => g.items).slice(0, 5);

  return (
    <nav className="glass fixed inset-x-0 bottom-0 z-40 border-x-0 border-b-0 lg:hidden">
      <ul className="flex items-stretch justify-around px-2 py-1.5">
        {items.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[10px] font-medium transition-colors",
                  active ? "text-brand-400" : "text-fg-faint",
                )}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                <span className="truncate">{item.label.split(" ")[0]}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Marca compacta usada na barra superior em telas estreitas. */
export function BrandCompact() {
  return (
    <div className="flex items-center gap-2 text-brand-500 lg:hidden">
      <LogoMark className="h-6" />
      <LogoFull className="w-[104px]" />
    </div>
  );
}
