"use client";

import { useMemo } from "react";
import Link from "next/link";
import { PlugZap } from "lucide-react";
import { GlobeMount } from "@/components/globe/globe-mount";
import type { PontoOperacao } from "@/components/globe/operations-globe";
import { useBanco } from "@/lib/db/use-db";
import { cn, formatNumber } from "@/lib/utils";

/**
 * A operação da loja em tempo real.
 *
 * Cada ponto aceso na esfera é uma conversa aberta de verdade. Sem conversa,
 * a esfera gira parada e o painel diz o que falta para começar a receber.
 */
export function GlobePanel({ className }: { className?: string }) {
  const { banco } = useBanco();

  const abertas = banco.conversas.filter((c) => c.status !== "resolvida");

  const pontos = useMemo<PontoOperacao[]>(
    () =>
      abertas.map((c) => ({
        id: c.id,
        urgente: c.status === "aberta",
      })),
    [abertas],
  );

  const conectado = banco.whatsappConectado;

  return (
    <div className={cn("panel relative overflow-hidden", className)}>
      <div className="absolute inset-0">
        <GlobeMount pontos={pontos} />
      </div>

      {/* Cabeçalho */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-4 p-5">
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="relative flex h-1.5 w-1.5">
              {conectado && (
                <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-brand-500" />
              )}
              <span
                className={cn(
                  "relative inline-flex h-1.5 w-1.5 rounded-full",
                  conectado ? "bg-brand-500" : "bg-fg-ghost",
                )}
              />
            </span>
            <p
              className={cn("eyebrow", conectado ? "!text-brand-400" : "!text-fg-ghost")}
            >
              {conectado ? "Ao vivo" : "Fora do ar"}
            </p>
          </div>
          <h2 className="text-[21px] font-semibold tracking-[-0.025em] text-fg">
            Operação da loja
          </h2>
          <p className="mt-1 text-[12.5px] text-fg-muted">
            {conectado
              ? `${abertas.length} ${abertas.length === 1 ? "conversa em andamento" : "conversas em andamento"}`
              : "WhatsApp ainda não conectado"}
          </p>
        </div>

        <div className="hidden shrink-0 gap-2 sm:flex">
          <div className="glass rounded-xl px-3 py-2 text-right">
            <p className="tnum font-mono text-[19px] font-semibold leading-none text-fg">
              {formatNumber(banco.conversas.length)}
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-fg-ghost">
              conversas
            </p>
          </div>
          <div className="glass rounded-xl px-3 py-2 text-right">
            <p className="tnum font-mono text-[19px] font-semibold leading-none text-brand-400">
              {formatNumber(abertas.length)}
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-fg-ghost">
              agora
            </p>
          </div>
        </div>
      </div>

      {/* Chamada quando ainda não há canal ligado */}
      {!conectado && (
        <div className="absolute inset-x-0 bottom-0 flex justify-center p-5">
          <Link
            href="/configuracoes"
            className="glass flex items-center gap-2.5 rounded-full px-4 py-2.5 transition-colors hover:border-brand-500/40"
          >
            <PlugZap className="h-4 w-4 shrink-0 text-brand-400" strokeWidth={2} />
            <span className="text-[12.5px] text-fg-muted">
              Conectar o WhatsApp para receber conversas
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}
