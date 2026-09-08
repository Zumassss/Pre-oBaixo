import {
  BookOpenCheck,
  Database,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { PageHeader, Panel, PanelHeader } from "@/components/ui/panel";
import { Table, Td, Thead, Tr } from "@/components/ui/table";
import { MeterRow } from "@/components/charts";
import { AgentFeed } from "@/components/agent/agent-feed";
import { Reveal } from "@/components/ui/reveal";
import { guardrails, knowledgeSources } from "@/lib/mock/catalog";
import { agentConfidence } from "@/lib/mock/metrics";
import { cn } from "@/lib/utils";

export const metadata = { title: "Cérebro do Agente · Preço Baixo" };

const statusClass: Record<string, string> = {
  sincronizado: "chip-good",
  sincronizando: "chip-hot",
  pendente: "chip-warn",
};

export default function AgentePage() {
  return (
    <div className="mx-auto max-w-[1560px]">
      <PageHeader
        title="Cérebro do Agente"
        description="O que ele sabe, o que faz sozinho e o que passa por uma pessoa."
        action={
          <button className="btn-primary">
            <RefreshCw className="h-4 w-4" strokeWidth={2} />
            Sincronizar
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Panel className="xl:col-span-8">
          <PanelHeader eyebrow="Identidade" title="Como o agente se comporta" />
          <div className="px-5 pb-5">
            <Reveal className="tile p-4">
              <p className="text-[13px] leading-[1.65] text-fg-muted">
                Atendente digital das{" "}
                <span className="font-medium text-fg">Farmácias Preço Baixo</span>.
                Fala como alguém do balcão: direto, cordial, objetivo. Responde
                preço, disponibilidade, horário, endereço e status de pedido
                consultando o catálogo da unidade certa.{" "}
                <span className="font-medium text-brand-300">
                  Nunca indica nem opina sobre medicamento
                </span>
                , qualquer dúvida clínica vai ao farmacêutico responsável.
              </p>
            </Reveal>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Modelo", value: "Claude Haiku" },
                { label: "Idioma", value: "pt-BR" },
                { label: "Canal", value: "WhatsApp" },
                { label: "Escalonamento", value: "Automático" },
              ].map((item) => (
                <Reveal key={item.label} className="tile p-3">
                  <p className="text-[10.5px] uppercase tracking-[0.12em] text-fg-ghost">
                    {item.label}
                  </p>
                  <p className="mt-1 text-[13px] font-medium text-fg">{item.value}</p>
                </Reveal>
              ))}
            </div>

            <button className="btn-ghost mt-4">Editar comportamento</button>
          </div>
        </Panel>

        <Panel className="xl:col-span-4">
          <PanelHeader eyebrow="Desempenho" title="Confiança por tarefa" />
          <div className="space-y-3.5 px-5 pb-5">
            {agentConfidence.map((row) => (
              <MeterRow
                key={row.label}
                label={row.label}
                value={row.value}
                tone={row.value >= 92 ? "good" : "brand"}
              />
            ))}
            <Reveal className="tile mt-4 flex items-start gap-2.5 p-3">
              <Sparkles
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-400"
                strokeWidth={2}
              />
              <p className="text-[11.5px] leading-relaxed text-fg-faint">
                Abaixo de 85% de confiança, o agente para e chama uma pessoa.
              </p>
            </Reveal>
          </div>
        </Panel>

        <Panel className="xl:col-span-7">
          <PanelHeader
            eyebrow="Conhecimento"
            title="De onde vêm as respostas"
            action={
              <span className="chip">
                <Database className="h-3 w-3" strokeWidth={2} />
                {knowledgeSources.length} fontes
              </span>
            }
          />
          <Table>
            <Thead columns={["Fonte", "Tipo", "Itens", "Atualização", "Status"]} />
            <tbody>
              {knowledgeSources.map((source, i) => (
                <Tr key={source.id} index={i}>
                  <Td>
                    <p className="font-medium text-fg">{source.name}</p>
                    {source.reviewedBy && (
                      <p className="mt-0.5 flex items-center gap-1 text-[10.5px] text-positive">
                        <BookOpenCheck className="h-3 w-3" strokeWidth={2} />
                        revisado por {source.reviewedBy}
                      </p>
                    )}
                  </Td>
                  <Td className="text-fg-faint">{source.type}</Td>
                  <Td className="tnum font-mono">
                    {source.items.toLocaleString("pt-BR")}
                  </Td>
                  <Td className="text-fg-faint">{source.updatedAt}</Td>
                  <Td align="right">
                    <span className={cn("chip", statusClass[source.status])}>
                      {source.status}
                    </span>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Panel>

        <Panel className="xl:col-span-5">
          <PanelHeader
            eyebrow="Segurança"
            title="O que ele nunca faz sozinho"
            action={
              <span className="chip chip-good">
                <ShieldCheck className="h-3 w-3" strokeWidth={2} />
                {guardrails.length} ativas
              </span>
            }
          />
          <ul className="space-y-1 px-3 pb-4">
            {guardrails.map((rule) => (
              <Reveal
                as="li"
                key={rule.id}
                className="flex items-start gap-3 rounded-xl px-2 py-2.5"
              >
                <span className="mt-1 flex h-4 w-7 shrink-0 items-center rounded-full bg-positive/25 p-0.5 ring-1 ring-inset ring-positive/40">
                  <span className="ml-auto h-3 w-3 rounded-full bg-positive shadow-[0_0_8px_1px_rgba(24,209,127,0.6)]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-medium text-fg">{rule.title}</p>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-fg-faint">
                    {rule.detail}
                  </p>
                </div>
              </Reveal>
            ))}
          </ul>
        </Panel>

        <Panel className="xl:col-span-12">
          <PanelHeader eyebrow="Auditoria" title="Registro de decisões" live />
          <div className="max-h-[340px] overflow-y-auto">
            <AgentFeed limit={10} />
          </div>
        </Panel>
      </div>
    </div>
  );
}
