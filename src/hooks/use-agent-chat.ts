"use client";

import { useState } from "react";

type ChatState =
  | { status: "idle" }
  | { status: "loading"; question: string }
  | { status: "answered"; question: string; reply: string }
  | { status: "error"; question: string; error: string };

/**
 * Fala com o agente de verdade (rota /api/agente → Anthropic).
 *
 * Fica isolado num hook porque este é o único ponto do dashboard que faz
 * uma chamada real e paga — o resto da interface consome só dados
 * simulados de `src/lib/mock`.
 */
export function useAgentChat() {
  const [state, setState] = useState<ChatState>({ status: "idle" });

  async function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed || state.status === "loading") return;

    setState({ status: "loading", question: trimmed });

    try {
      const res = await fetch("/api/agente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      const data = await res.json();

      if (!res.ok) {
        setState({
          status: "error",
          question: trimmed,
          error: data.error ?? "Não foi possível falar com o agente.",
        });
        return;
      }

      setState({ status: "answered", question: trimmed, reply: data.reply });
    } catch {
      setState({
        status: "error",
        question: trimmed,
        error: "Falha de conexão com o agente.",
      });
    }
  }

  function reset() {
    setState({ status: "idle" });
  }

  return { state, ask, reset };
}
