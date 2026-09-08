import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  AGENT_MAX_TOKENS,
  AGENT_MODEL,
  AGENT_SYSTEM_PROMPT,
} from "@/lib/agent-config";

export const runtime = "nodejs";

/**
 * Trava de uso diário.
 *
 * Contador em memória, não em banco. Existe para a chave não rodar sem
 * limite durante os testes. Cada instância do servidor tem o próprio
 * contador e uma função ociosa reinicia, então o total real pode passar um
 * pouco de 60 em produção. É freio de bolso, não trava de segurança. Quando
 * o Supabase entrar, isto vira contagem persistida.
 */
const LIMITE_DIARIO = 60;
const uso = new Map<string, number>();

function consumirCota() {
  const dia = new Date().toISOString().slice(0, 10);
  const usado = uso.get(dia) ?? 0;
  if (usado >= LIMITE_DIARIO) return false;
  uso.set(dia, usado + 1);
  return true;
}

type Entrada = { role: "user" | "assistant"; content: string };

function normalizar(body: unknown): Entrada[] | null {
  if (typeof body !== "object" || body === null) return null;
  const dados = body as Record<string, unknown>;

  // Formato atual: histórico completo da conversa.
  if (Array.isArray(dados.messages)) {
    const limpas = dados.messages
      .filter(
        (m): m is Entrada =>
          typeof m === "object" &&
          m !== null &&
          (("role" in m && (m as Entrada).role === "user") ||
            (m as Entrada).role === "assistant") &&
          typeof (m as Entrada).content === "string" &&
          (m as Entrada).content.trim().length > 0,
      )
      .slice(-10);
    return limpas.length ? limpas : null;
  }

  // Formato antigo: uma pergunta solta.
  if (typeof dados.message === "string" && dados.message.trim()) {
    return [{ role: "user", content: dados.message }];
  }

  return null;
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Chave da API não configurada nas variáveis de ambiente." },
      { status: 500 },
    );
  }

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const mensagens = normalizar(corpo);
  if (!mensagens) {
    return NextResponse.json({ error: "Mensagem vazia." }, { status: 400 });
  }

  const ultima = mensagens[mensagens.length - 1];
  if (ultima.content.length > 600) {
    return NextResponse.json(
      { error: "Mensagem muito longa para este teste." },
      { status: 400 },
    );
  }

  // A conversa precisa começar por uma fala do usuário.
  const inicio = mensagens.findIndex((m) => m.role === "user");
  const contexto = inicio >= 0 ? mensagens.slice(inicio) : mensagens;

  if (!consumirCota()) {
    return NextResponse.json(
      { error: `Limite de teste do dia atingido (${LIMITE_DIARIO} mensagens).` },
      { status: 429 },
    );
  }

  try {
    const anthropic = new Anthropic({ apiKey });
    const resposta = await anthropic.messages.create({
      model: AGENT_MODEL,
      max_tokens: AGENT_MAX_TOKENS,
      system: AGENT_SYSTEM_PROMPT,
      messages: contexto,
    });

    const reply = resposta.content
      .filter((bloco) => bloco.type === "text")
      .map((bloco) => bloco.text)
      .join("\n")
      .trim();

    return NextResponse.json({ reply });
  } catch (erro) {
    console.error("Falha na chamada à Anthropic:", erro);
    return NextResponse.json(
      { error: "O agente não respondeu agora. Tente de novo." },
      { status: 502 },
    );
  }
}
