import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { AGENT_MAX_TOKENS, AGENT_MODEL, AGENT_SYSTEM_PROMPT } from "@/lib/agent-config";

export const runtime = "nodejs";

/**
 * Trava de uso diário.
 *
 * Isto é intencionalmente simples: um contador em memória, não em banco de
 * dados. Ele existe só para não deixar a chave rodando sem limite enquanto
 * é teste. Como cada instância do servidor tem seu próprio contador (e uma
 * função sem uso por um tempo reinicia), o limite real pode passar um pouco
 * de 30 em produção — não é uma trava de segurança contra abuso, é um freio
 * de bolso contra "esquecer aberto". Quando o Supabase entrar, troque isto
 * por uma contagem persistida por dia.
 */
const MAX_REQUESTS_PER_DAY = 30;
const usage = new Map<string, number>();

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function checkAndConsumeQuota() {
  const key = todayKey();
  const used = usage.get(key) ?? 0;
  if (used >= MAX_REQUESTS_PER_DAY) return false;
  usage.set(key, used + 1);
  return true;
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "ANTHROPIC_API_KEY não configurada. Adicione a chave nas variáveis de ambiente do projeto.",
      },
      { status: 500 },
    );
  }

  let message: unknown;
  try {
    const body = await request.json();
    message = body?.message;
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  if (typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json({ error: "Mensagem vazia." }, { status: 400 });
  }
  if (message.length > 500) {
    return NextResponse.json(
      { error: "Mensagem muito longa para este teste (máx. 500 caracteres)." },
      { status: 400 },
    );
  }

  if (!checkAndConsumeQuota()) {
    return NextResponse.json(
      {
        error: `Limite de teste do dia atingido (${MAX_REQUESTS_PER_DAY} mensagens). Volte amanhã ou aumente o limite em src/app/api/agente/route.ts.`,
      },
      { status: 429 },
    );
  }

  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: AGENT_MODEL,
      max_tokens: AGENT_MAX_TOKENS,
      system: AGENT_SYSTEM_PROMPT,
      messages: [{ role: "user", content: message }],
    });

    const reply = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("Erro ao chamar a Anthropic:", error);
    return NextResponse.json(
      { error: "O agente não conseguiu responder agora. Tente de novo em instantes." },
      { status: 502 },
    );
  }
}
