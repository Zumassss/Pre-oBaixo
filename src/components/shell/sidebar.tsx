"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, LogOut } from "lucide-react";
import { LogoFull } from "@/components/brand/logo";
import { navGroups } from "@/config/nav";
import { cn } from "@/lib/utils";
import { AgentPulse } from "@/components/agent/agent-pulse";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col border-r border-hairline bg-ink/70 backdrop-blur-2xl lg:flex">
      {/* Brilho vertical na borda direita */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-brand-500/25 to-transparent" />

      <div className="px-6 pb-5 pt-6">
        <Link href="/" className="block">
          <LogoFull />
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
                      className={cn(
                        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-all duration-200",
                        active
                          ? "text-fg"
                          : "text-fg-muted hover:bg-white/[0.04] hover:text-fg",
                      )}
                    >
                      {active && (
                        <>
                          <span className="absolute inset-0 rounded-xl border border-hairline-strong bg-gradient-to-r from-brand-500/[0.16] via-white/[0.05] to-transparent" />
                          <span className="absolute right-2 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-brand-500 shadow-[0_0_12px_2px_rgba(255,23,65,0.65)]" />
                        </>
                      )}
                      <Icon
                        className={cn(
                          "relative z-10 h-[17px] w-[17px] transition-colors",
                          active
                            ? "text-brand-400"
                            : "text-fg-faint group-hover:text-fg-muted",
                        )}
                        strokeWidth={1.8}
                      />
                      <span className="relative z-10 flex-1 truncate">
                        {item.label}
                      </span>
                      {item.badge && (
                        <span
                          className={cn(
                            "relative z-10 rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide",
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

      {/* Estado do agente */}
      <div className="px-3 pb-3">
        <AgentPulse />
      </div>

      {/* Usuário */}
      <div className="border-t border-hairline p-3">
        <button className="group flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-white/[0.04]">
          <div className="relative">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-[12px] font-bold text-white">
              MZ
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-ink bg-positive" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-fg">
              Mateus Zumach
            </p>
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

/** Navegação compacta para telas menores. */
export function MobileNav() {
  const pathname = usePathname();
  const items = navGroups.flatMap((g) => g.items).slice(0, 5);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-ink/85 backdrop-blur-2xl lg:hidden">
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

export function Breadcrumb({ parent, title }: { parent: string; title: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[13px]">
      <span className="text-fg-faint">{parent}</span>
      <ChevronRight className="h-3.5 w-3.5 text-fg-ghost" strokeWidth={2} />
      <span className="font-semibold text-fg">{title}</span>
    </div>
  );
}
