"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  Hand,
  History,
  MessageCircle,
  MessagesSquare,
  Plus,
  Search,
  Star,
  Stethoscope,
  Undo2,
  UserPlus,
  UserRound,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal, Campo, Entrada } from "@/components/ui/modal";
import { ChipStatus } from "@/components/pedidos/status";
import { useAppState } from "@/components/providers/app-state";
import {
  abrirConversaComCliente,
  alternarMarcacao,
  assumirConversa,
  criarCliente,
  criarConversa,
  devolverAoAgente,
  mudarStatusConversa,
  reenviarMensagem,
  resolverAlerta,
  useBanco,
  useSessao,
  useWhatsappNoAr,
} from "@/lib/db/use-db";
import {
  ALERTA_LABEL,
  chaveDoCliente,
  SITUACAO_LABEL,
  type Conversa,
  type Mensagem,
  type StatusConversa,
  type VisaoLoja,
} from "@/lib/db/types";
import { fimDoTelefone, situacaoDoCliente } from "@/lib/clientes";
import { Bolha } from "./bolha";
import { Compositor } from "./compositor";
import {
  conversasAtivas,
  historicoPorCliente,
  resumoDaConversa,
  type HistoricoCliente,
} from "@/lib/conversas";
import { cn, formatBRLCents } from "@/lib/utils";

/* ------------------------------------------------------------------
   Rótulos
   ------------------------------------------------------------------ */

/**
 * Os filtros da fila.
 *
 * "Resolvidas" não está aqui de propósito: conversa resolvida sai da fila e
 * passa a viver no histórico do cliente. Fila é o que ainda dá trabalho.
 * Os nomes são curtos para caberem lado a lado sem cortar.
 */
type Filtro = "todas" | "alerta" | "aberta" | "com_atendente";

const FILTROS: { id: Filtro; label: string }[] = [
  { id: "todas", label: "Todas" },
  // Quem precisa de uma pessoa (farmacêutico, atendente, reclamação).
  { id: "alerta", label: "Chamados" },
  { id: "aberta", label: "Agente" },
  // "Equipe", e não "Comigo": numa loja com duas pessoas, metade dessas
  // conversas é da outra. O nome de quem assumiu aparece na linha.
  { id: "com_atendente", label: "Equipe" },
];

const STATUS_LABEL: Record<StatusConversa, string> = {
  aberta: "Com o agente",
  com_atendente: "Com a equipe",
  resolvida: "Resolvida",
};

/** Cor do ponto de cada estado. Só o ponto: o texto continua neutro. */
const STATUS_PONTO: Record<StatusConversa, string> = {
  aberta: "[--ponto:var(--color-fg-ghost)]",
  com_atendente: "[--ponto:var(--color-info)]",
  resolvida: "[--ponto:var(--color-positive)]",
};

function hora(em: number) {
  return new Date(em).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dataCurta(em: number) {
  return new Date(em).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

/** "hoje, 14:20", "ontem, 09:10" ou a data, que é como alguém fala de um atendimento. */
function quando(em: number, agora: number) {
  if (!agora) return dataCurta(em);
  const dia = 24 * 60 * 60 * 1000;
  const hoje = new Date(agora).setHours(0, 0, 0, 0);
  const oDia = new Date(em).setHours(0, 0, 0, 0);
  if (oDia === hoje) return `hoje, ${hora(em)}`;
  if (oDia === hoje - dia) return `ontem, ${hora(em)}`;
  return dataCurta(em);
}

/** Na lista: só a hora se foi hoje, senão o dia. */
function marcaDeTempo(em: number, agora: number) {
  if (!agora) return hora(em);
  const hoje = new Date(agora).setHours(0, 0, 0, 0);
  return em >= hoje ? hora(em) : new Date(em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function iniciais(nome: string) {
  return (
    nome
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "?"
  );
}

function Avatar({ nome, className }: { nome: string; className?: string }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-nivel-4 font-semibold text-fg-muted",
        className,
      )}
    >
      {iniciais(nome)}
    </div>
  );
}

/* ------------------------------------------------------------------
   Linhas da lista
   ------------------------------------------------------------------ */

function LinhaConversa({
  conversa,
  ativa,
  agora,
  onSelect,
}: {
  conversa: Conversa;
  ativa: boolean;
  agora: number;
  onSelect: () => void;
}) {
  const alerta = conversa.alerta;
  const estado =
    conversa.status === "com_atendente" && conversa.assumidaPor
      ? `Com ${conversa.assumidaPor.split(" ")[0]}`
      : STATUS_LABEL[conversa.status];

  return (
    <button
      onClick={onSelect}
      data-selected={ativa}
      className="selectable flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left"
    >
      <div className="relative">
        <Avatar nome={conversa.cliente} className="h-9 w-9 text-[11.5px]" />
        {alerta && (
          // Quem precisa de uma pessoa ganha um ponto âmbar no avatar e a
          // frase embaixo: a lista não fica pintada, mas não passa batido.
          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-[var(--color-surface)] bg-caution" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-fg">
            {conversa.cliente}
          </p>
          <span className="tnum shrink-0 text-[11px] text-fg-ghost">
            {marcaDeTempo(conversa.atualizadaEm, agora)}
          </span>
        </div>
        <p className="mt-0.5 line-clamp-1 text-[12.5px] text-fg-faint">
          {resumoDaConversa(conversa)}
        </p>
        <div className="mt-1.5 flex items-center gap-3">
          {alerta ? (
            <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-caution">
              <Stethoscope className="h-3 w-3" strokeWidth={2.2} />
              {ALERTA_LABEL[alerta.tipo]}
            </span>
          ) : (
            <span className={cn("estado !text-[11.5px]", STATUS_PONTO[conversa.status])}>
              {estado}
            </span>
          )}
          {conversa.canal === "interno" && (
            <span className="text-[11px] text-fg-ghost">registro interno</span>
          )}
        </div>
      </div>
    </button>
  );
}

function LinhaCliente({
  historico,
  ativo,
  agora,
  onSelect,
}: {
  historico: HistoricoCliente;
  ativo: boolean;
  agora: number;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      data-selected={ativo}
      className="selectable flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left"
    >
      <Avatar nome={historico.nome} className="h-9 w-9 text-[11.5px]" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-fg">
            {historico.nome}
          </p>
          <span className="tnum shrink-0 text-[11px] text-fg-ghost">
            {marcaDeTempo(historico.ultimaEm, agora)}
          </span>
        </div>
        <p className="mt-0.5 text-[12px] text-fg-faint">
          {historico.conversas.length}{" "}
          {historico.conversas.length === 1 ? "conversa" : "conversas"} · {historico.mensagens}{" "}
          mensagens
        </p>
        {historico.ativas > 0 && (
          <span className="estado mt-1.5 !text-[11.5px] [--ponto:var(--color-info)]">
            na fila agora
          </span>
        )}
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------
   Tela
   ------------------------------------------------------------------ */

type Aba = "fila" | "historico";

export function ConversationsWorkspace() {
  const { banco, carregado } = useBanco();
  const { usuario } = useSessao();
  const { busca } = useAppState();

  const [aba, setAba] = useState<Aba>("fila");
  const [ativaId, setAtivaId] = useState<string | null>(null);
  const [clienteAtivo, setClienteAtivo] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [buscaLocal, setBuscaLocal] = useState("");
  const [novaAberta, setNovaAberta] = useState(false);
  const [nova, setNova] = useState({ cliente: "", telefone: "" });
  // No celular só cabe uma coluna: a lista ou a conversa.
  const [abertoNoCelular, setAbertoNoCelular] = useState(false);

  const fim = useRef<HTMLDivElement>(null);
  const termo = (buscaLocal || busca).toLowerCase().trim();
  const atendente = usuario?.nome ?? "";

  // O relógio vem do estado: ler a hora durante o render é impuro e o
  // React 19 barra. Zero significa "ainda não montou".
  const [agora, setAgora] = useState(0);
  useEffect(() => {
    const id = setTimeout(() => setAgora(Date.now()), 0);
    return () => clearTimeout(id);
  }, []);

  const noAr = useWhatsappNoAr(banco.whatsapp);
  const parametros = useSearchParams();
  const pedida = parametros.get("c");

  // Veio de um aviso ("cliente precisa do farmacêutico"): abre a conversa.
  useEffect(() => {
    if (!pedida) return;
    const t = setTimeout(() => {
      setAba("fila");
      setFiltro("todas");
      setAtivaId(pedida);
      setAbertoNoCelular(true);
    }, 0);
    return () => clearTimeout(t);
  }, [pedida]);

  // Quem precisa de alguém vem primeiro; o resto, pela última mensagem.
  const naFila = useMemo(
    () =>
      conversasAtivas(banco.conversas).sort(
        (a, b) =>
          Number(Boolean(b.alerta)) - Number(Boolean(a.alerta)) ||
          (b.alerta?.em ?? 0) - (a.alerta?.em ?? 0) ||
          b.atualizadaEm - a.atualizadaEm,
      ),
    [banco.conversas],
  );

  const visiveis = useMemo(
    () =>
      naFila.filter((c) => {
        const passaFiltro =
          filtro === "todas" || (filtro === "alerta" ? Boolean(c.alerta) : c.status === filtro);
        const passaBusca =
          !termo || c.cliente.toLowerCase().includes(termo) || c.telefone.includes(termo);
        return passaFiltro && passaBusca;
      }),
    [naFila, filtro, termo],
  );

  const historicos = useMemo(() => historicoPorCliente(banco.conversas), [banco.conversas]);

  const historicosVisiveis = useMemo(
    () =>
      historicos.filter(
        (h) => !termo || h.nome.toLowerCase().includes(termo) || h.telefone.includes(termo),
      ),
    [historicos, termo],
  );

  const ativa = banco.conversas.find((c) => c.id === ativaId) ?? visiveis[0] ?? null;
  const historico =
    historicos.find((h) => h.chave === clienteAtivo) ?? historicosVisiveis[0] ?? null;

  useEffect(() => {
    if (aba !== "fila") return;
    fim.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [ativa?.mensagens.length, ativa?.id, aba]);

  /** O cliente já cadastrado com este telefone (ou nome), se houver. */
  const clienteDaNova = useMemo(() => {
    const fim8 = fimDoTelefone(nova.telefone);
    if (fim8.length === 8) {
      const porTelefone = banco.clientes.find((c) => fimDoTelefone(c.telefone) === fim8);
      if (porTelefone) return porTelefone;
    }
    const nome = nova.cliente.trim().toLowerCase();
    return nome ? (banco.clientes.find((c) => c.nome.toLowerCase() === nome) ?? null) : null;
  }, [nova, banco.clientes]);

  function abrirNova(e: React.FormEvent) {
    e.preventDefault();
    if (!nova.cliente.trim() || !nova.telefone.trim()) return;
    let criada: Conversa;
    if (clienteDaNova) {
      criada = abrirConversaComCliente(clienteDaNova, atendente);
    } else {
      // Cliente novo, cadastrado aqui: nunca escreveu, então é registro
      // interno (telefone, balcão), não mensagem de WhatsApp.
      criarCliente({ nome: nova.cliente.trim(), telefone: nova.telefone.trim(), origem: "manual" });
      criada = criarConversa(nova.cliente.trim(), nova.telefone.trim(), "interno");
    }
    setNova({ cliente: "", telefone: "" });
    setNovaAberta(false);
    setAba("fila");
    setFiltro("todas");
    setAtivaId(criada.id);
    setAbertoNoCelular(true);
  }

  /** Abre o formulário já preenchido com quem está no histórico. */
  function novaComEsteCliente(h: { nome: string; telefone: string }) {
    setNova({ cliente: h.nome, telefone: h.telefone });
    setNovaAberta(true);
  }

  function verHistoricoDe(conversa: Conversa) {
    setClienteAtivo(chaveDoCliente(conversa));
    setAba("historico");
    setAbertoNoCelular(true);
  }

  function abrirNaFila(conversa: Conversa) {
    setAtivaId(conversa.id);
    setAba("fila");
    setAbertoNoCelular(true);
  }

  const semNenhuma = carregado && banco.conversas.length === 0;
  const resolvidas = banco.conversas.length - naFila.length;
  const chamados = naFila.filter((c) => c.alerta).length;

  return (
    <div className="mx-auto max-w-[1600px]">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.025em] text-fg">Conversas</h1>
          <p className="mt-0.5 text-[13px] text-fg-muted">
            {noAr
              ? "Mensagens que chegam pelo WhatsApp da loja, ao vivo."
              : "WhatsApp desconectado agora. Mensagens novas chegam quando o bot voltar."}
          </p>
        </div>
        <button onClick={() => setNovaAberta(true)} className="btn-ghost">
          <Plus className="h-4 w-4" strokeWidth={2.2} />
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
        // Uma superfície só, dividida por linhas finas. Três caixas lado a
        // lado faziam a tela parecer um mosaico.
        <div className="panel flex h-[calc(100dvh-180px)] min-h-[520px] overflow-hidden">
          {/* Lista */}
          <aside
            className={cn(
              "flex min-h-0 w-full flex-col border-hairline lg:w-[320px] lg:shrink-0 lg:border-r",
              abertoNoCelular && "hidden lg:flex",
            )}
          >
            <div className="space-y-3 border-b border-hairline p-3">
              <div className="flex rounded-[10px] bg-nivel-2 p-0.5">
                {(
                  [
                    ["fila", "Na fila", naFila.length],
                    ["historico", "Histórico", historicos.length],
                  ] as const
                ).map(([id, rotulo, total]) => (
                  <button
                    key={id}
                    onClick={() => setAba(id)}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-[8px] px-2 py-1.5 text-[12.5px] font-medium transition-colors",
                      aba === id ? "bg-nivel-4 text-fg" : "text-fg-muted hover:text-fg",
                    )}
                  >
                    {rotulo}
                    <span className="tnum text-[11px] text-fg-ghost">{total}</span>
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-fg-ghost"
                  strokeWidth={2}
                />
                <input
                  value={buscaLocal}
                  onChange={(e) => setBuscaLocal(e.target.value)}
                  className="field !py-2 !pl-9 !text-[12.5px]"
                  placeholder={aba === "fila" ? "Buscar nome ou telefone" : "Buscar cliente"}
                />
              </div>

              {aba === "fila" && (
                <div className="flex flex-wrap gap-x-1 gap-y-1">
                  {FILTROS.map((item) => {
                    const total =
                      item.id === "todas"
                        ? naFila.length
                        : item.id === "alerta"
                          ? chamados
                          : naFila.filter((c) => c.status === item.id).length;
                    if (item.id === "alerta" && total === 0 && filtro !== "alerta") return null;
                    const ativo = filtro === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setFiltro(item.id)}
                        aria-pressed={ativo}
                        className={cn(
                          "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] font-medium transition-colors",
                          ativo ? "bg-nivel-4 text-fg" : "text-fg-muted hover:bg-nivel-2 hover:text-fg",
                          item.id === "alerta" && !ativo && "text-caution",
                        )}
                      >
                        {item.label}
                        <span className="tnum text-[11px] opacity-60">{total}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div data-lenis-prevent className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
              {aba === "fila" ? (
                <>
                  {visiveis.map((conversa) => (
                    <LinhaConversa
                      key={conversa.id}
                      conversa={conversa}
                      ativa={conversa.id === ativa?.id}
                      agora={agora}
                      onSelect={() => {
                        setAtivaId(conversa.id);
                        setAbertoNoCelular(true);
                      }}
                    />
                  ))}
                  {visiveis.length === 0 && (
                    <div className="px-4 py-10 text-center">
                      <p className="text-[12.5px] text-fg-faint">
                        {naFila.length === 0 ? "Nada na fila agora." : "Nenhuma conversa neste filtro."}
                      </p>
                      {naFila.length === 0 && resolvidas > 0 && (
                        <button
                          onClick={() => setAba("historico")}
                          className="mt-2 text-[12px] font-medium text-fg-muted underline-offset-2 hover:text-fg hover:underline"
                        >
                          Ver as {resolvidas} resolvidas no histórico
                        </button>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {historicosVisiveis.map((h) => (
                    <LinhaCliente
                      key={h.chave}
                      historico={h}
                      ativo={h.chave === historico?.chave}
                      agora={agora}
                      onSelect={() => {
                        setClienteAtivo(h.chave);
                        setAbertoNoCelular(true);
                      }}
                    />
                  ))}
                  {historicosVisiveis.length === 0 && (
                    <p className="px-4 py-10 text-center text-[12.5px] text-fg-faint">
                      Ninguém encontrado.
                    </p>
                  )}
                </>
              )}
            </div>
          </aside>

          {/* Conversa ou histórico do cliente */}
          <section
            className={cn("flex min-h-0 min-w-0 flex-1 flex-col", !abertoNoCelular && "hidden lg:flex")}
          >
            <button
              onClick={() => setAbertoNoCelular(false)}
              className="flex items-center gap-1.5 border-b border-hairline px-4 py-2.5 text-[12.5px] text-fg-muted lg:hidden"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
              Voltar para a lista
            </button>
            {aba === "fila" ? (
              ativa ? (
                <Atendimento
                  key={ativa.id}
                  conversa={ativa}
                  atendente={atendente}
                  lojaId={banco.loja.id}
                  whatsappNoAr={noAr}
                  fim={fim}
                />
              ) : (
                <EmptyState
                  icon={MessagesSquare}
                  title="Nada na fila"
                  description="Quando chegar mensagem nova, ela aparece aqui. O que já foi resolvido está no histórico."
                  className="flex-1"
                  action={
                    <button onClick={() => setAba("historico")} className="btn-ghost">
                      <History className="h-4 w-4" strokeWidth={2} />
                      Abrir histórico
                    </button>
                  }
                />
              )
            ) : historico ? (
              <DossieCliente
                historico={historico}
                agora={agora}
                onNovaConversa={() => novaComEsteCliente(historico)}
                onAbrirNaFila={abrirNaFila}
              />
            ) : (
              <EmptyState
                icon={History}
                title="Escolha um cliente"
                description="Selecione alguém na lista para ver tudo o que já foi conversado com essa pessoa."
                className="flex-1"
              />
            )}
          </section>

          {/* Quem é o cliente: só na tela larga, e só no atendimento. */}
          {aba === "fila" && ativa && (
            <aside className="hidden w-[300px] shrink-0 border-l border-hairline xl:flex xl:flex-col">
              <ClienteAoLado
                conversa={ativa}
                banco={banco}
                agora={agora}
                onVerHistorico={() => verHistoricoDe(ativa)}
              />
            </aside>
          )}
        </div>
      )}

      <Modal
        aberto={novaAberta}
        titulo="Nova conversa"
        descricao="Quem já escreveu para a loja recebe pelo WhatsApp. Quem nunca escreveu fica como registro de atendimento (telefone ou balcão)."
        onFechar={() => setNovaAberta(false)}
      >
        <form onSubmit={abrirNova} className="space-y-4">
          <Campo label="Nome do cliente">
            <Entrada
              value={nova.cliente}
              onChange={(e) => setNova({ ...nova, cliente: e.target.value })}
              placeholder="Ex: Ana Paula Ribeiro"
              list="clientes-conhecidos"
              required
              autoFocus
            />
            <datalist id="clientes-conhecidos">
              {banco.clientes.map((c) => (
                <option key={c.id} value={c.nome} />
              ))}
            </datalist>
          </Campo>
          <Campo label="Telefone com DDD" hint="É o que junta as conversas da mesma pessoa no histórico.">
            <Entrada
              value={nova.telefone}
              onChange={(e) => setNova({ ...nova, telefone: e.target.value })}
              placeholder="Ex: 27 99999-0000"
              required
            />
          </Campo>
          {(nova.cliente.trim() || nova.telefone.trim()) && (
            <div className="flex items-start gap-2.5 rounded-xl bg-nivel-2 p-3 text-[12px] leading-relaxed text-fg-muted">
              <MessageCircle
                className={cn(
                  "mt-0.5 h-4 w-4 shrink-0",
                  clienteDaNova?.primeiraMensagemEm ? "text-positive" : "text-fg-ghost",
                )}
                strokeWidth={2}
              />
              {clienteDaNova?.primeiraMensagemEm ? (
                <span>
                  <strong className="text-fg">{clienteDaNova.nome}</strong> já escreveu para a loja: o
                  que você mandar chega no WhatsApp dela.
                </span>
              ) : clienteDaNova ? (
                <span>
                  <strong className="text-fg">{clienteDaNova.nome}</strong> está cadastrado, mas nunca
                  escreveu pelo WhatsApp. A conversa fica só registrada aqui.
                </span>
              ) : (
                <span>Cliente novo: ele será cadastrado e a conversa fica registrada aqui.</span>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setNovaAberta(false)} className="btn-ghost">
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

/* ------------------------------------------------------------------
   Atendimento em andamento
   ------------------------------------------------------------------ */

function Atendimento({
  conversa,
  atendente,
  lojaId,
  whatsappNoAr,
  fim,
}: {
  conversa: Conversa;
  atendente: string;
  lojaId: string;
  whatsappNoAr: boolean;
  fim: React.RefObject<HTMLDivElement | null>;
}) {
  const comAtendente = conversa.status === "com_atendente";
  const [citando, setCitando] = useState<Mensagem | null>(null);
  const [soMarcadas, setSoMarcadas] = useState(false);
  const marcadas = conversa.mensagens.filter((m) => m.marcada).length;
  const mensagens = soMarcadas ? conversa.mensagens.filter((m) => m.marcada) : conversa.mensagens;

  function irPara(id: string) {
    setSoMarcadas(false);
    setTimeout(() => {
      const el = document.getElementById(`msg-${id}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.animate(
        [{ backgroundColor: "var(--color-nivel-4)" }, { backgroundColor: "transparent" }],
        { duration: 1400, easing: "ease-out" },
      );
    }, 50);
  }

  return (
    <>
      <header className="flex flex-wrap items-center gap-3 border-b border-hairline px-5 py-3.5">
        <Avatar nome={conversa.cliente} className="h-9 w-9 text-[11.5px]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-fg">{conversa.cliente}</p>
          <p className="tnum truncate text-[12px] text-fg-faint">
            {conversa.telefone}
            <span className="text-fg-ghost">
              {" · "}
              {conversa.canal === "whatsapp" ? "WhatsApp" : "registro interno"}
              {comAtendente && ` · com ${conversa.assumidaPor || "a equipe"}`}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {marcadas > 0 && (
            <button
              onClick={() => setSoMarcadas((v) => !v)}
              aria-pressed={soMarcadas}
              title="Mostrar só as mensagens marcadas"
              className={cn("btn-ghost !px-3 !py-1.5 !text-[12px]", soMarcadas && "!text-fg")}
            >
              <Star className={cn("h-3.5 w-3.5", soMarcadas && "fill-caution text-caution")} strokeWidth={2} />
              {marcadas}
            </button>
          )}

          {comAtendente ? (
            <button
              onClick={() => devolverAoAgente(conversa.id)}
              title="O agente volta a responder sozinho"
              className="btn-ghost !px-3 !py-1.5 !text-[12px]"
            >
              <Undo2 className="h-3.5 w-3.5" strokeWidth={2.2} />
              Devolver ao agente
            </button>
          ) : (
            <button
              onClick={() => assumirConversa(conversa.id, atendente)}
              title="O agente para de responder e você atende"
              className="btn-primary !px-3 !py-1.5 !text-[12px]"
            >
              <Hand className="h-3.5 w-3.5" strokeWidth={2.2} />
              Assumir
            </button>
          )}

          <button
            onClick={() => mudarStatusConversa(conversa.id, "resolvida")}
            title="Sai da fila e vai para o histórico do cliente"
            className="btn-ghost !px-3 !py-1.5 !text-[12px]"
          >
            <Check className="h-3.5 w-3.5" strokeWidth={2.2} />
            Resolver
          </button>
        </div>
      </header>

      {conversa.alerta && (
        <div className="flex flex-wrap items-center gap-3 border-b border-hairline bg-caution/[0.06] px-5 py-2.5">
          <Stethoscope className="h-4 w-4 shrink-0 text-caution" strokeWidth={2} />
          <p className="min-w-0 flex-1 text-[12.5px] leading-snug text-fg-muted">
            <span className="font-medium text-caution">{ALERTA_LABEL[conversa.alerta.tipo]}.</span>{" "}
            {conversa.alerta.resumo}
          </p>
          {!comAtendente && (
            <button
              onClick={() => assumirConversa(conversa.id, atendente)}
              className="btn-ghost !px-3 !py-1 !text-[12px]"
            >
              Assumir e responder
            </button>
          )}
          <button
            onClick={() => resolverAlerta(conversa.id)}
            title="Tira o destaque sem responder (a dúvida foi resolvida por outro meio)"
            className="rounded-lg px-2 py-1 text-[12px] text-fg-faint transition-colors hover:bg-nivel-3 hover:text-fg"
          >
            Já resolvi
          </button>
        </div>
      )}

      <div data-lenis-prevent className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {mensagens.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="max-w-xs text-center text-[12.5px] leading-relaxed text-fg-faint">
              {soMarcadas
                ? "Nenhuma mensagem marcada."
                : "Nenhuma mensagem nesta conversa. Escreva abaixo para registrar o atendimento."}
            </p>
          </div>
        ) : (
          mensagens.map((m) => (
            <Bolha
              key={m.id}
              mensagem={m}
              onResponder={() => setCitando(m)}
              onMarcar={() => alternarMarcacao(conversa.id, m.id)}
              onReenviar={() => reenviarMensagem(conversa.id, m.id)}
              onIrParaCitada={irPara}
            />
          ))
        )}
        <div ref={fim} />
      </div>

      <Compositor
        conversa={conversa}
        atendente={atendente}
        lojaId={lojaId}
        citando={citando}
        onCancelarCitacao={() => setCitando(null)}
        whatsappNoAr={whatsappNoAr}
      />
    </>
  );
}

/* ------------------------------------------------------------------
   Quem é o cliente (coluna da direita)
   ------------------------------------------------------------------ */

/**
 * O que quem atende precisa saber sem sair da conversa: se a pessoa já é
 * cliente, o que costuma comprar, os últimos pedidos e se tem observação.
 * Antes isso exigia ir até Clientes e procurar pelo nome.
 */
function ClienteAoLado({
  conversa,
  banco,
  agora,
  onVerHistorico,
}: {
  conversa: Conversa;
  banco: VisaoLoja;
  agora: number;
  onVerHistorico: () => void;
}) {
  const fim = fimDoTelefone(conversa.telefone);
  const cliente =
    fim.length === 8 ? banco.clientes.find((c) => fimDoTelefone(c.telefone) === fim) : undefined;
  const pedidos = banco.pedidos
    .filter((p) => fim.length === 8 && fimDoTelefone(p.telefone) === fim)
    .sort((a, b) => b.criadoEm - a.criadoEm);
  const conversas = banco.conversas.filter((c) => chaveDoCliente(c) === chaveDoCliente(conversa));
  const validos = pedidos.filter((p) => p.status !== "cancelado");
  const gasto = validos.reduce((s, p) => s + p.total, 0);

  return (
    <div data-lenis-prevent className="min-h-0 flex-1 overflow-y-auto">
      <div className="flex flex-col items-center border-b border-hairline px-5 py-6 text-center">
        <Avatar nome={conversa.cliente} className="h-14 w-14 text-[15px]" />
        <p className="mt-3 text-[14px] font-semibold text-fg">{cliente?.nome ?? conversa.cliente}</p>
        <p className="tnum text-[12px] text-fg-faint">{conversa.telefone}</p>
        {cliente ? (
          <span className="estado mt-2 !text-[11.5px]">
            {SITUACAO_LABEL[situacaoDoCliente(cliente, conversas, pedidos)]}
          </span>
        ) : (
          <button
            onClick={() =>
              criarCliente({ nome: conversa.cliente, telefone: conversa.telefone, origem: "manual" })
            }
            className="btn-ghost mt-3 !px-3 !py-1.5 !text-[12px]"
          >
            <UserPlus className="h-3.5 w-3.5" strokeWidth={2} />
            Cadastrar cliente
          </button>
        )}
      </div>

      <dl className="space-y-3 border-b border-hairline px-5 py-4 text-[12.5px]">
        <Linha rotulo="Compras" valor={validos.length ? `${validos.length} · ${formatBRLCents(gasto)}` : "Nenhuma ainda"} />
        <Linha
          rotulo="Cliente desde"
          valor={cliente ? dataCurta(cliente.criadoEm) : dataCurta(conversa.criadaEm || conversa.atualizadaEm)}
        />
        {cliente && <Linha rotulo="Campanhas" valor={cliente.consentimento ? "Autorizou" : "Não autorizou"} />}
        {cliente?.endereco && <Linha rotulo="Endereço" valor={cliente.endereco} />}
      </dl>

      {(cliente?.etiquetas.length || cliente?.observacao) && (
        <div className="space-y-2.5 border-b border-hairline px-5 py-4">
          {cliente.etiquetas.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {cliente.etiquetas.map((e) => (
                <span key={e} className="chip">
                  {e}
                </span>
              ))}
            </div>
          )}
          {cliente.observacao && (
            <p className="text-[12.5px] leading-relaxed text-fg-muted">{cliente.observacao}</p>
          )}
        </div>
      )}

      <div className="border-b border-hairline px-5 py-4">
        <p className="text-[12px] font-medium text-fg-muted">Últimos pedidos</p>
        {pedidos.length === 0 ? (
          <p className="mt-2 text-[12px] text-fg-faint">Nenhum pedido com este telefone.</p>
        ) : (
          <ul className="mt-2 space-y-2.5">
            {pedidos.slice(0, 4).map((p) => (
              <li key={p.id} className="text-[12.5px]">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-fg">
                    #{p.numero} <span className="text-fg-ghost">· {quando(p.criadoEm, agora)}</span>
                  </span>
                  <span className="tnum shrink-0 text-fg">{formatBRLCents(p.total)}</span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <span className="truncate text-[11.5px] text-fg-faint">
                    {p.itens.map((i) => i.nome).join(", ")}
                  </span>
                  <ChipStatus status={p.status} className="shrink-0 !text-[11px]" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-1 px-3 py-3">
        {conversas.length > 1 && (
          <button
            onClick={onVerHistorico}
            className="selectable flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[12.5px] text-fg-muted"
          >
            <History className="h-3.5 w-3.5" strokeWidth={2} />
            {conversas.length - 1} conversa{conversas.length - 1 === 1 ? "" : "s"} anterior
            {conversas.length - 1 === 1 ? "" : "es"}
          </button>
        )}
        {cliente && (
          <Link
            href={`/clientes?c=${cliente.id}`}
            className="selectable flex w-full items-center gap-2 rounded-lg px-2 py-2 text-[12.5px] text-fg-muted"
          >
            <UserRound className="h-3.5 w-3.5" strokeWidth={2} />
            Abrir ficha do cliente
            <ArrowUpRight className="ml-auto h-3.5 w-3.5 text-fg-ghost" strokeWidth={2} />
          </Link>
        )}
      </div>
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-fg-faint">{rotulo}</dt>
      <dd className="min-w-0 text-right text-fg">{valor}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------
   Histórico de um cliente
   ------------------------------------------------------------------ */

function DossieCliente({
  historico,
  agora,
  onNovaConversa,
  onAbrirNaFila,
}: {
  historico: HistoricoCliente;
  agora: number;
  onNovaConversa: () => void;
  onAbrirNaFila: (c: Conversa) => void;
}) {
  const [aberta, setAberta] = useState<string | null>(historico.conversas[0]?.id ?? null);

  return (
    <>
      <header className="flex flex-wrap items-center gap-3 border-b border-hairline px-5 py-3.5">
        <Avatar nome={historico.nome} className="h-9 w-9 text-[11.5px]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-fg">{historico.nome}</p>
          <p className="tnum truncate text-[12px] text-fg-faint">
            {historico.telefone}
            <span className="text-fg-ghost">
              {" · "}
              {historico.conversas.length} {historico.conversas.length === 1 ? "conversa" : "conversas"}
              {" · "}
              {historico.mensagens} mensagens
              {historico.desde ? ` · desde ${dataCurta(historico.desde)}` : ""}
            </span>
          </p>
        </div>
        <button onClick={onNovaConversa} className="btn-ghost !px-3 !py-1.5 !text-[12px]">
          <Plus className="h-3.5 w-3.5" strokeWidth={2.4} />
          Nova conversa
        </button>
      </header>

      <div data-lenis-prevent className="min-h-0 flex-1 overflow-y-auto">
        <ul className="divide-y divide-hairline">
          {historico.conversas.map((conversa) => {
            const expandida = aberta === conversa.id;
            return (
              <li key={conversa.id}>
                <button
                  onClick={() => setAberta(expandida ? null : conversa.id)}
                  aria-expanded={expandida}
                  className="selectable flex w-full items-center gap-4 px-5 py-3.5 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-fg">{quando(conversa.atualizadaEm, agora)}</p>
                    <p className="mt-0.5 line-clamp-1 text-[12px] text-fg-faint">
                      {resumoDaConversa(conversa)}
                    </p>
                  </div>
                  <span className="tnum hidden shrink-0 text-[11.5px] text-fg-ghost sm:block">
                    {conversa.mensagens.length} msg
                  </span>
                  <span className={cn("estado shrink-0 !text-[11.5px]", STATUS_PONTO[conversa.status])}>
                    {STATUS_LABEL[conversa.status]}
                  </span>
                  <ChevronDown
                    className={cn("h-4 w-4 shrink-0 text-fg-ghost transition-transform", expandida && "rotate-180")}
                    strokeWidth={2}
                  />
                </button>

                {expandida && (
                  <div className="space-y-3 bg-nivel-1 px-5 py-4">
                    {conversa.mensagens.length === 0 ? (
                      <p className="text-center text-[12px] text-fg-faint">
                        Esta conversa não tem mensagem registrada.
                      </p>
                    ) : (
                      conversa.mensagens.map((m) => <Bolha key={m.id} mensagem={m} />)
                    )}

                    {conversa.status !== "resolvida" && (
                      <div className="flex justify-end pt-1">
                        <button onClick={() => onAbrirNaFila(conversa)} className="btn-ghost !text-[12px]">
                          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
                          Abrir na fila
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
