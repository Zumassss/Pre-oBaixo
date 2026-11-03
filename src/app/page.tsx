"use client";

import { useMemo } from "react";
import { Activity, MessagesSquare, Package, Users } from "lucide-react";
import { AgentConsole } from "@/components/dashboard/agent-console";
import { GlobePanel } from "@/components/dashboard/globe-panel";
import { SetupChecklist } from "@/components/dashboard/setup-checklist";
import { FilaPedidos } from "@/components/dashboard/fila-pedidos";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/empty-state";
import { Reveal } from "@/components/ui/reveal";
import { useAppState } from "@/components/providers/app-state";
import { useBanco, useWhatsappNoAr } from "@/lib/db/use-db";
import { formatNumber } from "@/lib/utils";

function horario(em: number) {
  return new Date(em).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Painel() {
  const { banco, carregado } = useBanco();
  const { desde, periodo } = useAppState();

  const eventos = useMemo(
    () => banco.eventos.filter((e) => e.em >= desde),
    [banco.eventos, desde],
  );

  const conversasPeriodo = banco.conversas.filter((c) => c.atualizadaEm >= desde);
  const abertas = banco.conversas.filter((c) => c.status !== "resolvida").length;

  const indicadores = [
    {
      id: "conversas",
      label: "Conversas",
      valor: formatNumber(conversasPeriodo.length),
      hint: abertas > 0 ? `${abertas} em aberto` : "nenhuma em aberto",
      icon: MessagesSquare,
    },
    {
      id: "clientes",
      label: "Clientes cadastrados",
      valor: formatNumber(banco.clientes.length),
      hint: `${banco.clientes.filter((c) => c.consentimento).length} com opt-in`,
      icon: Users,
    },
    {
      id: "produtos",
      label: "Produtos no catálogo",
      valor: formatNumber(banco.produtos.length),
      hint: `${banco.produtos.filter((p) => p.estoque < p.estoqueMinimo).length} abaixo do mínimo`,
      icon: Package,
    },
    {
      id: "agente",
      label: "Interações com o agente",
      valor: formatNumber(eventos.length),
      hint:
        periodo === "hoje" ? "hoje" : periodo === "7dias" ? "em 7 dias" : "em 30 dias",
      icon: Activity,
    },
  ];

  const nomeLoja = banco.loja.nome || "Loja sem nome";
  const enderecoLoja = banco.loja.configurada
    ? [banco.loja.endereco, banco.loja.bairro, banco.loja.cidade]
        .filter(Boolean)
        .join(", ")
    : "Configure os dados da loja para começar";

  const conectado = useWhatsappNoAr(banco.whatsapp);
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";

  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      {/* Cabeçalho: quem é a loja e se o WhatsApp está no ar. Nada além. */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] text-fg-faint">{saudacao}</p>
          <h1 className="mt-0.5 text-[26px] font-semibold tracking-[-0.025em] text-fg">
            {nomeLoja}
          </h1>
          <p className="mt-0.5 text-[13px] text-fg-muted">{enderecoLoja}</p>
        </div>
        <span
          className={`flex items-center gap-2 rounded-full border border-hairline px-3 py-1.5 text-[12.5px] ${
            conectado ? "text-fg" : "text-fg-muted"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${conectado ? "bg-positive" : "bg-fg-ghost"}`}
            aria-hidden
          />
          {conectado ? "WhatsApp no ar" : "WhatsApp fora do ar"}
        </span>
      </div>

      {/* Os números do período numa faixa só. Antes eram quatro caixas no fim
          da página; resumo vem antes do detalhe. */}
      <dl className="panel grid grid-cols-2 divide-hairline xl:grid-cols-4 xl:divide-x">
        {indicadores.map((item) => (
          <div key={item.id} className="px-5 py-4">
            <dt className="text-[12px] text-fg-muted">{item.label}</dt>
            <dd className="tnum mt-1.5 text-[26px] font-semibold leading-none tracking-[-0.03em] text-fg">
              {carregado ? item.valor : "0"}
            </dd>
            <dd className="mt-1.5 truncate text-[11.5px] text-fg-ghost">{item.hint}</dd>
          </div>
        ))}
      </dl>

      <SetupChecklist />

      {/* O trabalho de agora (pedidos) ganha o espaço maior. O globo fica ao
          lado, menor: é o sinal de vida da loja, não o assunto da tela. */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <FilaPedidos banco={banco} className="max-h-[480px] xl:col-span-8 xl:h-[460px]" />
        <GlobePanel compacto className="hidden h-[360px] sm:block xl:col-span-4 xl:h-[460px]" />
      </div>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-12">
        <AgentConsole className="max-h-[440px] xl:col-span-7" />
        <div className="xl:col-span-5">
          <HistoricoAgente eventos={eventos} />
        </div>
      </div>
    </div>
  );
}

function HistoricoAgente({
  eventos,
}: {
  eventos: { id: string; tipo: string; titulo: string; detalhe: string; em: number }[];
}) {
  return (
    <Panel>
      <PanelHeader
        eyebrow="Histórico"
        title="Atividade do agente"
        action={
          eventos.length > 0 ? (
            <span className="chip">{eventos.length} registros</span>
          ) : undefined
        }
      />
      {eventos.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="Nenhuma atividade ainda"
          description="Assim que você conversar com o agente ou o WhatsApp começar a receber mensagens, tudo aparece aqui."
        />
      ) : (
        <ul data-lenis-prevent className="max-h-[352px] overflow-y-auto px-2 pb-2">
          {eventos.map((evento) => (
            <Reveal
              as="li"
              key={evento.id}
              className="flex items-start gap-3 rounded-xl p-3"
            >
              <span
                className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                  evento.tipo === "erro"
                    ? "bg-caution"
                    : evento.tipo === "pergunta"
                      ? "bg-info"
                      : "bg-brand-500"
                }`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <p className="truncate text-[12.5px] font-medium text-fg">
                    {evento.titulo}
                  </p>
                  <span className="tnum ml-auto shrink-0 font-mono text-[10.5px] text-fg-ghost">
                    {horario(evento.em)}
                  </span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-relaxed text-fg-faint">
                  {evento.detalhe}
                </p>
              </div>
            </Reveal>
          ))}
        </ul>
      )}
    </Panel>
  );
}
