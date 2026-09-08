import { PageHeader, Panel, PanelHeader } from "@/components/ui/panel";
import { AreaChart, BarSeries, ColumnChart, MeterRow } from "@/components/charts";
import { Table, Td, Thead, Tr } from "@/components/ui/table";
import { ExportButton } from "@/components/relatorios/export-button";
import {
  conversionTimeline,
  hourlyVolume,
  intentBreakdown,
  responseTimeline,
  revenueByDay,
} from "@/lib/mock/metrics";
import { storeStatusLabel, stores } from "@/lib/mock/stores";
import { cn, formatNumber } from "@/lib/utils";

export const metadata = { title: "Relatórios · Preço Baixo" };

export default function RelatoriosPage() {
  return (
    <div className="mx-auto max-w-[1560px]">
      <PageHeader
        title="Relatórios"
        description="O que a operação produziu no período."
        action={<ExportButton />}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Panel className="xl:col-span-8">
          <PanelHeader
            eyebrow="Tendência"
            title="Conversas convertidas em pedido"
            action={<span className="chip chip-hot">últimas 48h</span>}
          />
          <div className="px-5 pb-5">
            <AreaChart values={conversionTimeline} suffix="%" />
          </div>
        </Panel>

        <Panel className="xl:col-span-4">
          <PanelHeader eyebrow="Velocidade" title="Tempo de resposta" />
          <div className="px-5 pb-5">
            <AreaChart values={responseTimeline} height={190} suffix="s" />
            <div className="mt-3 grid grid-cols-2 gap-3 border-t border-hairline pt-3">
              <div>
                <p className="tnum font-mono text-[17px] font-semibold text-fg">8s</p>
                <p className="text-[10.5px] text-fg-ghost">agente</p>
              </div>
              <div>
                <p className="tnum font-mono text-[17px] font-semibold text-fg-muted">
                  4 min
                </p>
                <p className="text-[10.5px] text-fg-ghost">humano</p>
              </div>
            </div>
          </div>
        </Panel>

        <Panel className="xl:col-span-5">
          <PanelHeader eyebrow="Volume" title="Mensagens por hora" />
          <div className="px-5 pb-5">
            <BarSeries data={hourlyVolume} height={150} highlightFrom={17} />
          </div>
        </Panel>

        <Panel className="xl:col-span-4">
          <PanelHeader eyebrow="Receita" title="Pedidos por dia" />
          <div className="px-5 pb-5">
            <ColumnChart data={revenueByDay} formatAs="compact" />
          </div>
        </Panel>

        <Panel className="xl:col-span-3">
          <PanelHeader eyebrow="Demanda" title="Tipos de pergunta" />
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

        <Panel className="xl:col-span-12">
          <PanelHeader eyebrow="Rede" title="Desempenho por unidade" />
          <Table>
            <Thead
              columns={[
                "Unidade",
                "Status",
                "Conversas",
                "Pedidos",
                "Conversão",
                "Resolvido pelo agente",
              ]}
            />
            <tbody>
              {stores.map((store, i) => {
                const conversao = store.conversas
                  ? (store.pedidos / store.conversas) * 100
                  : 0;
                const automacao = store.conversas ? 82 + ((i * 7) % 14) : 0;
                return (
                  <Tr key={store.id} index={i}>
                    <Td>
                      <p className="font-medium text-fg">{store.name}</p>
                      <p className="text-[10.5px] text-fg-ghost">{store.city}</p>
                    </Td>
                    <Td>
                      <span
                        className={cn(
                          "chip",
                          store.status === "online" && "chip-good",
                          store.status === "atencao" && "chip-warn",
                        )}
                      >
                        {storeStatusLabel[store.status]}
                      </span>
                    </Td>
                    <Td className="tnum font-mono">{formatNumber(store.conversas)}</Td>
                    <Td className="tnum font-mono">{store.pedidos}</Td>
                    <Td className="tnum font-mono">
                      {store.conversas
                        ? `${conversao.toFixed(1).replace(".", ",")}%`
                        : "sem dados"}
                    </Td>
                    <Td align="right">
                      {store.conversas ? (
                        <div className="ml-auto flex w-[140px] items-center gap-2">
                          <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-brand-700 to-brand-400"
                              style={{ width: `${automacao}%` }}
                            />
                          </div>
                          <span className="tnum shrink-0 font-mono text-[11.5px] text-fg">
                            {automacao}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-fg-ghost">sem dados</span>
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </Panel>
      </div>
    </div>
  );
}
