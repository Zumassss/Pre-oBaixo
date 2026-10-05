"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Clock,
  Hand,
  History,
  MessageCircle,
  MessagesSquare,
  Plus,
  Search,
  Star,
  Stethoscope,
  Undo2,
  UserRound,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal, Campo, Entrada } from "@/components/ui/modal";
import { Reveal } from "@/components/ui/reveal";
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
  type Conversa,
  type Mensagem,
  type StatusConversa,
} from "@/lib/db/types";
import { Bolha } from "./bolha";
import { Compositor } from "./compositor";
import {
  conversasAtivas,
  historicoPorCliente,
  resumoDaConversa,
  type HistoricoCliente,
} from "@/lib/conversas";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------
   Rótulos
   ------------------------------------------------------------------ */

/**
 * Os filtros da fila.
 *
 * "Resolvidas" não está aqui de propósito: conversa resolvida sai da fila e
 * passa a viver no histórico do cliente. Fila é o que ainda dá trabalho.
 */

const FILTROS: { id: "todas" | "alerta" | "aberta" | "com_atendente"; label: string }[] = [
  { id: "todas", label: "Na fila" },
  // Quem precisa de uma pessoa (farmacêutico, atendente, reclamação).
  { id: "alerta", label: "Precisam de alguém" },
  { id: "aberta", label: "Com o agente" },
  // "Com atendente", e não "Comigo": numa loja com duas pessoas, metade
  // dessas conversas é da outra. O nome de quem assumiu aparece no cartão.
  { id: "com_atendente", label: "Com atendente" },
];

const statusMeta: Record<StatusConversa, { label: string; className: string }> = {
  aberta: { label: "Com o agente", className: "chip-warn" },
  com_atendente: { label: "Com atendente", className: "chip-hot" },
  resolvida: { label: "Resolvida", className: "chip-good" },
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

/** "hoje", "ontem" ou a data, que é como alguém fala de um atendimento. */
function quando(em: number, agora: number) {
  if (!agora) return dataCurta(em);
  const dia = 24 * 60 * 60 * 1000;
  const hoje = new Date(agora).setHours(0, 0, 0, 0);
  const oDia = new Date(em).setHours(0, 0, 0, 0);
  if (oDia === hoje) return `hoje, ${hora(em)}`;
  if (oDia === hoje - dia) return `ontem, ${hora(em)}`;
  return dataCurta(em);
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
        "flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-surface-3 to-surface font-semibold text-fg-muted ring-1 ring-inset ring-anel",
        className,
      )}
    >
      {iniciais(nome)}
    </div>
  );
}

/* ------------------------------------------------------------------
   Lista da fila
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
  const meta = statusMeta[conversa.status];
  const alerta = conversa.alerta;

  return (
    <Reveal
      as="button"
      onClick={onSelect}
      data-selected={ativa}
      className={cn(
        "selectable w-full overflow-hidden rounded-xl p-3 text-left",
        ativa && "bg-brand-500/[0.08]",
        // Laranja: precisa de uma pessoa agora. Cor e etiqueta juntas, para
        // quem não distingue cor também perceber.
        alerta && "cartao-chamado border border-caution/45 bg-caution/[0.08]",
      )}
    >
      <div className="flex items-center gap-2.5">
        <Avatar nome={conversa.cliente} className="h-8 w-8 text-[11px]" />
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
        {resumoDaConversa(conversa)}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {alerta && (
          <span className="chip !border-caution/50 !bg-caution/15 !text-caution">
            <Stethoscope className="h-3 w-3" strokeWidth={2.2} />
            {ALERTA_LABEL[alerta.tipo]}
          </span>
        )}
        <span className={cn("chip", meta.className)}>
          {conversa.status === "com_atendente" && conversa.assumidaPor
            ? conversa.assumidaPor
            : meta.label}
        </span>
        {conversa.canal === "whatsapp" && (
          <MessageCircle className="h-3 w-3 text-fg-ghost" strokeWidth={2} aria-label="WhatsApp" />
        )}
      </div>
    </Reveal>
  );
}

/* ------------------------------------------------------------------
   Lista do histórico
   ------------------------------------------------------------------ */

function ItemCliente({
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
    <Reveal
      as="button"
      onClick={onSelect}
      data-selected={ativo}
      className={cn(
        "selectable w-full overflow-hidden rounded-xl p-3 text-left",
        ativo && "bg-brand-500/[0.08]",
      )}
    >
      <div className="flex items-center gap-2.5">
        <Avatar nome={historico.nome} className="h-8 w-8 text-[11px]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-fg">
            {historico.nome}
          </p>
          <p className="tnum truncate font-mono text-[10.5px] text-fg-ghost">
            {historico.telefone}
          </p>
        </div>
        {historico.ativas > 0 && (
          <span className="chip chip-hot !px-2 !py-[2px] !text-[9.5px]">
            na fila
          </span>
        )}
      </div>

      <p className="mt-2 text-[11.5px] text-fg-faint">
        {historico.conversas.length}{" "}
        {historico.conversas.length === 1 ? "conversa" : "conversas"} ·{" "}
        {historico.mensagens} mensagens
      </p>
      <p className="mt-0.5 text-[10.5px] text-fg-ghost">
        última {quando(historico.ultimaEm, agora)}
      </p>
    </Reveal>
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
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]["id"]>("todas");
  const [buscaLocal, setBuscaLocal] = useState("");
  const [novaAberta, setNovaAberta] = useState(false);
  const [nova, setNova] = useState({ cliente: "", telefone: "" });

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
          !termo ||
          c.cliente.toLowerCase().includes(termo) ||
          c.telefone.includes(termo);
        return passaFiltro && passaBusca;
      }),
    [naFila, filtro, termo],
  );

  const historicos = useMemo(
    () => historicoPorCliente(banco.conversas),
    [banco.conversas],
  );

  const historicosVisiveis = useMemo(
    () =>
      historicos.filter(
        (h) =>
          !termo ||
          h.nome.toLowerCase().includes(termo) ||
          h.telefone.includes(termo),
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
    const fim8 = nova.telefone.replace(/\D/g, "").slice(-8);
    if (fim8.length === 8) {
      const porTelefone = banco.clientes.find((c) => c.telefone.replace(/\D/g, "").endsWith(fim8));
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
  }

  /** Abre o formulário já preenchido com quem está no histórico. */
  function novaComEsteCliente(h: HistoricoCliente) {
    setNova({ cliente: h.nome, telefone: h.telefone });
    setNovaAberta(true);
  }

  function verHistoricoDe(conversa: Conversa) {
    setClienteAtivo(chaveDoCliente(conversa));
    setAba("historico");
  }

  function abrirNaFila(conversa: Conversa) {
    setAtivaId(conversa.id);
    setAba("fila");
  }

  const semNenhuma = carregado && banco.conversas.length === 0;
  const resolvidas = banco.conversas.length - naFila.length;

  return (
    <div className="mx-auto max-w-[1560px]">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.025em] text-fg">
            Conversas
          </h1>
          <p className="mt-0.5 text-[13px] text-fg-muted">
            {noAr
              ? "Mensagens que chegam pelo WhatsApp da loja, ao vivo."
              : "WhatsApp desconectado agora. Mensagens novas chegam quando o bot voltar."}
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
          {/* Coluna da esquerda */}
          <div className="panel flex min-h-0 flex-col overflow-hidden lg:col-span-4 xl:col-span-3">
            {/* Fila ou histórico */}
            <div className="flex gap-1 border-b border-hairline p-2">
              {(
                [
                  ["fila", "Na fila", MessageCircle, naFila.length],
                  ["historico", "Histórico", History, historicos.length],
                ] as const
              ).map(([id, rotulo, Icone, total]) => (
                <button
                  key={id}
                  onClick={() => setAba(id)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[12.5px] font-medium transition-colors",
                    aba === id
                      ? "bg-brand-500/[0.14] text-fg"
                      : "text-fg-muted hover:bg-nivel-2 hover:text-fg",
                  )}
                >
                  <Icone className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                  {rotulo}
                  <span className="tnum font-mono text-[10.5px] text-fg-ghost">
                    {total}
                  </span>
                </button>
              ))}
            </div>

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
                  placeholder={
                    aba === "fila"
                      ? "Buscar na fila"
                      : "Buscar cliente no histórico"
                  }
                />
              </div>

              {aba === "fila" && (
                <div className="no-scrollbar mt-2.5 flex gap-1.5 overflow-x-auto">
                  {FILTROS.map((item) => {
                    const total =
                      item.id === "todas"
                        ? naFila.length
                        : item.id === "alerta"
                          ? naFila.filter((c) => c.alerta).length
                          : naFila.filter((c) => c.status === item.id).length;
                    if (item.id === "alerta" && total === 0 && filtro !== "alerta") return null;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setFiltro(item.id)}
                        className={cn(
                          "chip shrink-0 transition-colors",
                          filtro === item.id && "chip-hot",
                          item.id === "alerta" && "!border-caution/50 !text-caution",
                        )}
                      >
                        {item.label}
                        <span className="tnum opacity-60">{total}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div
              data-lenis-prevent
              className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2"
            >
              {aba === "fila" ? (
                <>
                  {visiveis.map((conversa) => (
                    <ItemConversa
                      key={conversa.id}
                      conversa={conversa}
                      ativa={conversa.id === ativa?.id}
                      onSelect={() => setAtivaId(conversa.id)}
                    />
                  ))}
                  {visiveis.length === 0 && (
                    <div className="px-4 py-8 text-center">
                      <p className="text-[12.5px] text-fg-faint">
                        {naFila.length === 0
                          ? "Nada na fila agora."
                          : "Nenhuma conversa neste filtro."}
                      </p>
                      {naFila.length === 0 && resolvidas > 0 && (
                        <button
                          onClick={() => setAba("historico")}
                          className="mt-2 text-[12px] font-medium text-brand-400 transition-colors hover:text-brand-300"
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
                    <ItemCliente
                      key={h.chave}
                      historico={h}
                      ativo={h.chave === historico?.chave}
                      agora={agora}
                      onSelect={() => setClienteAtivo(h.chave)}
                    />
                  ))}
                  {historicosVisiveis.length === 0 && (
                    <p className="px-4 py-8 text-center text-[12.5px] text-fg-faint">
                      Ninguém encontrado.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Coluna da direita */}
          <div className="panel flex min-h-0 flex-col overflow-hidden lg:col-span-8 xl:col-span-9">
            {aba === "fila" ? (
              ativa ? (
                <Atendimento
                  key={ativa.id}
                  conversa={ativa}
                  atendente={atendente}
                  lojaId={banco.loja.id}
                  whatsappNoAr={noAr}
                  outras={
                    historicos.find((h) => h.chave === chaveDoCliente(ativa))
                      ?.conversas.length ?? 1
                  }
                  onVerHistorico={() => verHistoricoDe(ativa)}
                  fim={fim}
                />
              ) : (
                <EmptyState
                  icon={MessagesSquare}
                  title="Nada na fila"
                  description="Quando chegar mensagem nova, ela aparece aqui. O que já foi resolvido está no histórico."
                  className="flex-1"
                  action={
                    <button
                      onClick={() => setAba("historico")}
                      className="btn-ghost"
                    >
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
          </div>
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
            <div
              className={cn(
                "flex items-start gap-2.5 rounded-xl p-3 text-[12px] leading-relaxed",
                clienteDaNova?.primeiraMensagemEm
                  ? "bg-positive/[0.1] text-fg-muted"
                  : "bg-nivel-2 text-fg-muted",
              )}
            >
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

/* ------------------------------------------------------------------
   Atendimento em andamento
   ------------------------------------------------------------------ */

function Atendimento({
  conversa,
  atendente,
  lojaId,
  whatsappNoAr,
  outras,
  onVerHistorico,
  fim,
}: {
  conversa: Conversa;
  atendente: string;
  lojaId: string;
  whatsappNoAr: boolean;
  outras: number;
  onVerHistorico: () => void;
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
        [{ backgroundColor: "color-mix(in oklab, var(--color-brand-500) 18%, transparent)" }, { backgroundColor: "transparent" }],
        { duration: 1400, easing: "ease-out" },
      );
    }, 50);
  }

  return (
    <>
      <header className="flex flex-wrap items-center gap-3 border-b border-hairline p-4">
        <Avatar nome={conversa.cliente} className="h-10 w-10 text-[12px]" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 truncate text-[14px] font-semibold text-fg">
            {conversa.cliente}
            {conversa.canal === "whatsapp" && (
              <span className="chip !px-2 !py-[2px] !text-[9.5px]">
                <MessageCircle className="h-3 w-3" strokeWidth={2} />
                WhatsApp
              </span>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <p className="tnum truncate font-mono text-[11px] text-fg-ghost">
              {conversa.telefone}
            </p>
            {outras > 1 && (
              <button
                onClick={onVerHistorico}
                className="text-[11px] font-medium text-brand-400 transition-colors hover:text-brand-300"
              >
                {outras - 1} conversa{outras - 1 === 1 ? "" : "s"} anterior
                {outras - 1 === 1 ? "" : "es"}
              </button>
            )}
          </div>
        </div>

        {marcadas > 0 && (
          <button
            onClick={() => setSoMarcadas((v) => !v)}
            aria-pressed={soMarcadas}
            className={cn(
              "btn-ghost !px-3 !py-2 !text-[12px]",
              soMarcadas && "!border-caution/50 !text-caution",
            )}
          >
            <Star className={cn("h-3.5 w-3.5", soMarcadas && "fill-caution")} strokeWidth={2} />
            Marcadas {marcadas}
          </button>
        )}

        {comAtendente ? (
          <>
            <span className="chip chip-hot">
              <UserRound className="h-3 w-3" strokeWidth={2} />
              {conversa.assumidaPor || "assumida"}
            </span>
            <button
              onClick={() => devolverAoAgente(conversa.id)}
              title="O agente volta a responder sozinho"
              className="btn-ghost !px-3.5 !py-2 !text-[12px]"
            >
              <Undo2 className="h-3.5 w-3.5" strokeWidth={2.2} />
              Devolver ao agente
            </button>
          </>
        ) : (
          <button
            onClick={() => assumirConversa(conversa.id, atendente)}
            className="btn-primary !px-3.5 !py-2 !text-[12px]"
          >
            <Hand className="h-3.5 w-3.5" strokeWidth={2.2} />
            Assumir conversa
          </button>
        )}

        <button
          onClick={() => mudarStatusConversa(conversa.id, "resolvida")}
          title="Sai da fila e vai para o histórico do cliente"
          className="btn-ghost !px-3.5 !py-2 !text-[12px]"
        >
          <Check className="h-3.5 w-3.5" strokeWidth={2.2} />
          Resolver
        </button>
      </header>

      {conversa.alerta && (
        <div className="flex flex-wrap items-center gap-3 border-b border-caution/30 bg-caution/[0.1] px-4 py-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-caution/20 text-caution">
            <Stethoscope className="h-4 w-4" strokeWidth={2.2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-semibold text-caution">{ALERTA_LABEL[conversa.alerta.tipo]}</p>
            <p className="text-[12px] leading-snug text-fg-muted">{conversa.alerta.resumo}</p>
          </div>
          {!comAtendente && (
            <button
              onClick={() => assumirConversa(conversa.id, atendente)}
              className="btn-primary !px-3 !py-1.5 !text-[12px]"
            >
              <Hand className="h-3.5 w-3.5" strokeWidth={2.2} />
              Assumir e responder
            </button>
          )}
          <button
            onClick={() => resolverAlerta(conversa.id)}
            title="Tira o destaque sem responder (a dúvida foi resolvida por outro meio)"
            className="btn-ghost !px-3 !py-1.5 !text-[12px]"
          >
            Já resolvi
          </button>
        </div>
      )}

      {comAtendente && (
        <div className="flex items-start gap-2.5 border-b border-hairline bg-brand-500/[0.05] px-4 py-2.5">
          <UserRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-400" strokeWidth={2} />
          <p className="text-[11.5px] leading-relaxed text-fg-muted">
            <span className="font-medium text-fg">{conversa.assumidaPor || "Você"}</span> está
            atendendo. O agente não responde mais por aqui.
            {conversa.canal === "whatsapp" && <span> O que você escrever chega no WhatsApp do cliente.</span>}
          </p>
        </div>
      )}

      <div data-lenis-prevent className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
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
  const [aberta, setAberta] = useState<string | null>(
    historico.conversas[0]?.id ?? null,
  );

  return (
    <>
      <header className="flex flex-wrap items-center gap-3 border-b border-hairline p-4">
        <Avatar nome={historico.nome} className="h-10 w-10 text-[12px]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-fg">
            {historico.nome}
          </p>
          <p className="tnum truncate font-mono text-[11px] text-fg-ghost">
            {historico.telefone}
          </p>
        </div>
        <button onClick={onNovaConversa} className="btn-primary !px-3.5 !py-2 !text-[12px]">
          <Plus className="h-3.5 w-3.5" strokeWidth={2.4} />
          Iniciar nova conversa
        </button>
      </header>

      <div className="grid grid-cols-3 gap-2 border-b border-hairline p-4">
        {[
          { rotulo: "Conversas", valor: String(historico.conversas.length) },
          { rotulo: "Mensagens", valor: String(historico.mensagens) },
          {
            rotulo: "Cliente desde",
            valor: historico.desde ? dataCurta(historico.desde) : "—",
          },
        ].map((item) => (
          <div key={item.rotulo} className="tile p-2.5 text-center">
            <p className="tnum font-mono text-[15px] font-semibold text-fg">
              {item.valor}
            </p>
            <p className="mt-0.5 text-[10.5px] text-fg-ghost">{item.rotulo}</p>
          </div>
        ))}
      </div>

      <div
        data-lenis-prevent
        className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3"
      >
        {historico.conversas.map((conversa) => {
          const expandida = aberta === conversa.id;
          const meta = statusMeta[conversa.status];

          return (
            <div
              key={conversa.id}
              className="overflow-hidden rounded-xl border border-hairline bg-nivel-1"
            >
              <button
                onClick={() => setAberta(expandida ? null : conversa.id)}
                className="selectable flex w-full items-center gap-3 p-3 text-left"
              >
                <Clock
                  className="h-3.5 w-3.5 shrink-0 text-fg-ghost"
                  strokeWidth={2}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-medium text-fg">
                    {quando(conversa.atualizadaEm, agora)}
                  </p>
                  <p className="mt-0.5 line-clamp-1 text-[11.5px] text-fg-faint">
                    {resumoDaConversa(conversa)}
                  </p>
                </div>
                <span className="tnum shrink-0 font-mono text-[10.5px] text-fg-ghost">
                  {conversa.mensagens.length} msg
                </span>
                <span className={cn("chip shrink-0", meta.className)}>
                  {meta.label}
                </span>
              </button>

              {expandida && (
                <div className="space-y-3 border-t border-hairline p-4">
                  {conversa.mensagens.length === 0 ? (
                    <p className="text-center text-[12px] text-fg-faint">
                      Esta conversa não tem mensagem registrada.
                    </p>
                  ) : (
                    conversa.mensagens.map((m) => <Bolha key={m.id} mensagem={m} />)
                  )}

                  {conversa.status !== "resolvida" && (
                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => onAbrirNaFila(conversa)}
                        className="btn-ghost !text-[12px]"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
                        Abrir na fila
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
