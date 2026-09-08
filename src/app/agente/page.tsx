"use client";

import { Activity, ShieldCheck, Sparkles, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { PageHeader, Panel, PanelHeader } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/empty-state";
import { Reveal } from "@/components/ui/reveal";
import { useBanco } from "@/lib/db/use-db";
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

export default function AgentePage() {
  const { banco, carregado } = useBanco();

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
                        : "bg-white/[0.05] text-fg-ghost ring-white/10",
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
                  <span className="ml-auto h-3 w-3 rounded-full bg-positive shadow-[0_0_8px_1px_rgba(24,209,127,0.6)]" />
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

        <Panel className="xl:col-span-12">
          <PanelHeader
            eyebrow="Auditoria"
            title="Registro de conversas com o agente"
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
              description="Converse com o agente no painel para ver o registro aqui. Tudo que aparece nesta lista aconteceu de verdade."
              action={
                <Link href="/" className="btn-primary">
                  Ir para o painel
                </Link>
              }
            />
          ) : (
            <ul data-lenis-prevent className="max-h-[380px] overflow-y-auto px-2 pb-2">
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
