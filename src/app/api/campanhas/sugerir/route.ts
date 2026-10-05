import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { dentroDoLimite, exigirSessao } from "@/lib/servidor/sessao";
import { AGENT_MODEL } from "@/lib/agent-config";
import { ehMedicamento, palavrasDeRemedio, remediosNoTexto, RODAPE_SAIR, semAcento } from "@/lib/campanhas";

export const runtime = "nodejs";

/** Freio de bolso, como o do agente: cada sugestão é uma chamada paga. */
const LIMITE_DIARIO = 40;
const uso = new Map<string, number>();
function consumirCota() {
  const dia = new Date().toISOString().slice(0, 10);
  const usado = uso.get(dia) ?? 0;
  if (usado >= LIMITE_DIARIO) return false;
  uso.set(dia, usado + 1);
  return true;
}

type ProdutoRecebido = { nome: string; categoria: string; exigeReceita: boolean; preco: number; promocao: number };

function texto(v: unknown, max: number) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}
function reais(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const TONS: Record<string, string> = {
  amigavel: "amigável e próximo, como a atendente que conhece o cliente pelo nome",
  direto: "direto e curto, oferta e chamada para ação, sem rodeio",
  animado: "animado e festivo, com energia, sem exagerar no ponto de exclamação",
};

const SISTEMA = `Você escreve mensagens de campanha de WhatsApp para uma farmácia brasileira.

## Regras que não podem falhar
- Nunca anuncie, promova, cite ou sugira medicamento: genérico, similar, de referência, de tarja, antibiótico, anticoncepcional, nem nome de remédio ou princípio ativo. A ANVISA proíbe anunciar medicamento ao público.
- Nunca fale de dose, tratamento, cura, sintoma ou doença. Nada de "alivie sua dor" ou "combata a gripe".
- Pode falar de higiene, beleza, dermocosméticos, protetor solar, cuidados com bebê, conveniência, datas comemorativas e dos serviços da loja (entrega, horário, atendimento pelo WhatsApp).
- Use só produtos e preços da lista enviada. Não invente preço, desconto, brinde nem prazo de promoção.
- Não escreva a linha de "para não receber mais"; o sistema acrescenta sozinho.

## Como escrever
- Português do Brasil, natural, de loja de bairro. Nada de "Prezado cliente".
- Comece com {nome} (o sistema troca pelo primeiro nome do cliente), por exemplo "Oi, {nome}!".
- Entre 200 e 450 caracteres. No máximo 2 emojis. *Negrito* do WhatsApp só no que importa, uma ou duas vezes.
- Termine pedindo uma resposta simples ("Responda QUERO que a gente separa para você"), porque a resposta abre a conversa com a loja.
- As três versões precisam ser diferentes de verdade: ângulos distintos, não a mesma frase reescrita.`;

const FERRAMENTA: Anthropic.Tool = {
  name: "entregar_sugestoes",
  description: "Entrega as três versões da mensagem de campanha.",
  input_schema: {
    type: "object",
    properties: {
      sugestoes: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: {
          type: "object",
          properties: {
            titulo: { type: "string", description: "O ângulo da versão em 2 a 4 palavras, ex: 'Lembrete de entrega'." },
            texto: { type: "string", description: "A mensagem pronta, com {nome}." },
          },
          required: ["titulo", "texto"],
        },
      },
    },
    required: ["sugestoes"],
  },
};

/**
 * Três versões de texto para uma campanha, a partir do que a loja quer
 * divulgar. A IA só sugere; quem decide e salva é a pessoa.
 *
 * Remédio fica fora duas vezes: a lista de produtos que vai para a IA já
 * chega sem eles, e a resposta passa por uma trava que descarta qualquer
 * versão que cite um remédio do catálogo.
 */
export async function POST(request: Request) {
  const sessao = await exigirSessao(request);
  if (sessao instanceof NextResponse) return sessao;
  if (!dentroDoLimite(`sugerir:${sessao.usuario}`, 40)) {
    return NextResponse.json({ error: "Limite de uso de hoje atingido para este acesso. Amanhã libera de novo." }, { status: 429 });
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "A IA não está configurada neste servidor." }, { status: 503 });

  let corpo: Record<string, unknown>;
  try {
    corpo = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const pedido = texto(corpo.contexto, 600);
  if (pedido.length < 4) return NextResponse.json({ error: "Conte em poucas palavras o que a campanha divulga." }, { status: 400 });
  const tom = TONS[texto(corpo.tom, 20)] ?? TONS.amigavel;
  const loja = typeof corpo.loja === "object" && corpo.loja ? (corpo.loja as Record<string, unknown>) : {};

  const produtos = (Array.isArray(corpo.produtos) ? corpo.produtos : [])
    .slice(0, 400)
    .filter((p): p is Record<string, unknown> => typeof p === "object" && p !== null)
    .map(
      (p): ProdutoRecebido => ({
        nome: texto(p.nome, 120),
        categoria: texto(p.categoria, 60),
        exigeReceita: p.exigeReceita !== false,
        preco: typeof p.preco === "number" ? p.preco : 0,
        promocao: typeof p.promocao === "number" ? p.promocao : 0,
      }),
    )
    .filter((p) => p.nome);

  const bloqueadas = palavrasDeRemedio(produtos);
  const permitidos = produtos.filter((p) => !ehMedicamento(p)).slice(0, 40);
  const catalogo = permitidos.length
    ? permitidos
        .map((p) =>
          p.promocao > 0 && p.promocao < p.preco
            ? `- ${p.nome}: de ${reais(p.preco)} por ${reais(p.promocao)}`
            : `- ${p.nome}: ${reais(p.preco)}`,
        )
        .join("\n")
    : "(nenhum produto cadastrado que possa ser anunciado)";

  const contextoLoja = [
    `Farmácia: ${texto(loja.nome, 80) || "a farmácia"}`,
    texto(loja.bairro, 80) && `Bairro: ${texto(loja.bairro, 80)}`,
    texto(loja.horarios, 200) && `Horário: ${texto(loja.horarios, 200)}`,
    texto(loja.entrega, 200) && `Entrega: ${texto(loja.entrega, 200)}`,
  ]
    .filter(Boolean)
    .join("\n");

  if (!consumirCota()) {
    return NextResponse.json({ error: "Limite de sugestões de hoje atingido. Amanhã libera de novo." }, { status: 429 });
  }

  try {
    const anthropic = new Anthropic({ apiKey });
    const resposta = await anthropic.messages.create({
      model: AGENT_MODEL,
      max_tokens: 1500,
      system: SISTEMA,
      tools: [FERRAMENTA],
      tool_choice: { type: "tool", name: FERRAMENTA.name },
      messages: [
        {
          role: "user",
          content: `${contextoLoja}\n\nProdutos que podem ser anunciados:\n${catalogo}\n\nTom: ${tom}.\n\nO que a loja quer divulgar: ${pedido}`,
        },
      ],
    });

    const bloco = resposta.content.find((b) => b.type === "tool_use");
    const brutas = (bloco?.type === "tool_use" ? (bloco.input as { sugestoes?: unknown }).sugestoes : null) ?? [];
    const sugestoes = (Array.isArray(brutas) ? brutas : [])
      .filter((s): s is { titulo: string; texto: string } => typeof s?.titulo === "string" && typeof s?.texto === "string")
      .map((s) => ({
        titulo: s.titulo.trim().slice(0, 60),
        // Se a IA escrever a saída mesmo assim, tira: o sistema já põe.
        texto: s.texto.replace(RODAPE_SAIR, "").trim().slice(0, 1200),
      }))
      .filter((s) => s.texto && remediosNoTexto(s.texto, bloqueadas).length === 0 && !/\bremedio|medicament/.test(semAcento(s.texto).toLowerCase()));

    if (sugestoes.length === 0) {
      return NextResponse.json({ error: "A IA não trouxe uma versão que pudesse ser usada. Tente descrever de outro jeito." }, { status: 502 });
    }
    return NextResponse.json({ sugestoes });
  } catch (erro) {
    console.error("Falha ao sugerir campanha:", erro);
    return NextResponse.json({ error: "A IA não respondeu agora. Tente de novo em instantes." }, { status: 502 });
  }
}
