"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, SendHorizonal, Sparkles } from "lucide-react";
import { useAgentChat } from "@/hooks/use-agent-chat";
import { registrarEvento } from "@/lib/db/use-db";
import { cn } from "@/lib/utils";

const SUGESTOES = [
  "Como você atende um cliente?",
  "O que você não pode responder?",
  "Como funciona a transferência?",
];

/**
 * Conversa com o agente.
 *
 * Esta é a única parte do sistema que já fala com um modelo de verdade. Cada
 * troca fica registrada no histórico da loja, então o que aparece no painel
 * de atividade aconteceu mesmo.
 */
export function AgentConsole({ className }: { className?: string }) {
  const { messages, loading, ask, clear } = useAgentChat();
  const [draft, setDraft] = useState("");
  const fim = useRef<HTMLDivElement>(null);
  const jaRegistradas = useRef(new Set<string>());

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  // Registra no histórico da loja o que realmente foi trocado.
  useEffect(() => {
    for (const m of messages) {
      if (jaRegistradas.current.has(m.id)) continue;
      jaRegistradas.current.add(m.id);
      registrarEvento({
        tipo: m.role === "user" ? "pergunta" : m.error ? "erro" : "resposta",
        titulo:
          m.role === "user"
            ? "Pergunta ao agente"
            : m.error
              ? "Falha na resposta do agente"
              : "Resposta do agente",
        detalhe: m.content.slice(0, 160),
      });
    }
  }, [messages]);

  function enviar(texto: string) {
    if (!texto.trim() || loading) return;
    ask(texto);
    setDraft("");
  }

  return (
    <div className={cn("panel flex flex-col overflow-hidden", className)}>
      <header className="flex items-center gap-2.5 border-b border-hairline px-4 py-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500/12 ring-1 ring-inset ring-brand-500/25">
          <Sparkles className="h-3.5 w-3.5 text-brand-400" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-fg">Agente</p>
          <p className="text-[11px] text-fg-faint">Teste o atendimento aqui</p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clear}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] text-fg-ghost transition-colors hover:bg-white/5 hover:text-fg-muted"
          >
            <Eraser className="h-3 w-3" strokeWidth={2} />
            limpar
          </button>
        )}
      </header>

      <div
        data-lenis-prevent
        className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4"
      >
        {messages.length === 0 && !loading && (
          <div>
            <p className="text-[12.5px] leading-relaxed text-fg-faint">
              Converse como se fosse um cliente. O agente responde com os dados
              cadastrados e nunca opina sobre medicamento.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {SUGESTOES.map((s) => (
                <button
                  key={s}
                  onClick={() => enviar(s)}
                  className="chip transition-colors hover:border-brand-500/40 hover:text-brand-300"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
            style={{ animation: "rise 0.35s cubic-bezier(0.16,1,0.3,1) both" }}
          >
            <div
              className={cn(
                "max-w-[86%] rounded-2xl px-3 py-2 text-[12.5px] leading-[1.5]",
                m.role === "user"
                  ? "rounded-br-md bg-gradient-to-br from-brand-600 to-brand-800 text-white"
                  : m.error
                    ? "rounded-bl-md bg-caution/10 text-caution ring-1 ring-inset ring-caution/25"
                    : "rounded-bl-md bg-white/[0.055] text-fg ring-1 ring-inset ring-white/[0.07]",
              )}
            >
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-white/[0.055] px-3 py-2.5 ring-1 ring-inset ring-white/[0.07]">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-brand-400"
                  style={{ animation: `blink 1.1s ease-in-out ${i * 0.18}s infinite` }}
                />
              ))}
            </div>
          </div>
        )}

        <div ref={fim} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviar(draft);
        }}
        className="border-t border-hairline p-3"
      >
        <div className="flex items-center gap-2 rounded-full border border-hairline bg-white/[0.035] px-2 py-1.5 transition-colors focus-within:border-brand-500/45">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={600}
            disabled={loading}
            className="min-w-0 flex-1 bg-transparent px-2.5 py-1 text-[13px] text-fg outline-none placeholder:text-fg-ghost"
            placeholder="Escreva sua pergunta"
          />
          <button
            type="submit"
            disabled={loading || !draft.trim()}
            aria-label="Enviar"
            className="btn-primary !h-8 !w-8 !p-0"
          >
            <SendHorizonal className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </form>
    </div>
  );
}
