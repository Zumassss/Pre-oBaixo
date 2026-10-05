"use client";

import { useCallback, useState } from "react";
import { extrairContexto, extrairResumoOperacao } from "@/lib/agente-contexto";
import { useBanco } from "@/lib/db/use-db";
import { cabecalhoDaSessao } from "@/lib/db/local-db";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  at: number;
  error?: boolean;
};

/** Quantas mensagens do histórico seguem para a API a cada pergunta. */
const CONTEXTO_MAXIMO = 8;

/**
 * Conversa com o agente, com histórico.
 *
 * O histórico serve a duas coisas: aparece na tela e viaja junto na chamada,
 * para o agente entender perguntas encadeadas. Só as últimas mensagens vão
 * junto, senão cada pergunta ficaria progressivamente mais cara.
 */
export function useAgentChat(modo: "equipe" | "cliente" = "equipe") {
  const { banco } = useBanco();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const ask = useCallback(
    async (question: string) => {
      const texto = question.trim();
      if (!texto || loading) return;

      const pergunta: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        content: texto,
        at: Date.now(),
      };

      const historico = [...messages, pergunta];
      setMessages(historico);
      setLoading(true);

      try {
        const res = await fetch("/api/agente", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...cabecalhoDaSessao() },
          body: JSON.stringify({
            messages: historico
              .slice(-CONTEXTO_MAXIMO)
              .map(({ role, content }) => ({ role, content })),
            // Sem isto o agente responde preço e horário no escuro.
            loja: extrairContexto(banco),
            modo,
            // O resumo já vai calculado: o servidor nunca recebe a lista de
            // clientes nem as conversas.
            resumo: modo === "equipe" ? extrairResumoOperacao(banco) : undefined,
          }),
        });
        const data = await res.json();

        setMessages((atual) => [
          ...atual,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: res.ok
              ? data.reply
              : (data.error ?? "Não consegui responder agora."),
            at: Date.now(),
            error: !res.ok,
          },
        ]);
      } catch {
        setMessages((atual) => [
          ...atual,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: "Falha de conexão com o agente.",
            at: Date.now(),
            error: true,
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [messages, loading, banco, modo],
  );

  const clear = useCallback(() => setMessages([]), []);

  return { messages, loading, ask, clear };
}
