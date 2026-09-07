"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import { Sparkline } from "@/components/charts";
import type { Kpi } from "@/lib/mock/metrics";
import { cn } from "@/lib/utils";

/**
 * Um indicador do topo do painel.
 * `invertDelta` serve para métricas onde cair é bom (tempo de resposta).
 */
export function KpiCard({
  kpi,
  invertDelta = false,
  index = 0,
}: {
  kpi: Kpi;
  invertDelta?: boolean;
  index?: number;
}) {
  const isGood = invertDelta ? kpi.delta < 0 : kpi.delta > 0;
  const Icon = kpi.delta > 0 ? TrendingUp : TrendingDown;

  return (
    <div
      className="tile tile-interactive group relative overflow-hidden p-4"
      style={{ animation: `rise 0.6s cubic-bezier(0.16,1,0.3,1) ${index * 70}ms both` }}
    >
      <div className="pointer-events-none absolute -right-10 -top-12 h-28 w-28 aura-brand opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-60" />

      <div className="relative flex items-start justify-between gap-3">
        <p className="text-[12px] font-medium text-fg-muted">{kpi.label}</p>
        <span
          className={cn(
            "flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-bold",
            isGood
              ? "bg-positive/12 text-positive"
              : "bg-negative/12 text-negative",
          )}
        >
          <Icon className="h-3 w-3" strokeWidth={2.5} />
          {kpi.delta > 0 ? "+" : ""}
          {kpi.delta.toFixed(1).replace(".", ",")}%
        </span>
      </div>

      <p className="tnum relative mt-2 text-[27px] font-semibold leading-none tracking-[-0.03em] text-fg">
        {kpi.value}
      </p>
      <p className="relative mt-1 text-[11px] text-fg-ghost">{kpi.hint}</p>

      <div className="relative mt-3 -mb-1">
        <Sparkline values={kpi.spark} tone={isGood ? "brand" : "negative"} />
      </div>
    </div>
  );
}
