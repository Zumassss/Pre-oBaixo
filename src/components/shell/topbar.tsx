"use client";

import { usePathname } from "next/navigation";
import { Bell, ChevronRight, Search, X } from "lucide-react";
import { pageMeta } from "@/config/nav";
import { useClock } from "@/hooks/use-agent-stream";
import { formatClock } from "@/lib/utils";
import { BrandCompact } from "@/components/shell/sidebar";
import { Dropdown } from "@/components/ui/dropdown";
import { useAppState, periodoLabel, type Periodo } from "@/components/providers/app-state";
import { stores } from "@/lib/mock/stores";

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
  const { unidade, setUnidade, periodo, setPeriodo, busca, setBusca } = useAppState();

  const unidades = [
    { value: "todas", label: "Todas as unidades" },
    ...stores.map((s) => ({
      value: s.id,
      label: s.name,
      hint: s.status === "offline" ? "offline" : String(s.conversas),
    })),
  ];

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
              className="field w-[200px] !py-2 !pl-9.5 !pr-8 !text-[12.5px] lg:w-[240px]"
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

          <div className="hidden xl:flex xl:items-center xl:gap-2">
            <Dropdown
              label="Unidade"
              value={unidade}
              options={unidades}
              onChange={setUnidade}
              align="right"
            />
            <Dropdown
              label="Período"
              value={periodo}
              options={periodos}
              onChange={(v) => setPeriodo(v as Periodo)}
              align="right"
            />
          </div>

          <button
            aria-label="Notificações"
            className="relative flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-white/[0.035] text-fg-muted transition-colors hover:bg-white/[0.08] hover:text-fg"
          >
            <Bell className="h-4 w-4" strokeWidth={1.9} />
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
