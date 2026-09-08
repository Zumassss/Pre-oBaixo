"use client";

import { useMemo, useState } from "react";
import { Pause, Play, Plus, Sparkles } from "lucide-react";
import { PageHeader, Panel, PanelHeader } from "@/components/ui/panel";
import { Table, Td, Thead, Tr } from "@/components/ui/table";
import { ColumnChart } from "@/components/charts";
import { Reveal } from "@/components/ui/reveal";
import { campaigns as base, type Campaign } from "@/lib/mock/crm";
import { revenueByDay } from "@/lib/mock/metrics";
import { cn, formatBRL, formatNumber } from "@/lib/utils";

const statusClass: Record<Campaign["status"], string> = {
  ativa: "chip-good",
  agendada: "chip-hot",
  encerrada: "chip",
  rascunho: "chip-warn",
};

export default function CampanhasPage() {
  const [lista, setLista] = useState<Campaign[]>(base);
  const [criada, setCriada] = useState(false);

  function alternar(id: string) {
    setLista((atual) =>
      atual.map((c) =>
        c.id === id
          ? {
              ...c,
              status:
                c.status === "ativa"
                  ? "encerrada"
                  : c.status === "encerrada" || c.status === "rascunho"
                    ? "ativa"
                    : "ativa",
            }
          : c,
      ),
    );
  }

  function criarSugerida() {
    if (criada) return;
    setLista((atual) => [
      {
        id: `cmp-${Date.now()}`,
        name: "Recompra · Anti-hipertensivos (sugerida)",
        status: "agendada",
        audience: 312,
        sent: 0,
        opened: 0,
        converted: 0,
        revenue: 0,
        channel: "WhatsApp",
        scheduledFor: "hoje, 18:00",
      },
      ...atual,
    ]);
    setCriada(true);
  }

  const totais = useMemo(() => {
    const receita = lista.reduce((s, c) => s + c.revenue, 0);
    const enviadas = lista.reduce((s, c) => s + c.sent, 0);
    const convertidas = lista.reduce((s, c) => s + c.converted, 0);
    return { receita, enviadas, convertidas };
  }, [lista]);

  return (
    <div className="mx-auto max-w-[1560px]">
      <PageHeader
        title="Campanhas"
        description="Disparos pelo WhatsApp, sempre restritos a quem deu consentimento."
        action={
          <button className="btn-primary">
            <Plus className="h-4 w-4" strokeWidth={2.4} />
            Nova campanha
          </button>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Receita gerada", value: formatBRL(totais.receita), hint: "campanhas ativas" },
          { label: "Mensagens enviadas", value: formatNumber(totais.enviadas), hint: "todas com opt-in" },
          {
            label: "Conversões",
            value: formatNumber(totais.convertidas),
            hint: totais.enviadas
              ? `${((totais.convertidas / totais.enviadas) * 100).toFixed(1).replace(".", ",")}% do enviado`
              : "sem envios",
          },
          { label: "Custo por conversão", value: "R$ 1,84", hint: "inclui custo de API" },
        ].map((stat, i) => (
          <Reveal
            key={stat.label}
            className="tile p-4"
            style={{ animation: `rise 0.5s cubic-bezier(0.16,1,0.3,1) ${i * 60}ms both` }}
          >
            <p className="text-[12px] text-fg-muted">{stat.label}</p>
            <p className="tnum mt-2 text-[23px] font-semibold leading-none tracking-[-0.03em] text-fg">
              {stat.value}
            </p>
            <p className="mt-1.5 text-[11px] text-fg-ghost">{stat.hint}</p>
          </Reveal>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Panel className="xl:col-span-8">
          <PanelHeader eyebrow="Todas" title="Campanhas da rede" />
          <Table>
            <Thead
              columns={["Campanha", "Status", "Público", "Abertura", "Conversão", "Ação"]}
            />
            <tbody>
              {lista.map((campaign, i) => {
                const abertura = campaign.sent
                  ? (campaign.opened / campaign.sent) * 100
                  : 0;
                const conversao = campaign.sent
                  ? (campaign.converted / campaign.sent) * 100
                  : 0;
                const ativa = campaign.status === "ativa";
                return (
                  <Tr key={campaign.id} index={i}>
                    <Td>
                      <p className="font-medium text-fg">{campaign.name}</p>
                      <p className="text-[10.5px] text-fg-ghost">
                        {campaign.channel}, {campaign.scheduledFor}
                      </p>
                    </Td>
                    <Td>
                      <span className={cn("chip", statusClass[campaign.status])}>
                        {campaign.status}
                      </span>
                    </Td>
                    <Td className="tnum font-mono">{formatNumber(campaign.audience)}</Td>
                    <Td className="tnum font-mono">
                      {campaign.sent ? `${abertura.toFixed(0)}%` : "sem envio"}
                    </Td>
                    <Td className="tnum font-mono">
                      {campaign.sent ? (
                        <span className={cn(conversao >= 20 && "text-positive")}>
                          {conversao.toFixed(1).replace(".", ",")}%
                        </span>
                      ) : (
                        "sem envio"
                      )}
                    </Td>
                    <Td align="right">
                      <button
                        onClick={() => alternar(campaign.id)}
                        className="btn-ghost !px-3 !py-1 !text-[11px]"
                      >
                        {ativa ? (
                          <>
                            <Pause className="h-3 w-3" strokeWidth={2.2} />
                            pausar
                          </>
                        ) : (
                          <>
                            <Play className="h-3 w-3" strokeWidth={2.2} />
                            ativar
                          </>
                        )}
                      </button>
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

          <Panel className="flex-1">
            <PanelHeader eyebrow="Sugestão" title="O agente recomenda" />
            <div className="px-5 pb-5">
              <div className="flex items-start gap-3">
                <Sparkles
                  className="mt-0.5 h-4 w-4 shrink-0 text-brand-400"
                  strokeWidth={2}
                />
                <p className="text-[12.5px] leading-relaxed text-fg-muted">
                  312 clientes compraram anti-hipertensivo há 27 dias e não
                  voltaram. O ciclo médio é de 30 dias, então hoje é a janela.
                </p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Reveal className="tile p-3">
                  <p className="tnum font-mono text-[18px] font-semibold text-fg">312</p>
                  <p className="text-[10.5px] text-fg-ghost">no alvo</p>
                </Reveal>
                <Reveal className="tile p-3">
                  <p className="tnum font-mono text-[18px] font-semibold text-positive">
                    68%
                  </p>
                  <p className="text-[10.5px] text-fg-ghost">conversão prevista</p>
                </Reveal>
              </div>
              <button
                onClick={criarSugerida}
                disabled={criada}
                className="btn-primary mt-3 w-full"
              >
                {criada ? "Campanha criada" : "Criar campanha sugerida"}
              </button>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
