"use client";

import { Mic, SendHorizonal, Sparkles } from "lucide-react";
import { GlobeMount } from "@/components/globe/globe-mount";
import { useAgentStream } from "@/hooks/use-agent-stream";
import { storeSummary, stores } from "@/lib/mock/stores";
import { cn } from "@/lib/utils";

function StatusDot({ status }: { status: (typeof stores)[number]["status"] }) {
  return (
    <span
      className={cn(
        "h-1.5 w-1.5 rounded-full",
        status === "online" && "bg-positive shadow-[0_0_6px_1px_rgba(24,209,127,0.7)]",
        status === "atencao" && "bg-caution shadow-[0_0_6px_1px_rgba(255,176,32,0.6)]",
        status === "offline" && "bg-fg-ghost",
      )}
    />
  );
}

/**
 * O painel central: a esfera de partículas com a operação acontecendo em cima.
 * O texto da ação corrente vem do mesmo fluxo que alimenta o restante da tela.
 */
export function GlobePanel() {
  const { latest, mounted } = useAgentStream(4);

  return (
    <div className="panel panel-hot relative h-[560px] overflow-hidden">
      {/* Camada 3D */}
      <div className="absolute inset-0">
        <GlobeMount />
      </div>

      {/* Cabeçalho sobreposto */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-4 p-5">
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-brand-500" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-500" />
            </span>
            <p className="eyebrow !text-brand-400">Monitoramento em tempo real</p>
          </div>
          <h2 className="text-[21px] font-semibold tracking-[-0.025em] text-fg">
            Operação ao vivo
          </h2>
          <p className="mt-1 text-[12.5px] text-fg-muted">
            {storeSummary.online} de {storeSummary.total} unidades conectadas ao
            agente
          </p>
        </div>

        <div className="hidden shrink-0 gap-2 sm:flex">
          <div className="tile px-3 py-2 text-right backdrop-blur-xl">
            <p className="tnum font-mono text-[19px] font-semibold leading-none text-fg">
              1.284
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-fg-ghost">
              hoje
            </p>
          </div>
          <div className="tile px-3 py-2 text-right backdrop-blur-xl">
            <p className="tnum font-mono text-[19px] font-semibold leading-none text-brand-400">
              37
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-fg-ghost">
              agora
            </p>
          </div>
        </div>
      </div>

      {/* Ação corrente do agente */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[86px] flex justify-center px-5">
        <div className="tile flex max-w-[92%] items-center gap-2.5 px-3.5 py-2 backdrop-blur-xl">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-brand-400" strokeWidth={2} />
          <p className="truncate text-[12px] text-fg-muted">
            {mounted && latest ? latest.detail : "Conectando ao fluxo do agente…"}
          </p>
        </div>
      </div>

      {/* Entrada de comando */}
      <div className="absolute inset-x-0 bottom-0 p-4">
        <div className="flex items-center gap-2 rounded-full border border-hairline bg-ink/80 px-2 py-1.5 backdrop-blur-2xl">
          <input
            className="min-w-0 flex-1 bg-transparent px-3 py-1.5 text-[13px] text-fg outline-none placeholder:text-fg-ghost"
            placeholder="Pergunte ao agente sobre a operação…"
          />
          <button className="flex h-8 w-8 items-center justify-center rounded-full text-fg-faint transition-colors hover:bg-white/[0.07] hover:text-fg">
            <Mic className="h-4 w-4" strokeWidth={1.9} />
          </button>
          <button className="btn-primary !h-8 !w-8 !p-0">
            <SendHorizonal className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Unidades, coluna flutuante à esquerda */}
      <div className="pointer-events-none absolute bottom-[86px] left-5 hidden lg:block">
        <p className="eyebrow mb-2">Unidades</p>
        <ul className="space-y-1">
          {stores.slice(0, 5).map((store) => (
            <li key={store.id} className="flex items-center gap-2">
              <StatusDot status={store.status} />
              <span className="text-[11.5px] text-fg-faint">{store.name}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
