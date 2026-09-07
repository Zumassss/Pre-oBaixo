"use client";

import { usePathname } from "next/navigation";
import { Bell, ChevronDown, Search } from "lucide-react";
import { Breadcrumb } from "@/components/shell/sidebar";
import { pageMeta } from "@/config/nav";
import { useClock } from "@/hooks/use-agent-stream";
import { formatClock } from "@/lib/utils";
import { LogoFull } from "@/components/brand/logo";

function FilterPill({ label, value }: { label: string; value: string }) {
  return (
    <button className="btn-ghost !px-3.5 !py-2 !text-[12.5px]">
      <span className="text-fg-ghost">{label}:</span>
      <span className="font-semibold text-fg-muted">{value}</span>
      <ChevronDown className="h-3.5 w-3.5 text-fg-ghost" strokeWidth={2} />
    </button>
  );
}

export function Topbar() {
  const pathname = usePathname();
  const meta = pageMeta[pathname] ?? { title: "Painel", parent: "Operação" };
  const now = useClock();

  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-void/70 backdrop-blur-2xl">
      <div className="flex h-[62px] items-center gap-4 px-4 sm:px-6">
        {/* Marca compacta em telas sem barra lateral */}
        <div className="lg:hidden">
          <LogoFull />
        </div>

        <div className="hidden lg:block">
          <Breadcrumb parent={meta.parent} title={meta.title} />
        </div>

        <div className="ml-auto flex items-center gap-2.5">
          <div className="relative hidden md:block">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-fg-ghost"
              strokeWidth={2}
            />
            <input
              className="field w-[210px] !py-2 !pl-9.5 !text-[12.5px] lg:w-[260px]"
              placeholder="Buscar cliente, pedido, produto…"
            />
          </div>

          <div className="hidden xl:flex xl:items-center xl:gap-2">
            <FilterPill label="Unidade" value="Todas" />
            <FilterPill label="Período" value="Hoje" />
          </div>

          <button className="relative flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-white/[0.035] text-fg-muted transition-colors hover:bg-white/[0.07] hover:text-fg">
            <Bell className="h-[16px] w-[16px]" strokeWidth={1.9} />
            <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-brand-500 shadow-[0_0_8px_2px_rgba(255,23,65,0.7)]" />
          </button>

          <div className="hidden items-center gap-2 rounded-full border border-hairline bg-white/[0.035] px-3 py-2 sm:flex">
            <span className="h-1.5 w-1.5 animate-blink rounded-full bg-positive" />
            <span className="tnum font-mono text-[12px] text-fg-muted">
              {now ? formatClock(now) : "--:--:--"}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
