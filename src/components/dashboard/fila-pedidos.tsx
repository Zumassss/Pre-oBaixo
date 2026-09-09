"use client";

import Link from "next/link";
import { ArrowUpRight, ClipboardList, MessageCircle, Store } from "lucide-react";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/empty-state";
import { Reveal } from "@/components/ui/reveal";
import { ChipStatus, IconeStatus } from "@/components/pedidos/status";
import { pedidoEmAberto, type BancoLocal } from "@/lib/db/types";
import { cn, formatBRLCents } from "@/lib/utils";

/**
 * Fila de pedidos no painel.
 *
 * É a lista que a pessoa do balcão olha durante o expediente: quem pediu, o
 * que falta fazer e quanto ainda não entrou. O detalhe e as ações ficam na
 * tela de Pedidos; aqui é só o retrato de agora.
 */
export function FilaPedidos({ banco }: { banco: BancoLocal }) {
  const abertos = banco.pedidos.filter(pedidoEmAberto);
  const aReceber = abertos
    .filter((p) => !p.pago)
    .reduce((soma, p) => soma + p.total, 0);
  const naReceita = abertos.filter(
    (p) => p.status === "aguardando_receita",
  ).length;

  return (
    <Panel>
      <PanelHeader
        eyebrow="Operação"
        title="Pedidos em andamento"
        live={abertos.length > 0}
        action={
          <Link
            href="/pedidos"
            className="group flex shrink-0 items-center gap-1 text-[12px] font-medium text-fg-faint transition-colors hover:text-brand-400"
          >
            Ver todos
            <ArrowUpRight
              className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              strokeWidth={2}
            />
          </Link>
        }
      />

      {abertos.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nenhum pedido na fila"
          description="Pedido feito pelo WhatsApp aparece aqui para a equipe separar."
          action={
            <Link href="/pedidos" className="btn-ghost">
              Abrir pedidos
            </Link>
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap gap-2 px-5 pb-3">
            <span className="chip">{abertos.length} em aberto</span>
            {naReceita > 0 && (
              <span className="chip chip-warn">
                {naReceita} aguardando receita
              </span>
            )}
            {aReceber > 0 && (
              <span className="chip">{formatBRLCents(aReceber)} a receber</span>
            )}
          </div>

          <ul
            data-lenis-prevent
            className="max-h-[300px] space-y-1 overflow-y-auto px-2 pb-3"
          >
            {abertos.map((pedido) => (
              <Reveal
                as="li"
                key={pedido.id}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5"
              >
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-hairline",
                    pedido.status === "aguardando_receita"
                      ? "bg-caution/[0.12]"
                      : "bg-white/[0.04]",
                  )}
                >
                  <IconeStatus
                    status={pedido.status}
                    className={cn(
                      "h-3.5 w-3.5",
                      pedido.status === "aguardando_receita"
                        ? "text-caution"
                        : "text-fg-muted",
                    )}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="tnum font-mono text-[11px] text-fg-ghost">
                      #{pedido.numero}
                    </span>
                    <p className="truncate text-[12.5px] font-medium text-fg">
                      {pedido.cliente}
                    </p>
                    {pedido.origem === "whatsapp" ? (
                      <MessageCircle
                        className="h-3 w-3 shrink-0 text-fg-ghost"
                        strokeWidth={2}
                      />
                    ) : (
                      <Store
                        className="h-3 w-3 shrink-0 text-fg-ghost"
                        strokeWidth={2}
                      />
                    )}
                  </div>
                  <p className="truncate text-[11px] text-fg-ghost">
                    {pedido.itens.reduce((n, i) => n + i.quantidade, 0)} itens ·{" "}
                    {pedido.itens[0]?.nome ?? "sem item"}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="tnum font-mono text-[12.5px] font-medium text-fg">
                    {formatBRLCents(pedido.total)}
                  </span>
                  <ChipStatus
                    status={pedido.status}
                    className="!px-2 !py-[2px] !text-[9.5px]"
                  />
                </div>
              </Reveal>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}
