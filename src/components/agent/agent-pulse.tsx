"use client";

import { useAgentStream } from "@/hooks/use-agent-stream";

/** Barras de atividade, o batimento do agente. */
function Equalizer() {
  return (
    <div className="flex h-4 items-end gap-[3px]">
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="w-[3px] origin-bottom rounded-full bg-brand-500"
          style={{
            height: "100%",
            animation: `bar ${1 + i * 0.16}s ease-in-out ${i * 0.11}s infinite`,
            boxShadow: "0 0 8px rgba(255,23,65,0.7)",
          }}
        />
      ))}
    </div>
  );
}

/** Estado do agente na barra lateral, com a ação mais recente. */
export function AgentPulse() {
  const { latest, mounted } = useAgentStream(6);

  return (
    <div className="tile relative overflow-hidden p-3">
      <div className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 aura-brand opacity-50" />

      <div className="relative flex items-center gap-2.5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-brand-500" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
        </span>
        <p className="flex-1 text-[12px] font-semibold text-fg">Agente ativo</p>
        <Equalizer />
      </div>

      <p className="relative mt-2 line-clamp-2 min-h-[30px] text-[11px] leading-[1.35] text-fg-faint">
        {mounted && latest ? latest.detail : "Sincronizando com a operação"}
      </p>
    </div>
  );
}
