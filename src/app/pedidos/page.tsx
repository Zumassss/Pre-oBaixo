"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  ClipboardList,
  MessageCircle,
  Plus,
  QrCode,
  Stethoscope,
  Store,
  Trash2,
  X,
} from "lucide-react";
import { PageHeader, Panel, PanelHeader } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/empty-state";
import { Reveal } from "@/components/ui/reveal";
import { ChipStatus, IconeStatus } from "@/components/pedidos/status";
import { NovoPedido } from "@/components/pedidos/novo-pedido";
import { CobrancaPix } from "@/components/pedidos/cobranca-pix";
import { useAppState } from "@/components/providers/app-state";
import {
  aprovarReceita,
  avancarPedido,
  cancelarPedido,
  proximaEtapa,
  removerPedido,
  useBanco,
} from "@/lib/db/use-db";
import {
  FILA_PEDIDOS,
  STATUS_PEDIDO_LABEL,
  pedidoEmAberto,
  pedidoExigeReceita,
  type Pedido,
  type StatusPedido,
} from "@/lib/db/types";
import { cn, formatBRLCents } from "@/lib/utils";

type Filtro = StatusPedido | "todos" | "finalizados";

/** O que o botão principal faz em cada etapa. */
function rotuloDoAvanco(pedido: Pedido) {
  switch (proximaEtapa(pedido)) {
    case "aguardando_pagamento":
      return "Cobrar";
    case "em_preparo":
      return "Separar";
    case "pronto":
      return "Marcar pronto";
    case "entregue":
      return "Entregar";
    default:
      return "";
  }
}

export default function PedidosPage() {
  const { banco, carregado } = useBanco();
  const { busca } = useAppState();
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [novo, setNovo] = useState(false);
  const [cobrando, setCobrando] = useState<Pedido | null>(null);

  const termo = busca.toLowerCase().trim();

  const emAberto = useMemo(
    () => banco.pedidos.filter(pedidoEmAberto),
    [banco.pedidos],
  );

  const visiveis = useMemo(() => {
    const base =
      filtro === "todos"
        ? emAberto
        : filtro === "finalizados"
          ? banco.pedidos.filter((p) => !pedidoEmAberto(p))
          : banco.pedidos.filter((p) => p.status === filtro);

    return base.filter(
      (p) =>
        !termo ||
        p.cliente.toLowerCase().includes(termo) ||
        p.telefone.includes(termo) ||
        String(p.numero) === termo,
    );
  }, [banco.pedidos, emAberto, filtro, termo]);

  const contarPor = (status: StatusPedido) =>
    banco.pedidos.filter((p) => p.status === status).length;

  const aReceber = emAberto
    .filter((p) => !p.pago)
    .reduce((s, p) => s + p.total, 0);

  const filtros: { valor: Filtro; rotulo: string; total: number }[] = [
    { valor: "todos", rotulo: "Em aberto", total: emAberto.length },
    ...FILA_PEDIDOS.map((s) => ({
      valor: s as Filtro,
      rotulo: STATUS_PEDIDO_LABEL[s],
      total: contarPor(s),
    })),
    {
      valor: "finalizados",
      rotulo: "Finalizados",
      total: banco.pedidos.length - emAberto.length,
    },
  ];

  return (
    <div className="mx-auto max-w-[1560px]">
      <PageHeader
        title="Pedidos"
        description="O que os clientes pediram e em que pé está cada um."
        action={
          <button onClick={() => setNovo(true)} className="btn-primary">
            <Plus className="h-4 w-4" strokeWidth={2.4} />
            Novo pedido
          </button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Pedidos em aberto", valor: String(emAberto.length) },
          {
            label: "Aguardando receita",
            valor: String(contarPor("aguardando_receita")),
          },
          { label: "Prontos para retirada", valor: String(contarPor("pronto")) },
          { label: "A receber", valor: formatBRLCents(aReceber) },
        ].map((stat, i) => (
          <Reveal
            key={stat.label}
            className="tile p-4"
            style={{
              animation: `rise 0.5s cubic-bezier(0.16,1,0.3,1) ${i * 60}ms both`,
            }}
          >
            <p className="text-[12px] text-fg-muted">{stat.label}</p>
            <p className="tnum mt-2 font-mono text-[21px] font-semibold leading-none tracking-[-0.03em] text-fg">
              {carregado ? stat.valor : "0"}
            </p>
          </Reveal>
        ))}
      </div>

      <Panel>
        <PanelHeader
          eyebrow="Fila"
          title="Pedidos da loja"
          action={
            banco.pedidos.length > 0 ? (
              <span className="chip">{visiveis.length} na lista</span>
            ) : undefined
          }
        />

        {banco.pedidos.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-5 pb-3">
            {filtros.map((f) => (
              <button
                key={f.valor}
                onClick={() => setFiltro(f.valor)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[11.5px] font-medium transition-colors",
                  filtro === f.valor
                    ? "border-brand-500/50 bg-brand-500/[0.14] text-fg"
                    : "border-hairline bg-white/[0.03] text-fg-muted hover:bg-white/[0.06]",
                )}
              >
                {f.rotulo}
                <span className="tnum ml-1.5 font-mono text-fg-ghost">
                  {f.total}
                </span>
              </button>
            ))}
          </div>
        )}

        {banco.pedidos.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Nenhum pedido ainda"
            description="Quando o WhatsApp estiver ligado, o que o cliente pedir na conversa cai aqui. Enquanto isso, dá para registrar o pedido na mão."
            action={
              <button onClick={() => setNovo(true)} className="btn-primary">
                <Plus className="h-4 w-4" strokeWidth={2.4} />
                Registrar um pedido
              </button>
            }
          />
        ) : visiveis.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Nada nesta faixa"
            description={
              termo
                ? `Nenhum pedido corresponde a "${termo}".`
                : "Nenhum pedido nesta etapa agora."
            }
          />
        ) : (
          <ul className="space-y-2 px-3 pb-4">
            {visiveis.map((pedido) => (
              <CartaoPedido
                key={pedido.id}
                pedido={pedido}
                farmaceutico={banco.loja.farmaceutico}
                onCobrar={() => setCobrando(pedido)}
              />
            ))}
          </ul>
        )}
      </Panel>

      <NovoPedido
        banco={banco}
        aberto={novo}
        onFechar={(criado) => {
          setNovo(false);
          // Pedido por Pix já abre a cobrança: é o passo seguinte natural.
          if (criado && criado.formaPagamento === "pix") setCobrando(criado);
        }}
      />

      <CobrancaPix
        pedido={cobrando}
        pagamentos={banco.pagamentos}
        aberto={Boolean(cobrando)}
        onFechar={() => setCobrando(null)}
      />
    </div>
  );
}

function CartaoPedido({
  pedido,
  farmaceutico,
  onCobrar,
}: {
  pedido: Pedido;
  farmaceutico: string;
  onCobrar: () => void;
}) {
  const exigeReceita = pedidoExigeReceita(pedido);
  const travadoNaReceita = pedido.status === "aguardando_receita";
  const avanco = rotuloDoAvanco(pedido);

  return (
    <Reveal as="li" className="rounded-xl border border-hairline bg-white/[0.022] p-3.5">
      <div className="flex flex-wrap items-start gap-3">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-hairline",
            travadoNaReceita ? "bg-caution/[0.12]" : "bg-white/[0.04]",
          )}
        >
          <IconeStatus
            status={pedido.status}
            className={cn(
              "h-4 w-4",
              travadoNaReceita ? "text-caution" : "text-fg-muted",
            )}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="tnum font-mono text-[12px] text-fg-ghost">
              #{pedido.numero}
            </span>
            <p className="truncate text-[13.5px] font-semibold text-fg">
              {pedido.cliente}
            </p>
            {pedido.origem === "whatsapp" ? (
              <span className="flex items-center gap-1 text-[11px] text-fg-ghost">
                <MessageCircle className="h-3 w-3" strokeWidth={2} />
                WhatsApp
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] text-fg-ghost">
                <Store className="h-3 w-3" strokeWidth={2} />
                Balcão
              </span>
            )}
          </div>

          <p className="mt-1 text-[12px] leading-relaxed text-fg-faint">
            {pedido.itens
              .map((i) => `${i.quantidade}x ${i.nome}`)
              .join(" · ")}
          </p>

          {pedido.observacao && (
            <p className="mt-1 text-[11.5px] italic text-fg-ghost">
              {pedido.observacao}
            </p>
          )}

          {pedido.receitaConferidaPor && (
            <p className="mt-1 flex items-center gap-1 text-[11px] text-positive">
              <Stethoscope className="h-3 w-3" strokeWidth={2} />
              Receita conferida por {pedido.receitaConferidaPor}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="tnum font-mono text-[15px] font-semibold text-fg">
            {formatBRLCents(pedido.total)}
          </span>
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "chip !px-2 !py-[2px] !text-[9.5px]",
                pedido.pago ? "chip-good" : "",
              )}
            >
              {pedido.pago
                ? "pago"
                : pedido.formaPagamento === "pix"
                  ? "pix pendente"
                  : "paga na retirada"}
            </span>
            <ChipStatus status={pedido.status} className="!px-2 !py-[2px] !text-[9.5px]" />
          </div>
        </div>
      </div>

      {pedidoEmAberto(pedido) && (
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-hairline pt-3">
          {travadoNaReceita && (
            <button
              onClick={() =>
                aprovarReceita(pedido.id, farmaceutico || "farmacêutico da loja")
              }
              className="btn-ghost !text-[12px] !text-caution"
            >
              <Stethoscope className="h-3.5 w-3.5" strokeWidth={2} />
              Conferi a receita
            </button>
          )}

          {pedido.formaPagamento === "pix" && !pedido.pago && (
            <button onClick={onCobrar} className="btn-ghost !text-[12px]">
              <QrCode className="h-3.5 w-3.5" strokeWidth={2} />
              Cobrança Pix
            </button>
          )}

          <button
            onClick={() => cancelarPedido(pedido.id)}
            className="btn-ghost !text-[12px] hover:!text-negative"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} />
            Cancelar
          </button>

          {avanco && !travadoNaReceita && (
            <button
              onClick={() =>
                proximaEtapa(pedido) === "aguardando_pagamento"
                  ? onCobrar()
                  : avancarPedido(pedido.id)
              }
              className="btn-primary !py-2 !text-[12px]"
            >
              {avanco}
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.2} />
            </button>
          )}

          {travadoNaReceita && exigeReceita && (
            <span className="text-[11px] text-fg-ghost">
              Pedido parado até a conferência
            </span>
          )}
        </div>
      )}

      {!pedidoEmAberto(pedido) && (
        <div className="mt-3 flex items-center justify-end border-t border-hairline pt-3">
          <button
            onClick={() => removerPedido(pedido.id)}
            aria-label={`Remover pedido ${pedido.numero}`}
            className="rounded-lg p-1.5 text-fg-ghost transition-colors hover:bg-white/[0.06] hover:text-negative"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
      )}
    </Reveal>
  );
}
