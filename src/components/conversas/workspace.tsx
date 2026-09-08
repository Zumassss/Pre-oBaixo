"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  CircleCheck,
  Clock3,
  Paperclip,
  Search,
  SendHorizonal,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import {
  conversations,
  type Conversation,
  type ConversationStatus,
  type Message,
} from "@/lib/mock/crm";
import { Reveal } from "@/components/ui/reveal";
import { useAppState } from "@/components/providers/app-state";
import { cn } from "@/lib/utils";

const statusMeta = {
  agente: { label: "Agente", icon: Bot, className: "chip-hot" },
  humano: { label: "Humano", icon: UserRound, className: "chip-warn" },
  aguardando: { label: "Aguardando", icon: Clock3, className: "chip" },
  resolvida: { label: "Resolvida", icon: CircleCheck, className: "chip-good" },
} as const;

const filtros = ["Todas", "Agente", "Humano", "Aguardando"] as const;
type Filtro = (typeof filtros)[number];

const mapaFiltro: Record<Exclude<Filtro, "Todas">, ConversationStatus> = {
  Agente: "agente",
  Humano: "humano",
  Aguardando: "aguardando",
};

function relogioAgora() {
  return new Date().toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ConversationRow({
  conversa,
  ativa,
  onSelect,
}: {
  conversa: Conversation;
  ativa: boolean;
  onSelect: () => void;
}) {
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
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-surface-3 to-surface text-[11px] font-semibold text-fg-muted ring-1 ring-inset ring-white/10">
          {conversa.name
            .split(" ")
            .slice(0, 2)
            .map((n) => n[0])
            .join("")}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-fg">{conversa.name}</p>
          <p className="truncate text-[11px] text-fg-ghost">{conversa.store}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="tnum font-mono text-[10.5px] text-fg-ghost">
            {conversa.at}
          </span>
          {conversa.unread > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white">
              {conversa.unread}
            </span>
          )}
        </div>
      </div>
      <p className="mt-2 line-clamp-1 text-[11.5px] text-fg-faint">
        {conversa.lastMessage}
      </p>
      <div className="mt-2 flex items-center gap-1.5">
        <span className={cn("chip", meta.className)}>{meta.label}</span>
        {conversa.tags.slice(0, 2).map((tag) => (
          <span key={tag} className="chip">
            {tag}
          </span>
        ))}
      </div>
    </Reveal>
  );
}

function MessageBubble({ from, text, at }: Message) {
  const entrada = from === "cliente";

  return (
    <div
      className={cn("flex", entrada ? "justify-start" : "justify-end")}
      style={{ animation: "rise 0.35s cubic-bezier(0.16,1,0.3,1) both" }}
    >
      <div className={cn("max-w-[76%]", entrada ? "" : "text-right")}>
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2.5 text-[13px] leading-[1.5]",
            entrada
              ? "rounded-tl-md bg-white/[0.055] text-fg ring-1 ring-inset ring-white/[0.07]"
              : from === "agente"
                ? "rounded-tr-md bg-gradient-to-br from-brand-600 to-brand-800 text-white"
                : "rounded-tr-md bg-surface-3 text-fg ring-1 ring-inset ring-white/10",
          )}
        >
          {text}
        </div>
        <div
          className={cn(
            "mt-1 flex items-center gap-1.5 px-1",
            entrada ? "" : "justify-end",
          )}
        >
          {from === "agente" && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-brand-400">
              <Bot className="h-3 w-3" strokeWidth={2} />
              agente
            </span>
          )}
          {from === "humano" && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-caution">
              <UserRound className="h-3 w-3" strokeWidth={2} />
              você
            </span>
          )}
          <span className="tnum font-mono text-[10px] text-fg-ghost">{at}</span>
        </div>
      </div>
    </div>
  );
}

export function ConversationsWorkspace() {
  const { busca } = useAppState();
  const [ativaId, setAtivaId] = useState(conversations[0].id);
  const [filtro, setFiltro] = useState<Filtro>("Todas");
  const [rascunho, setRascunho] = useState("");
  const [buscaLocal, setBuscaLocal] = useState("");

  // Mensagens que você envia ficam aqui, por conversa.
  const [enviadas, setEnviadas] = useState<Record<string, Message[]>>({});
  const [assumidas, setAssumidas] = useState<Record<string, boolean>>({});
  const fim = useRef<HTMLDivElement>(null);

  const termo = (buscaLocal || busca).toLowerCase().trim();

  const visiveis = useMemo(
    () =>
      conversations.filter((c) => {
        const passaFiltro =
          filtro === "Todas" ? true : c.status === mapaFiltro[filtro];
        const passaBusca =
          !termo ||
          c.name.toLowerCase().includes(termo) ||
          c.lastMessage.toLowerCase().includes(termo) ||
          c.tags.some((t) => t.includes(termo));
        return passaFiltro && passaBusca;
      }),
    [filtro, termo],
  );

  const ativa =
    conversations.find((c) => c.id === ativaId) ?? visiveis[0] ?? conversations[0];

  const mensagens = useMemo(
    () => [...ativa.messages, ...(enviadas[ativa.id] ?? [])],
    [ativa, enviadas],
  );

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensagens.length]);

  function enviar() {
    const texto = rascunho.trim();
    if (!texto) return;
    setEnviadas((atual) => ({
      ...atual,
      [ativa.id]: [
        ...(atual[ativa.id] ?? []),
        {
          id: `m-${Date.now()}`,
          from: "humano",
          text: texto,
          at: relogioAgora(),
        },
      ],
    }));
    setAssumidas((a) => ({ ...a, [ativa.id]: true }));
    setRascunho("");
  }

  const assumida = assumidas[ativa.id] ?? ativa.status === "humano";

  return (
    <div className="mx-auto grid h-[calc(100vh-120px)] max-w-[1560px] grid-cols-1 gap-4 lg:grid-cols-12">
      {/* Lista */}
      <div className="panel flex flex-col overflow-hidden lg:col-span-4 xl:col-span-3">
        <div className="border-b border-hairline p-4">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-fg-ghost"
              strokeWidth={2}
            />
            <input
              value={buscaLocal}
              onChange={(e) => setBuscaLocal(e.target.value)}
              className="field !py-2 !pl-9.5 !text-[12.5px]"
              placeholder="Buscar conversa"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {filtros.map((item) => (
              <button
                key={item}
                onClick={() => setFiltro(item)}
                className={cn("chip transition-colors", filtro === item && "chip-hot")}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 space-y-1 overflow-y-auto p-2">
          {visiveis.map((conversa) => (
            <ConversationRow
              key={conversa.id}
              conversa={conversa}
              ativa={conversa.id === ativa.id}
              onSelect={() => setAtivaId(conversa.id)}
            />
          ))}
          {visiveis.length === 0 && (
            <p className="p-6 text-center text-[12.5px] text-fg-ghost">
              Nenhuma conversa encontrada.
            </p>
          )}
        </div>
      </div>

      {/* Conversa */}
      <div className="panel flex flex-col overflow-hidden lg:col-span-8 xl:col-span-6">
        <header className="flex items-center gap-3 border-b border-hairline p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-surface-3 to-surface text-[12px] font-semibold text-fg-muted ring-1 ring-inset ring-white/10">
            {ativa.name
              .split(" ")
              .slice(0, 2)
              .map((n) => n[0])
              .join("")}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold text-fg">{ativa.name}</p>
            <p className="tnum truncate font-mono text-[11px] text-fg-ghost">
              {ativa.phone}, {ativa.store}
            </p>
          </div>
          <button
            onClick={() => setAssumidas((a) => ({ ...a, [ativa.id]: !assumida }))}
            data-active={assumida}
            className="btn-ghost !px-3.5 !py-2 !text-[12px]"
          >
            <UserRound className="h-3.5 w-3.5" strokeWidth={2} />
            {assumida ? "Você assumiu" : "Assumir"}
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {mensagens.map((m) => (
            <MessageBubble key={m.id} {...m} />
          ))}
          <div ref={fim} />
        </div>

        <div className="border-t border-hairline p-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              enviar();
            }}
            className="flex items-center gap-2 rounded-full border border-hairline bg-white/[0.03] px-2 py-1.5 transition-colors focus-within:border-brand-500/45"
          >
            <button
              type="button"
              aria-label="Anexar"
              className="flex h-8 w-8 items-center justify-center rounded-full text-fg-faint transition-colors hover:bg-white/[0.07] hover:text-fg"
            >
              <Paperclip className="h-4 w-4" strokeWidth={1.9} />
            </button>
            <input
              value={rascunho}
              onChange={(e) => setRascunho(e.target.value)}
              className="min-w-0 flex-1 bg-transparent px-1 py-1.5 text-[13px] text-fg outline-none placeholder:text-fg-ghost"
              placeholder="Escreva para assumir a conversa"
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
      </div>

      {/* Contexto */}
      <div className="hidden flex-col gap-4 xl:col-span-3 xl:flex">
        <Reveal className="panel p-5">
          <p className="eyebrow mb-3">Contexto do cliente</p>
          <dl className="space-y-2.5 text-[12.5px]">
            {[
              ["Segmento", "Alta recorrência"],
              ["Pedidos", "34"],
              ["Última compra", "hoje"],
              ["Unidade", ativa.store],
              ["Consentimento", "registrado"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-3">
                <dt className="shrink-0 text-fg-ghost">{label}</dt>
                <dd className="truncate text-right font-medium text-fg-muted">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </Reveal>

        <Reveal className="panel p-5">
          <p className="eyebrow mb-3">Sugestão do agente</p>
          <p className="text-[12.5px] leading-relaxed text-fg-muted">
            Cliente compra Losartana a cada 30 dias e o ciclo encerra em 2 dias.
            Oferecer reserva com cupom converte 68% nesse segmento.
          </p>
          <button
            onClick={() => setRascunho("Posso reservar sua Losartana com 10% de desconto?")}
            className="btn-primary mt-4 w-full"
          >
            Usar sugestão
          </button>
        </Reveal>

        <Reveal className="panel p-5">
          <div className="mb-2 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-caution" strokeWidth={2} />
            <p className="text-[12.5px] font-semibold text-fg">Limite do agente</p>
          </div>
          <p className="text-[12px] leading-relaxed text-fg-faint">
            Dúvida sobre dose, uso ou interação vai direto para o farmacêutico. O
            agente não responde por conta própria.
          </p>
        </Reveal>
      </div>
    </div>
  );
}
