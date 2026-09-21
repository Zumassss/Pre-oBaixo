import { NextResponse } from "next/server";
import { responder } from "@/lib/agente";
import {
  assinaturaConfere,
  enviarTexto,
  extrairMensagens,
  marcarComoRespondida,
} from "@/lib/whatsapp";

/**
 * Webhook do WhatsApp.
 *
 * É por aqui que a Meta entrega o que o cliente escreveu, e é daqui que a
 * resposta do agente sai de volta. Duas rotas no mesmo endereço, por
 * exigência da Meta:
 *
 *   GET  - só na hora de cadastrar a URL, para provar que o endereço é nosso
 *   POST - toda mensagem que chega, pelo resto da vida
 *
 * Precisa de runtime Node, não Edge: a conferência de assinatura usa o
 * módulo de criptografia do Node.
 */
export const runtime = "nodejs";

/* ------------------------------------------------------------------
   GET: verificação do endereço
   ------------------------------------------------------------------ */

/**
 * A Meta chama isto uma vez, quando alguém cadastra a URL no painel dela.
 * Ela manda um desafio e a senha que foi digitada lá; devolvemos o desafio
 * cru se a senha bater. Qualquer outra resposta faz o cadastro ser recusado.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const modo = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const desafio = params.get("hub.challenge");

  const esperado = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!esperado) {
    console.error("WHATSAPP_VERIFY_TOKEN não está configurado.");
    return new NextResponse("Webhook não configurado", { status: 500 });
  }

  if (modo === "subscribe" && token === esperado && desafio) {
    // Precisa ser texto puro, sem aspas e sem JSON em volta.
    return new NextResponse(desafio, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return new NextResponse("Verificação recusada", { status: 403 });
}

/* ------------------------------------------------------------------
   POST: mensagem chegando
   ------------------------------------------------------------------ */

export async function POST(request: Request) {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    console.error("WHATSAPP_APP_SECRET não está configurado.");
    // 200 mesmo assim: erro nosso não deve fazer a Meta ficar reenviando.
    return NextResponse.json({ recebido: true });
  }

  // O corpo cru, antes de virar objeto: a assinatura é calculada sobre os
  // bytes exatos que a Meta mandou. Reserializar o JSON muda espaços e
  // ordem de chaves, e aí a conta nunca fecha.
  const corpoBruto = await request.text();

  if (
    !assinaturaConfere(
      corpoBruto,
      request.headers.get("x-hub-signature-256"),
      appSecret,
    )
  ) {
    console.warn("Webhook com assinatura inválida foi recusado.");
    return new NextResponse("Assinatura inválida", { status: 401 });
  }

  let carga: unknown;
  try {
    carga = JSON.parse(corpoBruto);
  } catch {
    return NextResponse.json({ recebido: true });
  }

  const mensagens = extrairMensagens(carga);

  // Confirmação de entrega, de leitura e mídia que ainda não tratamos caem
  // aqui. Responder 200 rápido evita que a Meta reenvie.
  if (mensagens.length === 0) {
    return NextResponse.json({ recebido: true });
  }

  for (const mensagem of mensagens) {
    if (!marcarComoRespondida(mensagem.id)) continue;

    const apresentacao = mensagem.nome
      ? `Quem está falando se chama ${mensagem.nome}.`
      : "";

    const resultado = await responder(
      [{ role: "user", content: mensagem.texto }],
      {
        contexto: [
          "Esta conversa chegou pelo WhatsApp da loja, de um cliente real.",
          apresentacao,
          "Responda curto, como mensagem de WhatsApp.",
        ]
          .filter(Boolean)
          .join(" "),
      },
    );

    const texto = resultado.ok
      ? resultado.texto
      : "Tive um problema para responder agora. Já já alguém da equipe te atende.";

    if (!resultado.ok) {
      console.error("Agente falhou no WhatsApp:", resultado.erro);
    }

    const envio = await enviarTexto(mensagem.de, texto);
    if (!envio.ok) {
      console.error("Falha ao enviar pelo WhatsApp:", envio.erro);
    }
  }

  // A Meta só precisa saber que chegou. Erro de envio é problema nosso, e
  // devolver erro aqui só faria ela reenviar a mesma mensagem.
  return NextResponse.json({ recebido: true });
}
