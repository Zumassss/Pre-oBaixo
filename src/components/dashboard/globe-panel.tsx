"use client";

import { GlobeMount } from "@/components/globe/globe-mount";
import { useAgentStream } from "@/hooks/use-agent-stream";
import { useAppState } from "@/components/providers/app-state";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/utils";

function StatusDot({ status }: { status: "online" | "atencao" | "offline" }) {
  return (
    <span
      className={cn(
        "h-1.5 w-1.5 shrink-0 rounded-full",
        status === "online" && "bg-positive shadow-[0_0_6px_1px_rgba(24,209,127,0.7)]",
        status === "atencao" && "bg-caution shadow-[0_0_6px_1px_rgba(255,176,32,0.6)]",
        status === "offline" && "bg-fg-ghost",
      )}
    />
  );
}

/** O painel central: a esfera com a operação acontecendo em cima. */
export function GlobePanel({ className }: { className?: string }) {
  const { latest, mounted } = useAgentStream(4);
  const { unidadesFiltradas, unidadeAtual, escala } = useAppState();

  const online = unidadesFiltradas.filter((s) => s.status === "online").length;
  const conversasHoje = unidadesFiltradas.reduce((s, u) => s + u.conversas, 0);

  return (
    <div className={cn("panel relative overflow-hidden", className)}>
      <div className="absolute inset-0">
        <GlobeMount />
      </div>

      {/* Cabeçalho */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-4 p-5">
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-brand-500" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-500" />
            </span>
            <p className="eyebrow !text-brand-400">Ao vivo</p>
          </div>
          <h2 className="text-[22px] font-semibold tracking-[-0.025em] text-fg">
            {unidadeAtual ? unidadeAtual.name : "Operação da rede"}
          </h2>
          <p className="mt-1 text-[12.5px] text-fg-muted">
            {online} de {unidadesFiltradas.length} unidades conectadas
          </p>
        </div>

        <div className="hidden shrink-0 gap-2 sm:flex">
          <div className="glass rounded-xl px-3 py-2 text-right">
            <p className="tnum font-mono text-[19px] font-semibold leading-none text-fg">
              {formatNumber(escala(conversasHoje))}
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-fg-ghost">
              conversas
            </p>
          </div>
          <div className="glass rounded-xl px-3 py-2 text-right">
            <p className="tnum font-mono text-[19px] font-semibold leading-none text-brand-400">
              {Math.max(1, Math.round(online * 4.6))}
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-fg-ghost">
              agora
            </p>
          </div>
        </div>
      </div>

      {/* Unidades */}
      <div className="pointer-events-none absolute bottom-5 left-5 hidden lg:block">
        <p className="eyebrow mb-2">Unidades</p>
        <ul className="space-y-1">
          {unidadesFiltradas.slice(0, 6).map((store) => (
            <li key={store.id} className="flex items-center gap-2">
              <StatusDot status={store.status} />
              <span className="text-[11.5px] text-fg-faint">{store.name}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Ação corrente do agente */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-end p-5">
        <div className="glass flex max-w-[74%] items-center gap-2.5 rounded-full px-3.5 py-2">
          <span className="h-1.5 w-1.5 shrink-0 animate-blink rounded-full bg-brand-500" />
          <p className="truncate text-[12px] text-fg-muted">
            {mounted && latest ? latest.detail : "Conectando ao fluxo do agente"}
          </p>
        </div>
      </div>
    </div>
  );
}
