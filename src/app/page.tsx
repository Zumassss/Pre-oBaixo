"use client";

import { useMemo, useState } from "react";
import { LayoutGrid, Rows3 } from "lucide-react";
import { AgentConsole } from "@/components/dashboard/agent-console";
import { GlobePanel } from "@/components/dashboard/globe-panel";
import { KpiCard, type KpiView } from "@/components/dashboard/kpi-card";
import { AgentFeed } from "@/components/agent/agent-feed";
import { ArcGauge, BarSeries, ColumnChart, MeterRow } from "@/components/charts";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Reveal } from "@/components/ui/reveal";
import { useAppState } from "@/components/providers/app-state";
import {
  agentConfidence,
  hourlyVolume,
  intentBreakdown,
  revenueByDay,
  series,
} from "@/lib/mock/metrics";
import { cn, formatBRL, formatNumber } from "@/lib/utils";

type Modo = "essencial" | "completo";

function SeletorModo({
  modo,
  onChange,
}: {
  modo: Modo;
  onChange: (m: Modo) => void;
}) {
  const opcoes: { id: Modo; label: string; icon: typeof Rows3 }[] = [
    { id: "essencial", label: "Essencial", icon: Rows3 },
    { id: "completo", label: "Completo", icon: LayoutGrid },
  ];

  return (
    <div className="flex items-center gap-1 rounded-full border border-hairline bg-white/[0.03] p-1">
      {opcoes.map((o) => {
        const ativo = modo === o.id;
        const Icon = o.icon;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors",
              ativo
                ? "bg-brand-500/15 text-brand-300 ring-1 ring-inset ring-brand-500/30"
                : "text-fg-faint hover:text-fg-muted",
            )}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={2} />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function CentralDeOperacoes() {
  const [modo, setModo] = useState<Modo>("essencial");
  const { escala, periodo, unidadeAtual } = useAppState();

  // Os indicadores acompanham o filtro de unidade e período da barra superior.
  const kpis = useMemo<KpiView[]>(
    () => [
      {
        id: "conversas",
        label: "Conversas atendidas",
        value: formatNumber(escala(712)),
        delta: 18.4,
        hint: "pelo agente",
        spark: series(20, { base: 140, amplitude: 55, trend: 1.8, seed: 3 }),
      },
      {
        id: "automacao",
        label: "Resolvido sem humano",
        value: "87,2%",
        delta: 6.1,
        hint: "meta de 80%",
        spark: series(20, { base: 82, amplitude: 7, trend: 0.2, seed: 11 }),
      },
      {
        id: "resposta",
        label: "Tempo de resposta",
        value: "8s",
        delta: -42.5,
        hint: "média do agente",
        spark: series(20, { base: 12, amplitude: 4, trend: -0.15, seed: 7 }),
        invertido: true,
      },
      {
        id: "receita",
        label: "Receita influenciada",
        value: formatBRL(escala(29800)),
        delta: 24.7,
        hint: "pedidos via WhatsApp",
        spark: series(20, { base: 5800, amplitude: 2000, trend: 90, seed: 19 }),
      },
    ],
    [escala],
  );

  return (
    <div className="mx-auto max-w-[1560px]">
      {/* Cabeçalho */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.025em] text-fg">
            Central de Operações
          </h1>
          <p className="mt-0.5 text-[13px] text-fg-muted">
            {unidadeAtual ? unidadeAtual.name : "Todas as unidades"}
            {periodo === "hoje" ? ", hoje" : periodo === "7dias" ? ", 7 dias" : ", 30 dias"}
          </p>
        </div>
        <SeletorModo modo={modo} onChange={setModo} />
      </div>

      {/* Operação ao vivo e agente */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <GlobePanel className="h-[440px] sm:h-[520px] xl:col-span-8 xl:h-[560px]" />
        <AgentConsole className="h-[480px] xl:col-span-4 xl:h-[560px]" />
      </div>

      {/* Indicadores */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi, i) => (
          <KpiCard key={kpi.id} kpi={kpi} index={i} />
        ))}
      </div>

      {/* Histórico do agente */}
      <Panel className="mt-4">
        <PanelHeader eyebrow="Histórico" title="O que o agente fez" live />
        <div className="max-h-[300px] overflow-y-auto">
          <AgentFeed limit={10} />
        </div>
      </Panel>

      {/* Modo completo */}
      {modo === "completo" && (
        <div
          className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12"
          style={{ animation: "rise 0.45s cubic-bezier(0.16,1,0.3,1) both" }}
        >
          <Panel className="xl:col-span-5">
            <PanelHeader eyebrow="Fluxo" title="Mensagens por hora" />
            <div className="px-5 pb-5">
              <BarSeries data={hourlyVolume} highlightFrom={17} />
              <div className="mt-4 flex items-center justify-between border-t border-hairline pt-3">
                <div>
                  <p className="tnum font-mono text-[17px] font-semibold text-fg">
                    {formatNumber(escala(2847))}
                  </p>
                  <p className="text-[11px] text-fg-ghost">mensagens</p>
                </div>
                <span className="chip chip-hot">pico às 19h</span>
              </div>
            </div>
          </Panel>

          <Panel className="xl:col-span-4">
            <PanelHeader eyebrow="Demanda" title="O que os clientes pedem" />
            <div className="space-y-3.5 px-5 pb-5">
              {intentBreakdown.map((intent) => (
                <MeterRow
                  key={intent.label}
                  label={intent.label}
                  value={intent.value}
                  tone={intent.tone}
                />
              ))}
            </div>
          </Panel>

          <Panel className="xl:col-span-3">
            <PanelHeader eyebrow="Saúde" title="Resolvidos" />
            <div className="px-5 pb-5 pt-1">
              <ArcGauge
                value={escala(983)}
                max={escala(1200)}
                label="pelo agente"
                caption={`de ${formatNumber(escala(1127))} conversas`}
              />
            </div>
          </Panel>

          <Panel className="xl:col-span-4">
            <PanelHeader eyebrow="Modelo" title="Confiança do agente" />
            <div className="space-y-3.5 px-5 pb-5">
              {agentConfidence.map((row) => (
                <MeterRow
                  key={row.label}
                  label={row.label}
                  value={row.value}
                  tone={row.value >= 92 ? "good" : "brand"}
                />
              ))}
            </div>
          </Panel>

          <Panel className="xl:col-span-5">
            <PanelHeader eyebrow="Resultado" title="Receita por dia" />
            <div className="px-5 pb-5">
              <ColumnChart data={revenueByDay} formatAs="compact" />
            </div>
          </Panel>

          <Panel className="xl:col-span-3">
            <PanelHeader
              eyebrow="Atenção"
              title="Precisa de você"
              action={<span className="chip chip-warn">3</span>}
            />
            <ul className="space-y-1 px-3 pb-4">
              {[
                { titulo: "Estoque crítico", detalhe: "Amoxicilina, Santa Rita" },
                { titulo: "Unidade sem conexão", detalhe: "Alto da Serra, 12 min" },
                { titulo: "Campanha aguardando", detalhe: "Dermocosméticos, 18h" },
              ].map((item) => (
                <Reveal
                  as="li"
                  key={item.titulo}
                  className="flex items-start gap-2.5 rounded-xl px-2 py-2.5"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-caution" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-fg">
                      {item.titulo}
                    </p>
                    <p className="mt-0.5 truncate text-[11.5px] text-fg-ghost">
                      {item.detalhe}
                    </p>
                  </div>
                </Reveal>
              ))}
            </ul>
          </Panel>
        </div>
      )}
    </div>
  );
}
