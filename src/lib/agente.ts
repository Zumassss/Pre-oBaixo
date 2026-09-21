import Anthropic from "@anthropic-ai/sdk";
import {
  AGENT_MAX_TOKENS,
  AGENT_MODEL,
  AGENT_SYSTEM_PROMPT,
} from "@/lib/agent-config";

/**
 * A chamada ao agente, em um lugar só.
 *
 * O mesmo agente atende o chat do painel e o WhatsApp. Se cada canal tivesse
 * a própria chamada, um dia a regra de medicamento valeria em um e não no
 * outro, e essa é justamente a regra que não pode falhar em canal nenhum.
 */

export type Fala = { role: "user" | "assistant"; content: string };

export type RespostaAgente =
  | { ok: true; texto: string }
  | { ok: false; erro: string };

export async function responder(
  conversa: Fala[],
  extras?: { contexto?: string },
): Promise<RespostaAgente> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { ok: false, erro: "Chave da API não configurada." };
  }

  // A conversa precisa começar por uma fala do cliente.
  const inicio = conversa.findIndex((m) => m.role === "user");
  const contexto = inicio >= 0 ? conversa.slice(inicio) : conversa;
  if (contexto.length === 0) {
    return { ok: false, erro: "Conversa vazia." };
  }

  const sistema = extras?.contexto
    ? `${AGENT_SYSTEM_PROMPT}\n\n## Contexto desta conversa\n${extras.contexto}`
    : AGENT_SYSTEM_PROMPT;

  try {
    const anthropic = new Anthropic({ apiKey });
    const resposta = await anthropic.messages.create({
      model: AGENT_MODEL,
      max_tokens: AGENT_MAX_TOKENS,
      system: sistema,
      messages: contexto,
    });

    const texto = resposta.content
      .filter((bloco) => bloco.type === "text")
      .map((bloco) => bloco.text)
      .join("\n")
      .trim();

    if (!texto) {
      return { ok: false, erro: "O agente devolveu resposta vazia." };
    }

    return { ok: true, texto };
  } catch (erro) {
    console.error("Falha na chamada à Anthropic:", erro);
    return { ok: false, erro: "O agente não respondeu agora." };
  }
}
