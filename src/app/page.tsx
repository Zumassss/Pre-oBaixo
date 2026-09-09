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
import { useBanco } from "@/lib/db/use-db";
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

  return (
    <div className="mx-auto max-w-[1560px] space-y-4">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-[24px] font-semibold tracking-[-0.025em] text-fg">
          {nomeLoja}
        </h1>
        <p className="mt-0.5 text-[13px] text-fg-muted">{enderecoLoja}</p>
      </div>

      <SetupChecklist />

      {/* Operação e agente */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <GlobePanel className="h-[420px] sm:h-[500px] xl:col-span-8 xl:h-[540px]" />
        <AgentConsole className="h-[460px] xl:col-span-4 xl:h-[540px]" />
      </div>

      {/* Pedidos e histórico */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <FilaPedidos banco={banco} />
        </div>
        <div className="xl:col-span-5">
          <HistoricoAgente eventos={eventos} />
        </div>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {indicadores.map((item, i) => {
          const Icon = item.icon;
          return (
            <Reveal
              key={item.id}
              className="tile p-4"
              style={{
                animation: `rise 0.5s cubic-bezier(0.16,1,0.3,1) ${i * 60}ms both`,
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11.5px] font-medium text-fg-muted">
                  {item.label}
                </p>
                <Icon className="h-3.5 w-3.5 text-fg-ghost" strokeWidth={2} />
              </div>
              <p className="tnum mt-2 text-[24px] font-semibold leading-none tracking-[-0.03em] text-fg">
                {carregado ? item.valor : "0"}
              </p>
              <p className="mt-1.5 truncate text-[11px] text-fg-ghost">{item.hint}</p>
            </Reveal>
          );
        })}
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
