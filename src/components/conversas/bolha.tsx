"use client";

import { AlertCircle, Bot, Check, Clock, CornerUpLeft, RotateCw, Star, UserRound } from "lucide-react";
import type { Mensagem } from "@/lib/db/types";
import { descreverMidia } from "@/lib/midia";
import { cn } from "@/lib/utils";
import { VisualMidia } from "./midia-view";

function hora(em: number) {
  return new Date(em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

const QUEM: Record<Mensagem["origem"], string> = {
  cliente: "Cliente",
  agente: "Agente",
  atendente: "Equipe",
};

/** O status de entrega da mensagem da equipe, como os tiques do WhatsApp. */
function Envio({ mensagem, onReenviar }: { mensagem: Mensagem; onReenviar?: () => void }) {
  if (!mensagem.envio) return null;
  if (mensagem.envio === "pendente") {
    return (
      <span className="flex items-center gap-1 text-[10px] text-fg-ghost" title="Esperando o WhatsApp mandar">
        <Clock className="h-3 w-3" strokeWidth={2} />
        enviando
      </span>
    );
  }
  if (mensagem.envio === "enviado") {
    return (
      <span className="flex items-center text-positive" title="Entregue no WhatsApp">
        <Check className="h-3 w-3" strokeWidth={2.4} />
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onReenviar}
      className="flex items-center gap-1 rounded-full px-1 text-[10px] font-semibold text-brand-400 transition-colors hover:text-brand-300"
      title="O WhatsApp não conseguiu mandar"
    >
      <AlertCircle className="h-3 w-3" strokeWidth={2.2} />
      não enviou · tentar de novo
      <RotateCw className="h-3 w-3" strokeWidth={2.2} />
    </button>
  );
}

export function Bolha({
  mensagem,
  onResponder,
  onMarcar,
  onReenviar,
  onIrParaCitada,
}: {
  mensagem: Mensagem;
  onResponder?: () => void;
  onMarcar?: () => void;
  onReenviar?: () => void;
  onIrParaCitada?: (id: string) => void;
}) {
  const entrada = mensagem.origem === "cliente";
  const preenchida = mensagem.origem === "agente";

  return (
    <div
      id={`msg-${mensagem.id}`}
      className={cn("group flex scroll-mt-24", entrada ? "justify-start" : "justify-end")}
      style={{ animation: "rise 0.3s cubic-bezier(0.16,1,0.3,1) both" }}
    >
      {/* Ações ficam ao lado da bolha: aparecem no passar do mouse ou no
          foco do teclado, e ficam sempre visíveis em tela de toque. */}
      {!entrada && (onResponder || onMarcar) && (
        <Acoes mensagem={mensagem} onResponder={onResponder} onMarcar={onMarcar} lado="esquerda" />
      )}
      <div className={cn("min-w-0 max-w-[78%]", entrada ? "" : "flex flex-col items-end")}>
        <div
          className={cn(
            "relative rounded-2xl px-3.5 py-2.5 text-[13px] leading-[1.5]",
            entrada
              ? "rounded-tl-md bg-nivel-3 text-fg ring-1 ring-inset ring-nivel-4"
              : preenchida
                ? "rounded-tr-md bg-gradient-to-br from-brand-600 to-brand-800 text-white"
                : "rounded-tr-md bg-surface-3 text-fg ring-1 ring-inset ring-anel",
            mensagem.marcada && "ring-2 ring-caution/60",
          )}
        >
          {mensagem.citada && (
            <button
              type="button"
              onClick={() => onIrParaCitada?.(mensagem.citada!.id)}
              className={cn(
                "mb-2 block w-full rounded-lg border-l-[3px] px-2.5 py-1.5 text-left text-[11.5px] leading-snug",
                preenchida ? "border-white/70 bg-white/12 text-white/85" : "border-brand-500 bg-nivel-2 text-fg-muted",
              )}
            >
              <span className={cn("block text-[10.5px] font-semibold", preenchida ? "text-white" : "text-brand-400")}>
                {QUEM[mensagem.citada.origem]}
              </span>
              <span className="line-clamp-2">{mensagem.citada.texto || "Mídia"}</span>
            </button>
          )}
          {mensagem.midia && (
            <div className={mensagem.texto ? "mb-2" : ""}>
              <VisualMidia midia={mensagem.midia} deMim={preenchida} />
            </div>
          )}
          {mensagem.texto && <p className="whitespace-pre-wrap break-words">{mensagem.texto}</p>}
          {!mensagem.texto && !mensagem.midia && (
            <p className="italic opacity-70">{descreverMidia(mensagem.midia) || "Mensagem vazia"}</p>
          )}
        </div>
        <div className={cn("mt-1 flex items-center gap-1.5 px-1", entrada ? "" : "justify-end")}>
          {mensagem.marcada && <Star className="h-3 w-3 fill-caution text-caution" strokeWidth={2} />}
          {mensagem.origem === "agente" && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-brand-400">
              <Bot className="h-3 w-3" strokeWidth={2} />
              agente
            </span>
          )}
          {mensagem.origem === "atendente" && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-caution">
              <UserRound className="h-3 w-3" strokeWidth={2} />
              {mensagem.autor || "você"}
            </span>
          )}
          <span className="tnum font-mono text-[10px] text-fg-ghost">{hora(mensagem.em)}</span>
          <Envio mensagem={mensagem} onReenviar={onReenviar} />
        </div>
      </div>
      {entrada && (onResponder || onMarcar) && (
        <Acoes mensagem={mensagem} onResponder={onResponder} onMarcar={onMarcar} lado="direita" />
      )}
    </div>
  );
}

function Acoes({
  mensagem,
  onResponder,
  onMarcar,
  lado,
}: {
  mensagem: Mensagem;
  onResponder?: () => void;
  onMarcar?: () => void;
  lado: "esquerda" | "direita";
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-start gap-0.5 pt-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100",
        lado === "esquerda" ? "mr-1.5" : "ml-1.5",
      )}
    >
      {onResponder && (
        <button
          type="button"
          onClick={onResponder}
          aria-label="Responder esta mensagem"
          title="Responder"
          className="flex h-7 w-7 items-center justify-center rounded-full text-fg-ghost transition-colors hover:bg-nivel-3 hover:text-fg"
        >
          <CornerUpLeft className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      )}
      {onMarcar && (
        <button
          type="button"
          onClick={onMarcar}
          aria-pressed={mensagem.marcada}
          aria-label={mensagem.marcada ? "Desmarcar mensagem" : "Marcar mensagem"}
          title={mensagem.marcada ? "Desmarcar" : "Marcar para achar depois"}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-nivel-3",
            mensagem.marcada ? "text-caution" : "text-fg-ghost hover:text-fg",
          )}
        >
          <Star className={cn("h-3.5 w-3.5", mensagem.marcada && "fill-caution")} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}
