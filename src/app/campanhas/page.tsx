import { Plus, Sparkles } from "lucide-react";
import { PageHeader, Panel, PanelHeader } from "@/components/ui/panel";
import { Table, Td, Thead, Tr } from "@/components/ui/table";
import { ColumnChart } from "@/components/charts";
import { campaigns } from "@/lib/mock/crm";
import { revenueByDay } from "@/lib/mock/metrics";
import { cn, formatBRL, formatNumber } from "@/lib/utils";

export const metadata = { title: "Campanhas · Preço Baixo" };

const statusClass: Record<string, string> = {
  ativa: "chip-good",
  agendada: "chip-hot",
  encerrada: "chip",
  rascunho: "chip-warn",
};

export default function CampanhasPage() {
  const receitaTotal = campaigns.reduce((sum, c) => sum + c.revenue, 0);
  const enviadas = campaigns.reduce((sum, c) => sum + c.sent, 0);
  const convertidas = campaigns.reduce((sum, c) => sum + c.converted, 0);

  return (
    <div className="mx-auto max-w-[1560px]">
      <PageHeader
        title="Campanhas"
        description="Disparos segmentados pelo WhatsApp, sempre restritos a quem deu consentimento."
        action={
          <button className="btn-primary">
            <Plus className="h-4 w-4" strokeWidth={2.4} />
            Nova campanha
          </button>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Receita gerada",
            value: formatBRL(receitaTotal),
            hint: "somando campanhas ativas",
          },
          {
            label: "Mensagens enviadas",
            value: formatNumber(enviadas),
            hint: "todas com opt-in",
          },
          {
            label: "Conversões",
            value: formatNumber(convertidas),
            hint: `${((convertidas / enviadas) * 100).toFixed(1).replace(".", ",")}% do enviado`,
          },
          {
            label: "Custo por conversão",
            value: "R$ 1,84",
            hint: "inclui custo de API",
          },
        ].map((stat, i) => (
          <div
            key={stat.label}
            className="tile tile-interactive p-4"
            style={{
              animation: `rise 0.6s cubic-bezier(0.16,1,0.3,1) ${i * 70}ms both`,
            }}
          >
            <p className="text-[12px] text-fg-muted">{stat.label}</p>
            <p className="tnum mt-2 text-[24px] font-semibold leading-none tracking-[-0.03em] text-fg">
              {stat.value}
            </p>
            <p className="mt-1.5 text-[11px] text-fg-ghost">{stat.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Panel className="xl:col-span-8">
          <PanelHeader eyebrow="Todas" title="Campanhas da rede" />
          <Table>
            <Thead
              columns={[
                "Campanha",
                "Status",
                "Público",
                "Abertura",
                "Conversão",
                "Receita",
              ]}
            />
            <tbody>
              {campaigns.map((campaign, i) => {
                const abertura = campaign.sent
                  ? (campaign.opened / campaign.sent) * 100
                  : 0;
                const conversao = campaign.sent
                  ? (campaign.converted / campaign.sent) * 100
                  : 0;
                return (
                  <Tr key={campaign.id} index={i}>
                    <Td>
                      <p className="font-medium text-fg">{campaign.name}</p>
                      <p className="text-[10.5px] text-fg-ghost">
                        {campaign.channel} · {campaign.scheduledFor}
                      </p>
                    </Td>
                    <Td>
                      <span className={cn("chip", statusClass[campaign.status])}>
                        {campaign.status}
                      </span>
                    </Td>
                    <Td className="tnum font-mono">
                      {formatNumber(campaign.audience)}
                    </Td>
                    <Td className="tnum font-mono">
                      {campaign.sent
                        ? `${abertura.toFixed(0)}%`
                        : "—"}
                    </Td>
                    <Td className="tnum font-mono">
                      {campaign.sent ? (
                        <span
                          className={cn(
                            conversao >= 20 ? "text-positive" : "text-fg-muted",
                          )}
                        >
                          {conversao.toFixed(1).replace(".", ",")}%
                        </span>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td align="right" className="tnum font-mono font-medium text-fg">
                      {campaign.revenue ? formatBRL(campaign.revenue) : "—"}
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </Panel>

        <div className="flex flex-col gap-4 xl:col-span-4">
          <Panel>
            <PanelHeader eyebrow="Resultado" title="Receita por dia" />
            <div className="px-5 pb-5">
              <ColumnChart data={revenueByDay} formatAs="compact" />
            </div>
          </Panel>

          <Panel hot className="flex-1">
            <PanelHeader eyebrow="Sugestão" title="O agente recomenda" />
            <div className="px-5 pb-5">
              <div className="flex items-start gap-3">
                <Sparkles
                  className="mt-0.5 h-4 w-4 shrink-0 text-brand-400"
                  strokeWidth={2}
                />
                <p className="text-[12.5px] leading-relaxed text-fg-muted">
                  312 clientes compraram anti-hipertensivo há 27 dias e ainda não
                  voltaram. O ciclo médio deles é de 30 dias — uma campanha de
                  recompra enviada hoje pega a janela certa.
                </p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="tile p-3">
                  <p className="tnum font-mono text-[18px] font-semibold text-fg">
                    312
                  </p>
                  <p className="text-[10.5px] text-fg-ghost">clientes no alvo</p>
                </div>
                <div className="tile p-3">
                  <p className="tnum font-mono text-[18px] font-semibold text-positive">
                    68%
                  </p>
                  <p className="text-[10.5px] text-fg-ghost">conversão prevista</p>
                </div>
              </div>
              <button className="btn-primary mt-3 w-full">
                Criar campanha sugerida
              </button>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
