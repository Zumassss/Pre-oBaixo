"use client";

import { AgentConsole } from "@/components/dashboard/agent-console";

/**
 * O assistente da equipe, em aba própria.
 *
 * Morava no painel, onde ocupava meia tela vazia na maior parte do dia. Aqui
 * ele tem a altura toda para a conversa e o painel fica com a operação.
 */
export default function Assistente() {
  return (
    <div className="mx-auto flex max-w-[960px] flex-col gap-5">
      <header>
        <h1 className="text-[26px] font-semibold tracking-[-0.025em] text-fg">
          Assistente da loja
        </h1>
        <p className="mt-1 text-[13px] text-fg-muted">
          Pergunte sobre conversas, pedidos, estoque e vendas, ou como usar alguma tela.
        </p>
      </header>
      <AgentConsole className="h-[calc(100dvh-230px)] min-h-[420px]" />
    </div>
  );
}
