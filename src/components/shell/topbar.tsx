"use client";

import { usePathname } from "next/navigation";
import { ChevronRight, Search, X } from "lucide-react";
import { pageMeta } from "@/config/nav";
import { useClock } from "@/hooks/use-clock";
import { formatClock } from "@/lib/utils";
import { BrandCompact } from "@/components/shell/sidebar";
import { NotificationBell } from "@/components/shell/notifications";
import { Dropdown } from "@/components/ui/dropdown";
import {
  useAppState,
  periodoLabel,
  type Periodo,
} from "@/components/providers/app-state";

function Breadcrumb({ parent, title }: { parent: string; title: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[13px]">
      <span className="text-fg-faint">{parent}</span>
      <ChevronRight className="h-3.5 w-3.5 text-fg-ghost" strokeWidth={2} />
      <span className="font-semibold text-fg">{title}</span>
    </div>
  );
}

export function Topbar() {
  const pathname = usePathname();
  const meta = pageMeta[pathname] ?? { title: "Painel", parent: "Operação" };
  const now = useClock();
  const { periodo, setPeriodo, busca, setBusca } = useAppState();

  const periodos = (Object.keys(periodoLabel) as Periodo[]).map((p) => ({
    value: p,
    label: periodoLabel[p],
  }));

  return (
    <header className="glass sticky top-0 z-30 border-x-0 border-t-0">
      <div className="flex h-[60px] items-center gap-3 px-4 sm:px-6">
        <BrandCompact />

        <div className="hidden lg:block">
          <Breadcrumb parent={meta.parent} title={meta.title} />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="relative hidden md:block">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-fg-ghost"
              strokeWidth={2}
            />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="field w-[200px] !py-2 !pl-9.5 !pr-8 !text-[12.5px] lg:w-[230px]"
              placeholder="Buscar cliente ou produto"
            />
            {busca && (
              <button
                onClick={() => setBusca("")}
                aria-label="Limpar busca"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-fg-ghost transition-colors hover:text-fg"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.2} />
              </button>
            )}
          </div>

          <div className="hidden lg:block">
            <Dropdown
              label="Período"
              value={periodo}
              options={periodos}
              onChange={(v) => setPeriodo(v as Periodo)}
              align="right"
            />
          </div>

          <NotificationBell />

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
