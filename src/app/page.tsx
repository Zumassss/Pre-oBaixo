import {
  ArcGauge,
  BarSeries,
  ColumnChart,
  MeterRow,
} from "@/components/charts";
import { AgentFeed } from "@/components/agent/agent-feed";
import { GlobePanel } from "@/components/dashboard/globe-panel";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Panel, PanelHeader, PanelLink } from "@/components/ui/panel";
import {
  agentConfidence,
  hourlyVolume,
  intentBreakdown,
  kpis,
  revenueByDay,
} from "@/lib/mock/metrics";
import { stores } from "@/lib/mock/stores";
import { cn } from "@/lib/utils";

export default function CentralDeOperacoes() {
  return (
    <div className="mx-auto max-w-[1560px]">
      {/* Indicadores */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi, i) => (
          <KpiCard
            key={kpi.id}
            kpi={kpi}
            index={i}
            invertDelta={kpi.id === "resposta"}
          />
        ))}
      </div>

      {/* Bloco central */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* Coluna esquerda */}
        <div className="flex flex-col gap-4 xl:col-span-3">
          <Panel>
            <PanelHeader
              eyebrow="Fluxo"
              title="Mensagens por hora"
              action={<PanelLink>detalhes</PanelLink>}
            />
            <div className="px-5 pb-5">
              <BarSeries data={hourlyVolume} highlightFrom={17} />
              <div className="mt-4 flex items-center justify-between border-t border-hairline pt-3">
                <div>
                  <p className="tnum font-mono text-[17px] font-semibold text-fg">
                    2.847
                  </p>
                  <p className="text-[11px] text-fg-ghost">mensagens hoje</p>
                </div>
                <span className="chip chip-hot">pico às 19h</span>
              </div>
            </div>
          </Panel>

          <Panel className="flex-1">
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
        </div>

        {/* Globo */}
        <div className="xl:col-span-6">
          <GlobePanel />
        </div>

        {/* Coluna direita */}
        <div className="flex flex-col gap-4 xl:col-span-3">
          <Panel>
            <PanelHeader eyebrow="Saúde" title="Atendimentos resolvidos" />
            <div className="px-5 pb-5 pt-1">
              <ArcGauge
                value={983}
                max={1200}
                label="resolvidos pelo agente"
                caption="de 1.127 conversas hoje"
              />
            </div>
          </Panel>

          <Panel>
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

          <Panel className="flex-1">
            <PanelHeader eyebrow="Rede" title="Status das unidades" />
            <div className="px-3 pb-4">
              <ul className="space-y-0.5">
                {stores.map((store) => (
                  <li
                    key={store.id}
                    className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.03]"
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        store.status === "online" &&
                          "bg-positive shadow-[0_0_6px_1px_rgba(24,209,127,0.7)]",
                        store.status === "atencao" &&
                          "bg-caution shadow-[0_0_6px_1px_rgba(255,176,32,0.6)]",
                        store.status === "offline" && "bg-fg-ghost",
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate text-[12px] text-fg-muted">
                      {store.name}
                    </span>
                    <span className="tnum shrink-0 font-mono text-[11px] text-fg-ghost">
                      {store.conversas}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </Panel>
        </div>
      </div>

      {/* Fluxo do agente + receita */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Panel className="lg:col-span-7">
          <PanelHeader
            eyebrow="Fluxo do agente"
            title="O que está acontecendo agora"
            live
            action={<PanelLink>histórico completo</PanelLink>}
          />
          <div className="max-h-[430px] overflow-y-auto">
            <AgentFeed limit={14} />
          </div>
        </Panel>

        <div className="flex flex-col gap-4 lg:col-span-5">
          <Panel>
            <PanelHeader
              eyebrow="Resultado"
              title="Receita influenciada pelo agente"
              action={<PanelLink>relatório</PanelLink>}
            />
            <div className="px-5 pb-5">
              <ColumnChart data={revenueByDay} formatAs="compact" />
              <div className="mt-4 grid grid-cols-3 gap-3 border-t border-hairline pt-4">
                <div>
                  <p className="tnum font-mono text-[16px] font-semibold text-fg">
                    R$ 186 mil
                  </p>
                  <p className="text-[10.5px] text-fg-ghost">na semana</p>
                </div>
                <div>
                  <p className="tnum font-mono text-[16px] font-semibold text-fg">
                    R$ 74,20
                  </p>
                  <p className="text-[10.5px] text-fg-ghost">ticket médio</p>
                </div>
                <div>
                  <p className="tnum font-mono text-[16px] font-semibold text-positive">
                    +24,7%
                  </p>
                  <p className="text-[10.5px] text-fg-ghost">vs. semana ant.</p>
                </div>
              </div>
            </div>
          </Panel>

          <Panel className="flex-1">
            <PanelHeader
              eyebrow="Atenção"
              title="Precisa de decisão humana"
              action={<span className="chip chip-warn">3 abertos</span>}
            />
            <ul className="space-y-1 px-3 pb-4">
              {[
                {
                  title: "Estoque crítico · Amoxicilina 500mg",
                  detail: "Filial Santa Rita · 18 un (mín. 40)",
                  tone: "warn" as const,
                },
                {
                  title: "Unidade sem conexão há 12 min",
                  detail: "Filial Alto da Serra · WhatsApp desconectado",
                  tone: "warn" as const,
                },
                {
                  title: "Campanha aguardando aprovação",
                  detail: "Dermocosméticos · agendada para hoje 18h",
                  tone: "brand" as const,
                },
              ].map((item) => (
                <li
                  key={item.title}
                  className="flex items-start gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-white/[0.03]"
                >
                  <span
                    className={cn(
                      "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                      item.tone === "warn" ? "bg-caution" : "bg-brand-500",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-fg">
                      {item.title}
                    </p>
                    <p className="mt-0.5 truncate text-[11.5px] text-fg-ghost">
                      {item.detail}
                    </p>
                  </div>
                  <button className="btn-ghost shrink-0 !px-3 !py-1 !text-[11px]">
                    resolver
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
