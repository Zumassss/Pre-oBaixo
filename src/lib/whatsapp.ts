import crypto from "node:crypto";

/**
 * Conversa com a WhatsApp Cloud API da Meta.
 *
 * Duas responsabilidades: provar que a mensagem veio mesmo da Meta, e mandar
 * a resposta de volta. Nada aqui conhece o agente ou a farmácia.
 */

/** A Meta versiona a Graph API na URL. Sobe quando a conta migrar de versão. */
const VERSAO_API = process.env.WHATSAPP_API_VERSION ?? "v25.0";

/**
 * Confere a assinatura que a Meta manda no cabeçalho.
 *
 * Sem isso, qualquer um que descubra a URL do webhook pode fingir ser um
 * cliente e fazer o agente responder, gastando a chave da API e sujando o
 * histórico da loja. A Meta assina o corpo com o App Secret, então quem não
 * tem o segredo não consegue forjar.
 *
 * A comparação usa `timingSafeEqual` porque comparar string com `===` vaza,
 * pelo tempo de resposta, quantos caracteres bateram.
 */
export function assinaturaConfere(
  corpoBruto: string,
  cabecalho: string | null,
  appSecret: string,
): boolean {
  if (!cabecalho?.startsWith("sha256=")) return false;

  const recebida = cabecalho.slice("sha256=".length);
  const esperada = crypto
    .createHmac("sha256", appSecret)
    .update(corpoBruto, "utf8")
    .digest("hex");

  const a = Buffer.from(recebida, "hex");
  const b = Buffer.from(esperada, "hex");
  if (a.length !== b.length) return false;

  return crypto.timingSafeEqual(a, b);
}

/** Uma mensagem de texto que chegou de um cliente. */
export type MensagemRecebida = {
  /** Identificador da Meta. Serve para não responder duas vezes a mesma. */
  id: string;
  /** Telefone de quem escreveu, com código do país e sem sinais. */
  de: string;
  /** Nome do perfil do WhatsApp, quando a Meta manda. */
  nome: string;
  texto: string;
};

/**
 * Tira as mensagens de texto do pacote que a Meta envia.
 *
 * O mesmo webhook recebe muita coisa que não é mensagem: confirmação de
 * entrega, de leitura, mudança de configuração. Também chegam áudio, imagem e
 * figurinha, que o agente ainda não trata. Tudo isso é ignorado de propósito.
 */
export function extrairMensagens(carga: unknown): MensagemRecebida[] {
  const encontradas: MensagemRecebida[] = [];

  const raiz = carga as {
    entry?: {
      changes?: {
        value?: {
          contacts?: { wa_id?: string; profile?: { name?: string } }[];
          messages?: {
            id?: string;
            from?: string;
            type?: string;
            text?: { body?: string };
          }[];
        };
      }[];
    }[];
  };

  for (const entrada of raiz?.entry ?? []) {
    for (const mudanca of entrada.changes ?? []) {
      const valor = mudanca.value;
      if (!valor?.messages) continue;

      for (const mensagem of valor.messages) {
        if (mensagem.type !== "text") continue;
        const texto = mensagem.text?.body?.trim();
        if (!texto || !mensagem.id || !mensagem.from) continue;

        const contato = valor.contacts?.find((c) => c.wa_id === mensagem.from);

        encontradas.push({
          id: mensagem.id,
          de: mensagem.from,
          nome: contato?.profile?.name ?? "",
          texto,
        });
      }
    }
  }

  return encontradas;
}

/** Manda uma mensagem de texto para um número. */
export async function enviarTexto(
  para: string,
  texto: string,
): Promise<{ ok: boolean; erro?: string }> {
  const token = process.env.WHATSAPP_TOKEN;
  const numeroId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !numeroId) {
    return { ok: false, erro: "WhatsApp não configurado." };
  }

  try {
    const resposta = await fetch(
      `https://graph.facebook.com/${VERSAO_API}/${numeroId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: para,
          type: "text",
          text: { body: texto },
        }),
      },
    );

    if (!resposta.ok) {
      const detalhe = await resposta.text();
      return { ok: false, erro: `${resposta.status}: ${detalhe.slice(0, 300)}` };
    }

    return { ok: true };
  } catch (erro) {
    return { ok: false, erro: String(erro) };
  }
}

/**
 * Guarda os identificadores já respondidos.
 *
 * A Meta reenvia a mesma mensagem quando não recebe 200 rápido o bastante.
 * Sem esta trava o cliente receberia a resposta duas vezes e a chave da API
 * seria cobrada duas vezes. Fica em memória: se o servidor reiniciar, a
 * proteção some, mas o caso é raro e o prejuízo é uma resposta repetida.
 */
const jaRespondidas = new Set<string>();
const LIMITE_MEMORIA = 500;

export function marcarComoRespondida(id: string): boolean {
  if (jaRespondidas.has(id)) return false;

  if (jaRespondidas.size >= LIMITE_MEMORIA) {
    const maisAntiga = jaRespondidas.values().next().value;
    if (maisAntiga) jaRespondidas.delete(maisAntiga);
  }

  jaRespondidas.add(id);
  return true;
}
