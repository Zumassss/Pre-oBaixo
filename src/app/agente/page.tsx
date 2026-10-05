"use client";

import {
  Activity,
  Bot,
  MessageCircle,
  PauseCircle,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { AgentConsole } from "@/components/dashboard/agent-console";
import Link from "next/link";
import { PageHeader, Panel, PanelHeader } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/empty-state";
import { Reveal } from "@/components/ui/reveal";
import { definirAgenteLigado, useBanco, useSessao, useWhatsappNoAr } from "@/lib/db/use-db";
import { cn } from "@/lib/utils";

/** Regras que o agente cumpre. Estão no código, não são configuráveis por acidente. */
const REGRAS = [
  {
    id: "g-1",
    titulo: "Nunca indica ou sugere medicamento",
    detalhe: "Pedido de recomendação clínica vai ao farmacêutico da loja.",
  },
  {
    id: "g-2",
    titulo: "Nunca opina sobre interação",
    detalhe: "Pergunta sobre combinar medicamentos transfere na hora.",
  },
  {
    id: "g-3",
    titulo: "Só responde o que está cadastrado",
    detalhe: "Preço, estoque e horário saem do que você preencheu no sistema.",
  },
  {
    id: "g-5",
    titulo: "Nunca promove remédio",
    detalhe: "Promoção e complemento só em item que não é medicamento.",
  },
  {
    id: "g-6",
    titulo: "Confirma nome escrito errado",
    detalhe: "Pergunta \"você quis dizer...?\" e nunca troca o remédio.",
  },
  {
    id: "g-4",
    titulo: "Campanha exige consentimento",
    detalhe: "Cliente sem opt-in não recebe mensagem de marketing.",
  },
];

function horario(em: number) {
  return new Date(em).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ha(em: number) {
  if (!em) return "nunca";
  const minutos = Math.round((Date.now() - em) / 60000);
  if (minutos < 1) return "agora há pouco";
  if (minutos < 60) return `há ${minutos} min`;
  return horario(em);
}

export default function AgentePage() {
  const { banco, carregado } = useBanco();
  const { usuario } = useSessao();
  const noAr = useWhatsappNoAr(banco.whatsapp);
  const ligado = banco.agenteLigado.ativo;

  const fontes = [
    {
      id: "loja",
      nome: "Dados da loja",
      itens: banco.loja.configurada ? 1 : 0,
      pronto: banco.loja.configurada,
      detalhe: banco.loja.configurada
        ? `${banco.loja.nome}, ${banco.loja.cidade}`
        : "Nome, endereço e horário ainda não preenchidos",
      href: "/configuracoes",
    },
    {
      id: "catalogo",
      nome: "Catálogo de produtos",
      itens: banco.produtos.length,
      pronto: banco.produtos.length > 0,
      detalhe:
        banco.produtos.length > 0
          ? `${banco.produtos.length} produtos com preço e estoque`
          : "Nenhum produto cadastrado",
      href: "/catalogo",
    },
    {
      id: "ajustes",
      nome: "Horários, entrega e perguntas frequentes",
      itens: banco.agente.perguntas.length,
      pronto: Boolean(
        banco.agente.nomeAtendente || banco.agente.perguntas.length || banco.agente.observacoes,
      ),
      detalhe: banco.agente.perguntas.length
        ? `${banco.agente.perguntas.length} perguntas frequentes cadastradas`
        : "Ensine o agente na área protegida das Configurações",
      href: "/configuracoes?aba=loja",
    },
    {
      id: "clientes",
      nome: "Base de clientes",
      itens: banco.clientes.length,
      pronto: banco.clientes.length > 0,
      detalhe:
        banco.clientes.length > 0
          ? `${banco.clientes.length} clientes cadastrados`
          : "Nenhum cliente cadastrado",
      href: "/clientes",
    },
  ];

  const prontas = fontes.filter((f) => f.pronto).length;

  return (
    <div className="mx-auto max-w-[1560px]">
      <PageHeader
        title="Agente"
        description="O que ele sabe desta loja e o que nunca faz sozinho."
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* Controle: o WhatsApp e o agente são coisas separadas. O WhatsApp
            continua chegando no painel mesmo com o agente desligado. */}
        <Panel className="xl:col-span-6">
          <div className="flex items-center gap-4 p-5">
            <span
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset",
                noAr ? "bg-positive/12 text-positive ring-positive/30" : "bg-caution/12 text-caution ring-caution/30",
              )}
            >
              <MessageCircle className="h-5 w-5" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="eyebrow">WhatsApp</p>
              <p className="mt-0.5 text-[15px] font-semibold text-fg">
                {carregado ? (noAr ? "Conectado" : "Desconectado") : "..."}
              </p>
              <p className="mt-0.5 text-[12px] text-fg-faint">
                {banco.whatsapp.vistoEm
                  ? `Último sinal do bot ${ha(banco.whatsapp.vistoEm)}${banco.whatsapp.numero ? ` · número ${banco.whatsapp.numero}` : ""}`
                  : "O bot ainda não se conectou a esta loja"}
              </p>
            </div>
          </div>
        </Panel>

        <Panel className="xl:col-span-6">
          <div className="flex flex-wrap items-center gap-4 p-5">
            <span
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset",
                ligado ? "bg-brand-500/12 text-brand-400 ring-brand-500/30" : "bg-nivel-3 text-fg-ghost ring-anel",
              )}
            >
              <Bot className="h-5 w-5" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="eyebrow">Respostas automáticas</p>
              <p className="mt-0.5 text-[15px] font-semibold text-fg">
                {ligado ? "Agente respondendo" : "Agente desligado"}
              </p>
              <p className="mt-0.5 text-[12px] text-fg-faint">
                {ligado
                  ? "Responde sozinho quando ninguém da loja assumiu a conversa."
                  : `Desligado por ${banco.agenteLigado.alteradoPor || "alguém da loja"} ${ha(banco.agenteLigado.em)}. As mensagens chegam em Conversas para a equipe responder.`}
              </p>
            </div>
            <button
              onClick={() => definirAgenteLigado(!ligado, usuario?.nome ?? "")}
              className={ligado ? "btn-ghost" : "btn-primary"}
            >
              {ligado ? (
                <PauseCircle className="h-4 w-4" strokeWidth={2} />
              ) : (
                <PlayCircle className="h-4 w-4" strokeWidth={2} />
              )}
              {ligado ? "Desligar agente" : "Ligar agente"}
            </button>
          </div>
        </Panel>

        <Panel className="xl:col-span-7">
          <PanelHeader
            eyebrow="Conhecimento"
            title="De onde vêm as respostas"
            action={
              <span className={cn("chip", prontas === fontes.length ? "chip-good" : "chip-warn")}>
                {prontas} de {fontes.length}
              </span>
            }
          />
          <ul className="space-y-1 px-3 pb-4">
            {fontes.map((fonte) => (
              <li key={fonte.id}>
                <Link
                  href={fonte.href}
                  className="selectable flex items-center gap-3 rounded-xl px-2 py-3"
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ring-1 ring-inset",
                      fonte.pronto
                        ? "bg-positive/12 text-positive ring-positive/25"
                        : "bg-nivel-3 text-fg-ghost ring-anel",
                    )}
                  >
                    {carregado ? fonte.itens : 0}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-medium text-fg">{fonte.nome}</p>
                    <p className="mt-0.5 truncate text-[11.5px] text-fg-faint">
                      {fonte.detalhe}
                    </p>
                  </div>
                  <span className={cn("chip", fonte.pronto ? "chip-good" : "chip-warn")}>
                    {fonte.pronto ? "pronto" : "vazio"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel className="xl:col-span-5">
          <PanelHeader
            eyebrow="Segurança"
            title="O que ele nunca faz"
            action={
              <span className="chip chip-good">
                <ShieldCheck className="h-3 w-3" strokeWidth={2} />
                {REGRAS.length} ativas
              </span>
            }
          />
          <ul className="space-y-1 px-3 pb-4">
            {REGRAS.map((regra) => (
              <Reveal
                as="li"
                key={regra.id}
                className="flex items-start gap-3 rounded-xl px-2 py-2.5"
              >
                <span className="mt-1 flex h-4 w-7 shrink-0 items-center rounded-full bg-positive/25 p-0.5 ring-1 ring-inset ring-positive/40">
                  <span className="ml-auto h-3 w-3 rounded-full bg-positive"
                    style={{
                      boxShadow:
                        "0 0 8px 1px color-mix(in oklab, var(--color-positive) 60%, transparent)",
                    }} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-medium text-fg">{regra.titulo}</p>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-fg-faint">
                    {regra.detalhe}
                  </p>
                </div>
              </Reveal>
            ))}
          </ul>
        </Panel>

        {!banco.loja.configurada && (
          <Panel className="xl:col-span-12">
            <div className="flex flex-wrap items-center gap-3 p-5">
              <TriangleAlert
                className="h-5 w-5 shrink-0 text-caution"
                strokeWidth={2}
              />
              <p className="flex-1 text-[13px] text-fg-muted">
                Sem os dados da loja, o agente não sabe informar endereço nem
                horário e vai errar com o cliente.
              </p>
              <Link href="/configuracoes" className="btn-primary">
                Configurar loja
              </Link>
            </div>
          </Panel>
        )}

        <AgentConsole modo="cliente" className="h-[480px] xl:col-span-7" />

        <Panel className="flex flex-col xl:col-span-5 xl:h-[480px]">
          <PanelHeader
            eyebrow="Auditoria"
            title="Atividade no WhatsApp"
            action={
              banco.eventos.length > 0 ? (
                <span className="chip">{banco.eventos.length}</span>
              ) : undefined
            }
          />
          {banco.eventos.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="Nenhuma interação registrada"
              description="Cada mensagem do WhatsApp e cada resposta do agente aparecem aqui. Tudo nesta lista aconteceu de verdade."
            />
          ) : (
            <ul data-lenis-prevent className="max-h-[380px] min-h-0 flex-1 overflow-y-auto px-2 pb-2 xl:max-h-none">
              {banco.eventos.map((evento) => (
                <Reveal
                  as="li"
                  key={evento.id}
                  className="flex items-start gap-3 rounded-xl p-3"
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset",
                      evento.tipo === "erro"
                        ? "bg-caution/12 text-caution ring-caution/25"
                        : evento.tipo === "pergunta"
                          ? "bg-info/12 text-info ring-info/25"
                          : "bg-brand-500/12 text-brand-400 ring-brand-500/25",
                    )}
                  >
                    <Activity className="h-3.5 w-3.5" strokeWidth={2} />
                  </span>
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
      </div>
    </div>
  );
}
