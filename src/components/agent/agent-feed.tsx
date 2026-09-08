"use client";

import {
  AlertTriangle,
  ArrowRightLeft,
  BookOpenCheck,
  MessageCircle,
  Megaphone,
  PackageSearch,
  RefreshCw,
  UserRoundPlus,
  type LucideIcon,
} from "lucide-react";
import {
  kindLabel,
  kindTone,
  type AgentEvent,
  type AgentEventKind,
} from "@/lib/mock/agent";
import { useAgentStream } from "@/hooks/use-agent-stream";
import { Reveal } from "@/components/ui/reveal";
import { cn } from "@/lib/utils";

const kindIcon: Record<AgentEventKind, LucideIcon> = {
  atendimento: MessageCircle,
  estoque: PackageSearch,
  promocao: Megaphone,
  followup: RefreshCw,
  orientacao: BookOpenCheck,
  crm: UserRoundPlus,
  handoff: ArrowRightLeft,
  alerta: AlertTriangle,
};

const toneClasses = {
  brand: "bg-brand-500/12 text-brand-400 ring-brand-500/25",
  good: "bg-positive/12 text-positive ring-positive/25",
  warn: "bg-caution/12 text-caution ring-caution/25",
  info: "bg-info/12 text-info ring-info/25",
} as const;

function relogio(at: number) {
  return new Date(at).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Uma linha do fluxo.
 *
 * A entrada é uma animação CSS de 350ms, não uma animação de layout do
 * framer: o item novo entra sem obrigar a lista inteira a recalcular
 * posição a cada quadro, que era o que engasgava a rolagem.
 */
function FeedRow({ event, novo }: { event: AgentEvent; novo: boolean }) {
  const Icon = kindIcon[event.kind];
  const tone = kindTone[event.kind];

  return (
    <Reveal
      as="li"
      className={cn(
        "flex gap-3 rounded-xl border p-3",
        novo ? "border-brand-500/25 bg-brand-500/[0.05]" : "border-transparent",
      )}
      style={{ animation: "rise 0.35s cubic-bezier(0.16,1,0.3,1) both" }}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset",
          toneClasses[tone],
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={1.9} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="truncate text-[12.5px] font-medium text-fg">{event.title}</p>
          <span className="tnum ml-auto shrink-0 font-mono text-[10.5px] text-fg-ghost">
            {relogio(event.at)}
          </span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-[1.45] text-fg-faint">
          {event.detail}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="chip !px-2 !py-[2px] !text-[10px]">
            {kindLabel[event.kind]}
          </span>
          <span className="text-[10.5px] text-fg-ghost">{event.store}</span>
          <span className="tnum font-mono text-[10.5px] text-fg-ghost">
            {event.latencyMs}ms
          </span>
        </div>
      </div>
    </Reveal>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3 p-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-3">
          <div className="h-8 w-8 shrink-0 rounded-lg bg-white/[0.05]" />
          <div className="flex-1 space-y-2 py-1">
            <div
              className="h-2.5 w-2/3 rounded bg-white/[0.05]"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.1), rgba(255,255,255,0.04))",
                backgroundSize: "200% 100%",
                animation: "shimmer 2.4s linear infinite",
              }}
            />
            <div className="h-2 w-1/2 rounded bg-white/[0.04]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function AgentFeed({ limit = 12 }: { limit?: number }) {
  const { events, mounted } = useAgentStream(limit);

  if (!mounted) return <Skeleton />;

  return (
    <ul className="space-y-1 px-2 pb-2">
      {events.map((event, i) => (
        <FeedRow key={event.id} event={event} novo={i === 0} />
      ))}
    </ul>
  );
}
