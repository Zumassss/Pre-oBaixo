"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Check,
  MessagesSquare,
  Plus,
  Search,
  SendHorizonal,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal, Campo, Entrada } from "@/components/ui/modal";
import { Reveal } from "@/components/ui/reveal";
import { useAppState } from "@/components/providers/app-state";
import {
  adicionarMensagem,
  criarConversa,
  mudarStatusConversa,
  useBanco,
} from "@/lib/db/use-db";
import type { Conversa, StatusConversa } from "@/lib/db/types";
import { cn } from "@/lib/utils";

const FILTROS: { id: "todas" | StatusConversa; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "aberta", label: "Aguardando" },
  { id: "com_atendente", label: "Com atendente" },
  { id: "resolvida", label: "Resolvidas" },
];

const statusMeta: Record<StatusConversa, { label: string; className: string }> = {
  aberta: { label: "Aguardando", className: "chip-warn" },
  com_atendente: { label: "Com atendente", className: "chip-hot" },
  resolvida: { label: "Resolvida", className: "chip-good" },
};

function hora(em: number) {
  return new Date(em).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function iniciais(nome: string) {
  return nome
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

/* ------------------------------------------------------------------
   Lista
   ------------------------------------------------------------------ */

function ItemConversa({
  conversa,
  ativa,
  onSelect,
}: {
  conversa: Conversa;
  ativa: boolean;
  onSelect: () => void;
}) {
  const ultima = conversa.mensagens[conversa.mensagens.length - 1];
  const meta = statusMeta[conversa.status];

  return (
    <Reveal
      as="button"
      onClick={onSelect}
      data-selected={ativa}
      className={cn(
        "selectable w-full overflow-hidden rounded-xl p-3 text-left",
        ativa && "bg-brand-500/[0.08]",
      )}
    >
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-surface-3 to-surface text-[11px] font-semibold text-fg-muted ring-1 ring-inset ring-white/10">
          {iniciais(conversa.cliente)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-fg">
            {conversa.cliente}
          </p>
          <p className="tnum truncate font-mono text-[10.5px] text-fg-ghost">
            {conversa.telefone}
          </p>
        </div>
        <span className="tnum shrink-0 font-mono text-[10.5px] text-fg-ghost">
          {hora(conversa.atualizadaEm)}
        </span>
      </div>

      <p className="mt-2 line-clamp-1 text-[11.5px] text-fg-faint">
        {ultima ? ultima.texto : "Sem mensagens ainda"}
      </p>

      <span className={cn("chip mt-2", meta.className)}>{meta.label}</span>
    </Reveal>
  );
}

/* ------------------------------------------------------------------
   Mensagem
   ------------------------------------------------------------------ */

function Bolha({
  origem,
  texto,
  em,
}: {
  origem: Conversa["mensagens"][number]["origem"];
  texto: string;
  em: number;
}) {
  const entrada = origem === "cliente";

  return (
    <div
      className={cn("flex", entrada ? "justify-start" : "justify-end")}
      style={{ animation: "rise 0.3s cubic-bezier(0.16,1,0.3,1) both" }}
    >
      <div className={cn("max-w-[78%]", entrada ? "" : "text-right")}>
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2.5 text-[13px] leading-[1.5]",
            entrada
              ? "rounded-tl-md bg-white/[0.055] text-fg ring-1 ring-inset ring-white/[0.07]"
              : origem === "agente"
                ? "rounded-tr-md bg-gradient-to-br from-brand-600 to-brand-800 text-white"
                : "rounded-tr-md bg-surface-3 text-fg ring-1 ring-inset ring-white/10",
          )}
        >
          {texto}
        </div>
        <div
          className={cn(
            "mt-1 flex items-center gap-1.5 px-1",
            entrada ? "" : "justify-end",
          )}
        >
          {origem === "agente" && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-brand-400">
              <Bot className="h-3 w-3" strokeWidth={2} />
              agente
            </span>
          )}
          {origem === "atendente" && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-caution">
              <UserRound className="h-3 w-3" strokeWidth={2} />
              você
            </span>
          )}
          <span className="tnum font-mono text-[10px] text-fg-ghost">{hora(em)}</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   Tela
   ------------------------------------------------------------------ */

export function ConversationsWorkspace() {
  const { banco, carregado } = useBanco();
  const { busca } = useAppState();

  const [ativaId, setAtivaId] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]["id"]>("todas");
  const [buscaLocal, setBuscaLocal] = useState("");
  const [rascunho, setRascunho] = useState("");
  const [novaAberta, setNovaAberta] = useState(false);
  const [nova, setNova] = useState({ cliente: "", telefone: "" });

  const fim = useRef<HTMLDivElement>(null);
  const termo = (buscaLocal || busca).toLowerCase().trim();

  const visiveis = useMemo(
    () =>
      banco.conversas.filter((c) => {
        const passaFiltro = filtro === "todas" || c.status === filtro;
        const passaBusca =
          !termo ||
          c.cliente.toLowerCase().includes(termo) ||
          c.telefone.includes(termo);
        return passaFiltro && passaBusca;
      }),
    [banco.conversas, filtro, termo],
  );

  const ativa =
    banco.conversas.find((c) => c.id === ativaId) ?? visiveis[0] ?? null;

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [ativa?.mensagens.length, ativa?.id]);

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!ativa || !rascunho.trim()) return;
    adicionarMensagem(ativa.id, "atendente", rascunho.trim());
    setRascunho("");
  }

  function abrirNova(e: React.FormEvent) {
    e.preventDefault();
    if (!nova.cliente.trim() || !nova.telefone.trim()) return;
    const criada = criarConversa(nova.cliente.trim(), nova.telefone.trim());
    setAtivaId(criada.id);
    setNova({ cliente: "", telefone: "" });
    setNovaAberta(false);
  }

  const semNenhuma = carregado && banco.conversas.length === 0;

  return (
    <div className="mx-auto max-w-[1560px]">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.025em] text-fg">
            Conversas
          </h1>
          <p className="mt-0.5 text-[13px] text-fg-muted">
            {banco.whatsappConectado
              ? "Mensagens que chegam pelo WhatsApp da loja."
              : "WhatsApp não conectado. Você pode registrar conversas manualmente."}
          </p>
        </div>
        <button onClick={() => setNovaAberta(true)} className="btn-primary">
          <Plus className="h-4 w-4" strokeWidth={2.4} />
          Nova conversa
        </button>
      </div>

      {semNenhuma ? (
        <div className="panel">
          <EmptyState
            icon={MessagesSquare}
            title="Nenhuma conversa ainda"
            description="Quando o WhatsApp estiver conectado, as mensagens dos clientes aparecem aqui. Até lá, registre uma conversa manualmente para testar o atendimento."
            action={
              <button onClick={() => setNovaAberta(true)} className="btn-primary">
                <Plus className="h-4 w-4" strokeWidth={2.4} />
                Registrar conversa
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid h-[calc(100vh-190px)] grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Lista */}
          <div className="panel flex min-h-0 flex-col overflow-hidden lg:col-span-4 xl:col-span-3">
            <div className="border-b border-hairline p-3">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3.5 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-fg-ghost"
                  strokeWidth={2}
                />
                <input
                  value={buscaLocal}
                  onChange={(e) => setBuscaLocal(e.target.value)}
                  className="field !py-2 !pl-9.5 !text-[12.5px]"
                  placeholder="Buscar por nome ou telefone"
                />
              </div>
              <div className="no-scrollbar mt-2.5 flex gap-1.5 overflow-x-auto">
                {FILTROS.map((item) => {
                  const total =
                    item.id === "todas"
                      ? banco.conversas.length
                      : banco.conversas.filter((c) => c.status === item.id).length;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setFiltro(item.id)}
                      className={cn(
                        "chip shrink-0 transition-colors",
                        filtro === item.id && "chip-hot",
                      )}
                    >
                      {item.label}
                      <span className="tnum opacity-60">{total}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              data-lenis-prevent
              className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2"
            >
              {visiveis.map((conversa) => (
                <ItemConversa
                  key={conversa.id}
                  conversa={conversa}
                  ativa={conversa.id === ativa?.id}
                  onSelect={() => setAtivaId(conversa.id)}
                />
              ))}
              {visiveis.length === 0 && (
                <p className="px-4 py-8 text-center text-[12.5px] text-fg-ghost">
                  Nenhuma conversa neste filtro.
                </p>
              )}
            </div>
          </div>

          {/* Conversa aberta */}
          <div className="panel flex min-h-0 flex-col overflow-hidden lg:col-span-8 xl:col-span-9">
            {ativa ? (
              <>
                <header className="flex flex-wrap items-center gap-3 border-b border-hairline p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-surface-3 to-surface text-[12px] font-semibold text-fg-muted ring-1 ring-inset ring-white/10">
                    {iniciais(ativa.cliente)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-fg">
                      {ativa.cliente}
                    </p>
                    <p className="tnum truncate font-mono text-[11px] text-fg-ghost">
                      {ativa.telefone}
                    </p>
                  </div>

                  <span className={cn("chip", statusMeta[ativa.status].className)}>
                    {statusMeta[ativa.status].label}
                  </span>

                  {ativa.status !== "resolvida" ? (
                    <button
                      onClick={() => mudarStatusConversa(ativa.id, "resolvida")}
                      className="btn-ghost !px-3.5 !py-2 !text-[12px]"
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={2.2} />
                      Resolver
                    </button>
                  ) : (
                    <button
                      onClick={() => mudarStatusConversa(ativa.id, "aberta")}
                      className="btn-ghost !px-3.5 !py-2 !text-[12px]"
                    >
                      Reabrir
                    </button>
                  )}
                </header>

                <div
                  data-lenis-prevent
                  className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5"
                >
                  {ativa.mensagens.length === 0 ? (
                    <div className="flex h-full items-center justify-center">
                      <p className="max-w-xs text-center text-[12.5px] leading-relaxed text-fg-ghost">
                        Nenhuma mensagem nesta conversa. Escreva abaixo para
                        registrar o atendimento.
                      </p>
                    </div>
                  ) : (
                    ativa.mensagens.map((m) => (
                      <Bolha
                        key={m.id}
                        origem={m.origem}
                        texto={m.texto}
                        em={m.em}
                      />
                    ))
                  )}
                  <div ref={fim} />
                </div>

                <div className="border-t border-hairline p-3">
                  <div className="mb-2 flex items-center gap-2 px-1">
                    <ShieldAlert
                      className="h-3.5 w-3.5 shrink-0 text-fg-ghost"
                      strokeWidth={2}
                    />
                    <p className="text-[11px] text-fg-ghost">
                      Dúvida sobre dose, uso ou interação vai para o farmacêutico.
                    </p>
                  </div>
                  <form
                    onSubmit={enviar}
                    className="flex items-center gap-2 rounded-full border border-hairline bg-white/[0.035] px-2 py-1.5 transition-colors focus-within:border-brand-500/45"
                  >
                    <input
                      value={rascunho}
                      onChange={(e) => setRascunho(e.target.value)}
                      className="min-w-0 flex-1 bg-transparent px-2.5 py-1.5 text-[13px] text-fg outline-none placeholder:text-fg-ghost"
                      placeholder="Escreva sua resposta"
                    />
                    <button
                      type="submit"
                      disabled={!rascunho.trim()}
                      aria-label="Enviar"
                      className="btn-primary !h-8 !w-8 !p-0"
                    >
                      <SendHorizonal className="h-4 w-4" strokeWidth={2} />
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <EmptyState
                icon={MessagesSquare}
                title="Escolha uma conversa"
                description="Selecione alguém na lista ao lado para ver o histórico."
                className="flex-1"
              />
            )}
          </div>
        </div>
      )}

      <Modal
        aberto={novaAberta}
        titulo="Nova conversa"
        descricao="Registre um atendimento que aconteceu por telefone ou no balcão."
        onFechar={() => setNovaAberta(false)}
      >
        <form onSubmit={abrirNova} className="space-y-4">
          <Campo label="Nome do cliente">
            <Entrada
              value={nova.cliente}
              onChange={(e) => setNova({ ...nova, cliente: e.target.value })}
              placeholder="Ex: Ana Paula Ribeiro"
              required
              autoFocus
            />
          </Campo>
          <Campo label="Telefone com DDD">
            <Entrada
              value={nova.telefone}
              onChange={(e) => setNova({ ...nova, telefone: e.target.value })}
              placeholder="Ex: 27 99999-0000"
              required
            />
          </Campo>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setNovaAberta(false)}
              className="btn-ghost"
            >
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              Abrir conversa
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
