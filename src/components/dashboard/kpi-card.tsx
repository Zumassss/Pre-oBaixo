"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import { Sparkline } from "@/components/charts";
import { Reveal } from "@/components/ui/reveal";
import { cn } from "@/lib/utils";

export type KpiView = {
  id: string;
  label: string;
  value: string;
  delta: number;
  hint: string;
  spark: number[];
  /** Métricas onde cair é bom, como tempo de resposta. */
  invertido?: boolean;
};

/** Indicador compacto do topo. */
export function KpiCard({ kpi, index = 0 }: { kpi: KpiView; index?: number }) {
  const bom = kpi.invertido ? kpi.delta < 0 : kpi.delta > 0;
  const Icon = kpi.delta > 0 ? TrendingUp : TrendingDown;

  return (
    <Reveal
      className="tile p-3.5"
      style={{ animation: `rise 0.5s cubic-bezier(0.16,1,0.3,1) ${index * 60}ms both` }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11.5px] font-medium text-fg-muted">{kpi.label}</p>
        <span
          className={cn(
            "flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold",
            bom ? "bg-positive/12 text-positive" : "bg-negative/12 text-negative",
          )}
        >
          <Icon className="h-2.5 w-2.5" strokeWidth={2.5} />
          {kpi.delta > 0 ? "+" : ""}
          {kpi.delta.toFixed(1).replace(".", ",")}%
        </span>
      </div>

      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="tnum text-[23px] font-semibold leading-none tracking-[-0.03em] text-fg">
            {kpi.value}
          </p>
          <p className="mt-1 truncate text-[10.5px] text-fg-ghost">{kpi.hint}</p>
        </div>
        <div className="w-[92px] shrink-0">
          <Sparkline values={kpi.spark} tone={bom ? "brand" : "negative"} />
        </div>
      </div>
    </Reveal>
  );
}
