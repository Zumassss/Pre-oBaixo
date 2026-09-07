"use client";

import { useState } from "react";
import {
  Bot,
  CircleCheck,
  Clock3,
  Mic,
  Paperclip,
  Search,
  SendHorizonal,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import { conversations, type Conversation } from "@/lib/mock/crm";
import { cn } from "@/lib/utils";

const statusMeta = {
  agente: { label: "Agente", icon: Bot, className: "chip-hot" },
  humano: { label: "Humano", icon: UserRound, className: "chip-warn" },
  aguardando: { label: "Aguardando", icon: Clock3, className: "chip" },
  resolvida: { label: "Resolvida", icon: CircleCheck, className: "chip-good" },
} as const;

const filters = ["Todas", "Agente", "Humano", "Aguardando"] as const;

function ConversationRow({
  conversation,
  active,
  onSelect,
}: {
  conversation: Conversation;
  active: boolean;
  onSelect: () => void;
}) {
  const meta = statusMeta[conversation.status];

  return (
    <button
      onClick={onSelect}
      className={cn(
        "relative w-full rounded-xl border p-3 text-left transition-all duration-200",
        active
          ? "border-brand-500/30 bg-brand-500/[0.07]"
          : "border-transparent hover:bg-white/[0.035]",
      )}
    >
      {active && (
        <span className="absolute -left-px top-3 h-8 w-[2px] rounded-full bg-brand-500 shadow-[0_0_10px_1px_rgba(255,23,65,0.8)]" />
      )}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-surface-3 to-surface text-[11px] font-semibold text-fg-muted ring-1 ring-inset ring-white/10">
          {conversation.name
            .split(" ")
            .slice(0, 2)
            .map((n) => n[0])
            .join("")}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-fg">
            {conversation.name}
          </p>
          <p className="truncate text-[11px] text-fg-ghost">
            {conversation.store}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="tnum font-mono text-[10.5px] text-fg-ghost">
            {conversation.at}
          </span>
          {conversation.unread > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white">
              {conversation.unread}
            </span>
          )}
        </div>
      </div>
      <p className="mt-2 line-clamp-1 text-[11.5px] text-fg-faint">
        {conversation.lastMessage}
      </p>
      <div className="mt-2 flex items-center gap-1.5">
        <span className={cn("chip !px-2 !py-[2px] !text-[10px]", meta.className)}>
          {meta.label}
        </span>
        {conversation.tags.slice(0, 2).map((tag) => (
          <span key={tag} className="chip !px-2 !py-[2px] !text-[10px]">
            {tag}
          </span>
        ))}
      </div>
    </button>
  );
}

function MessageBubble({
  from,
  text,
  at,
}: {
  from: "cliente" | "agente" | "humano";
  text: string;
  at: string;
}) {
  const isInbound = from === "cliente";

  return (
    <div className={cn("flex", isInbound ? "justify-start" : "justify-end")}>
      <div className={cn("max-w-[76%]", isInbound ? "" : "text-right")}>
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2.5 text-[13px] leading-[1.5]",
            isInbound
              ? "rounded-tl-md bg-white/[0.055] text-fg ring-1 ring-inset ring-white/[0.07]"
              : from === "agente"
                ? "rounded-tr-md bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-[0_8px_28px_-10px_rgba(255,23,65,0.7)]"
                : "rounded-tr-md bg-surface-3 text-fg ring-1 ring-inset ring-white/10",
          )}
        >
          {text}
        </div>
        <div
          className={cn(
            "mt-1 flex items-center gap-1.5 px-1",
            isInbound ? "" : "justify-end",
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
              farmacêutica
            </span>
          )}
          <span className="tnum font-mono text-[10px] text-fg-ghost">{at}</span>
        </div>
      </div>
    </div>
  );
}

export function ConversationsWorkspace() {
  const [activeId, setActiveId] = useState(conversations[0].id);
  const [filter, setFilter] = useState<(typeof filters)[number]>("Todas");

  const visible = conversations.filter((c) =>
    filter === "Todas"
      ? true
      : filter === "Agente"
        ? c.status === "agente"
        : filter === "Humano"
          ? c.status === "humano"
          : c.status === "aguardando",
  );

  const active = conversations.find((c) => c.id === activeId) ?? conversations[0];

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
              className="field !py-2 !pl-9.5 !text-[12.5px]"
              placeholder="Buscar conversa…"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {filters.map((item) => (
              <button
                key={item}
                onClick={() => setFilter(item)}
                className={cn(
                  "chip transition-colors",
                  filter === item && "chip-hot",
                )}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 space-y-1 overflow-y-auto p-2">
          {visible.map((conversation) => (
            <ConversationRow
              key={conversation.id}
              conversation={conversation}
              active={conversation.id === activeId}
              onSelect={() => setActiveId(conversation.id)}
            />
          ))}
          {visible.length === 0 && (
            <p className="p-6 text-center text-[12.5px] text-fg-ghost">
              Nenhuma conversa neste filtro.
            </p>
          )}
        </div>
      </div>

      {/* Conversa */}
      <div className="panel flex flex-col overflow-hidden lg:col-span-8 xl:col-span-6">
        <header className="flex items-center gap-3 border-b border-hairline p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-surface-3 to-surface text-[12px] font-semibold text-fg-muted ring-1 ring-inset ring-white/10">
            {active.name
              .split(" ")
              .slice(0, 2)
              .map((n) => n[0])
              .join("")}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold text-fg">
              {active.name}
            </p>
            <p className="tnum truncate font-mono text-[11px] text-fg-ghost">
              {active.phone} · {active.store}
            </p>
          </div>
          <button className="btn-ghost !px-3.5 !py-2 !text-[12px]">
            <UserRound className="h-3.5 w-3.5" strokeWidth={2} />
            Assumir
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {active.messages.map((message) => (
            <MessageBubble
              key={message.id}
              from={message.from}
              text={message.text}
              at={message.at}
            />
          ))}
        </div>

        <div className="border-t border-hairline p-3">
          <div className="flex items-center gap-2 rounded-full border border-hairline bg-white/[0.03] px-2 py-1.5">
            <button className="flex h-8 w-8 items-center justify-center rounded-full text-fg-faint transition-colors hover:bg-white/[0.07] hover:text-fg">
              <Paperclip className="h-4 w-4" strokeWidth={1.9} />
            </button>
            <input
              className="min-w-0 flex-1 bg-transparent px-1 py-1.5 text-[13px] text-fg outline-none placeholder:text-fg-ghost"
              placeholder="Escreva para assumir a conversa…"
            />
            <button className="flex h-8 w-8 items-center justify-center rounded-full text-fg-faint transition-colors hover:bg-white/[0.07] hover:text-fg">
              <Mic className="h-4 w-4" strokeWidth={1.9} />
            </button>
            <button className="btn-primary !h-8 !w-8 !p-0">
              <SendHorizonal className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>

      {/* Contexto do cliente */}
      <div className="hidden flex-col gap-4 xl:col-span-3 xl:flex">
        <div className="panel p-5">
          <p className="eyebrow mb-3">Contexto do cliente</p>
          <dl className="space-y-2.5 text-[12.5px]">
            {[
              ["Segmento", "Alta recorrência"],
              ["Pedidos", "34"],
              ["Última compra", "hoje"],
              ["Unidade preferida", active.store],
              ["Consentimento LGPD", "registrado"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-3">
                <dt className="shrink-0 text-fg-ghost">{label}</dt>
                <dd className="truncate text-right font-medium text-fg-muted">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="panel p-5">
          <p className="eyebrow mb-3">Sugestão do agente</p>
          <p className="text-[12.5px] leading-relaxed text-fg-muted">
            Cliente compra Losartana a cada 30 dias. O ciclo atual encerra em 2
            dias — oferecer reserva com cupom de recompra tem 68% de conversão
            neste segmento.
          </p>
          <button className="btn-primary mt-4 w-full">Aplicar sugestão</button>
        </div>

        <div className="panel p-5">
          <div className="mb-2 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-caution" strokeWidth={2} />
            <p className="text-[12.5px] font-semibold text-fg">Limite do agente</p>
          </div>
          <p className="text-[12px] leading-relaxed text-fg-faint">
            Perguntas sobre interação medicamentosa, dose ou indicação clínica
            são transferidas automaticamente ao farmacêutico responsável. O
            agente nunca responde por conta própria.
          </p>
        </div>
      </div>
    </div>
  );
}
