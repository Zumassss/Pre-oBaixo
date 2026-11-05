"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bike,
  ClipboardList,
  History,
  MapPin,
  MessageCircle,
  Plus,
  QrCode,
  Stethoscope,
  Store,
  Trash2,
} from "lucide-react";
import { PageHeader, Panel } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/empty-state";
import { ChipStatus } from "@/components/pedidos/status";
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
    case "saiu_entrega":
      return "Despachar com motoboy";
    case "entregue":
      return pedido.formaEntrega === "entrega" ? "Confirmar entrega" : "Entregar";
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
          <div className="flex items-center gap-2">
            <Link href="/pedidos/historico" className="btn-ghost">
              <History className="h-4 w-4" />
              Histórico
            </Link>
            <button onClick={() => setNovo(true)} className="btn-primary">
              <Plus className="h-4 w-4" strokeWidth={2.4} />
              Novo pedido
            </button>
          </div>
        }
      />

      <Panel className="overflow-hidden">
        {banco.pedidos.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 border-b border-hairline px-4 py-3">
            {filtros.map((f) =>
              f.total === 0 && f.valor !== "todos" && f.valor !== filtro ? null : (
                <button
                  key={f.valor}
                  onClick={() => setFiltro(f.valor)}
                  aria-pressed={filtro === f.valor}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12.5px] font-medium transition-colors",
                    filtro === f.valor ? "bg-nivel-4 text-fg" : "text-fg-muted hover:bg-nivel-2 hover:text-fg",
                  )}
                >
                  {f.rotulo}
                  <span className="tnum text-[11px] opacity-60">{f.total}</span>
                </button>
              ),
            )}
            <span className="ml-auto text-[12px] text-fg-faint">
              {carregado && aReceber > 0 ? `${formatBRLCents(aReceber)} a receber nos pedidos em aberto` : ""}
            </span>
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
          <ul className="divide-y divide-hairline">
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

/** Como e quando o cliente paga, em palavras. */
function pagamento(pedido: Pedido) {
  if (pedido.pago) return "Pago";
  if (pedido.formaPagamento === "pix") return "Pix pendente";
  return pedido.formaEntrega === "entrega" ? "Paga na entrega" : "Paga na retirada";
}

/**
 * Um pedido da fila.
 *
 * Linha, não cartão: a fila é lida de cima a baixo, e cada pedido com caixa,
 * borda e meia dúzia de etiquetas coloridas fazia a tela inteira competir
 * por atenção. Agora a cor fica no ponto da etapa e o resto é texto.
 */
function CartaoPedido({
  pedido,
  farmaceutico,
  onCobrar,
}: {
  pedido: Pedido;
  farmaceutico: string;
  onCobrar: () => void;
}) {
  const [confirmar, setConfirmar] = useState<"cancelar" | "remover" | null>(null);
  const exigeReceita = pedidoExigeReceita(pedido);
  const travadoNaReceita = pedido.status === "aguardando_receita";
  const avanco = rotuloDoAvanco(pedido);
  const aberto = pedidoEmAberto(pedido);

  return (
    <li className="px-5 py-4" style={{ animation: "rise 0.35s cubic-bezier(0.16,1,0.3,1) both" }}>
      <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="tnum text-[12.5px] text-fg-ghost">#{pedido.numero}</span>
            <p className="text-[14px] font-semibold text-fg">{pedido.cliente}</p>
            <span className="flex items-center gap-1 text-[12px] text-fg-faint">
              {pedido.origem === "whatsapp" ? (
                <MessageCircle className="h-3 w-3" strokeWidth={2} />
              ) : (
                <Store className="h-3 w-3" strokeWidth={2} />
              )}
              {pedido.origem === "whatsapp" ? "WhatsApp" : "Balcão"}
              <span className="text-fg-ghost">·</span>
              {pedido.formaEntrega === "entrega" ? (
                <>
                  <Bike className="h-3 w-3" strokeWidth={2} />
                  Entrega por motoboy
                </>
              ) : (
                "Retirada na loja"
              )}
            </span>
          </div>

          <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">
            {pedido.itens.map((i) => `${i.quantidade}x ${i.nome}`).join(" · ")}
          </p>

          {pedido.formaEntrega === "entrega" && pedido.enderecoEntrega && (
            <p className="mt-1 flex items-start gap-1 text-[12px] text-fg-faint">
              <MapPin className="mt-[2px] h-3 w-3 shrink-0" strokeWidth={2} />
              {pedido.enderecoEntrega}
            </p>
          )}
          {pedido.observacao && <p className="mt-1 text-[12px] italic text-fg-faint">{pedido.observacao}</p>}
          {pedido.receitaConferidaPor && (
            <p className="mt-1 flex items-center gap-1 text-[12px] text-fg-faint">
              <Stethoscope className="h-3 w-3" strokeWidth={2} />
              Receita conferida por {pedido.receitaConferidaPor}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1 text-right">
          <span className="tnum text-[15px] font-semibold text-fg">{formatBRLCents(pedido.total)}</span>
          {pedido.taxaEntrega > 0 && (
            <span className="tnum text-[11.5px] text-fg-ghost">
              {formatBRLCents(pedido.subtotal)} + {formatBRLCents(pedido.taxaEntrega)} de entrega
            </span>
          )}
          <ChipStatus status={pedido.status} />
          <span className={cn("text-[12px]", pedido.pago ? "text-positive" : "text-fg-faint")}>
            {pagamento(pedido)}
          </span>
        </div>
      </div>

      {aberto && (
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          {travadoNaReceita && exigeReceita && (
            <span className="mr-auto flex items-center gap-1.5 text-[12px] text-caution">
              <Stethoscope className="h-3.5 w-3.5" strokeWidth={2} />
              Parado até alguém conferir a receita
            </span>
          )}

          {confirmar === "cancelar" ? (
            <span className="flex items-center gap-2">
              <span className="text-[12.5px] text-fg-muted">Cancelar o pedido #{pedido.numero}?</span>
              <button
                onClick={() => cancelarPedido(pedido.id)}
                className="btn-perigo !px-3 !py-1.5 !text-[12px]"
              >
                Cancelar pedido
              </button>
              <button
                onClick={() => setConfirmar(null)}
                className="rounded-lg px-2 py-1.5 text-[12.5px] text-fg-muted hover:text-fg"
              >
                Não
              </button>
            </span>
          ) : (
            <>
              <button
                onClick={() => setConfirmar("cancelar")}
                className="rounded-lg px-2.5 py-1.5 text-[12.5px] text-fg-faint transition-colors hover:bg-nivel-3 hover:text-negative"
              >
                Cancelar
              </button>

              {pedido.formaPagamento === "pix" && !pedido.pago && (
                <button onClick={onCobrar} className="btn-ghost !px-3 !py-1.5 !text-[12px]">
                  <QrCode className="h-3.5 w-3.5" strokeWidth={2} />
                  Cobrança Pix
                </button>
              )}

              {travadoNaReceita ? (
                <button
                  onClick={() => aprovarReceita(pedido.id, farmaceutico || "farmacêutico da loja")}
                  className="btn-primary !px-3 !py-1.5 !text-[12px]"
                >
                  <Stethoscope className="h-3.5 w-3.5" strokeWidth={2} />
                  Conferi a receita
                </button>
              ) : (
                avanco && (
                  <button
                    onClick={() =>
                      proximaEtapa(pedido) === "aguardando_pagamento" ? onCobrar() : avancarPedido(pedido.id)
                    }
                    className="btn-primary !px-3 !py-1.5 !text-[12px]"
                  >
                    {avanco}
                    <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.2} />
                  </button>
                )
              )}
            </>
          )}
        </div>
      )}

      {!aberto && (
        <div className="mt-2 flex items-center justify-end gap-2">
          {confirmar === "remover" ? (
            <>
              <span className="text-[12.5px] text-fg-muted">Tirar o pedido da lista?</span>
              <button onClick={() => removerPedido(pedido.id)} className="btn-perigo !px-3 !py-1.5 !text-[12px]">
                Remover
              </button>
              <button
                onClick={() => setConfirmar(null)}
                className="rounded-lg px-2 py-1.5 text-[12.5px] text-fg-muted hover:text-fg"
              >
                Não
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmar("remover")}
              aria-label={`Remover pedido ${pedido.numero}`}
              className="rounded-lg p-1.5 text-fg-ghost transition-colors hover:bg-nivel-3 hover:text-negative"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          )}
        </div>
      )}
    </li>
  );
}
