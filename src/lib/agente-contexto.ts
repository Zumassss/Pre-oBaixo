// Caminho relativo com extensão: o bot do WhatsApp roda este arquivo direto
// no Node, que não conhece o atalho "@/" nem completa a extensão sozinho.
import { ehMedicamento, type VisaoLoja } from "./db/types.ts";

/**
 * O que o agente precisa saber sobre a loja para responder.
 *
 * Existia um buraco aqui: o comportamento do agente dizia que ele responde
 * preço, estoque, horário e endereço, mas nada disso chegava até ele. Ele
 * respondia no escuro. Este arquivo é a ponte.
 *
 * No chat do painel, quem envia os dados é o navegador. Por isso o servidor
 * nunca confia no tamanho do que chega: ele recorta antes de montar o texto,
 * senão uma requisição grande viraria uma conta grande na API. O bot do
 * WhatsApp lê do banco e passa pelo mesmo caminho, para os dois canais
 * enxergarem o catálogo do mesmo jeito.
 */

export type ProdutoDoContexto = {
  nome: string;
  preco: number;
  /** Zero quando não há promoção. Remédio chega sempre com zero. */
  promocao: number;
  estoque: number;
  exigeReceita: boolean;
  /** Remédio nunca entra em sugestão, complemento nem promoção. */
  remedio: boolean;
};

export type ContextoLoja = {
  nome: string;
  endereco: string;
  horarios: string;
  farmaceutico: string;
  temMotoboy: boolean;
  taxaEntrega: number;
  produtos: ProdutoDoContexto[];
};

/** Quantos produtos do catálogo seguem junto de cada pergunta. */
const MAXIMO_PRODUTOS = 60;
const MAXIMO_TEXTO = 160;

export function extrairContexto(visao: VisaoLoja): ContextoLoja {
  const { loja } = visao;
  return {
    nome: loja.nome,
    endereco: [loja.endereco, loja.bairro, loja.cidade, loja.uf]
      .filter(Boolean)
      .join(", "),
    horarios: loja.horarios,
    farmaceutico: [loja.farmaceutico, loja.crf].filter(Boolean).join(" "),
    temMotoboy: loja.temMotoboy,
    taxaEntrega: loja.taxaEntrega,
    produtos: visao.produtos.slice(0, MAXIMO_PRODUTOS).map((p) => {
      const remedio = ehMedicamento(p);
      return {
        nome: p.nome,
        preco: p.preco,
        promocao: remedio ? 0 : p.promocao,
        estoque: p.estoque,
        exigeReceita: p.exigeReceita,
        remedio,
      };
    }),
  };
}

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.slice(0, MAXIMO_TEXTO).trim() : "";
}

function numero(valor: unknown): number {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : 0;
}

function reais(valor: number) {
  return valor.toFixed(2).replace(".", ",");
}

/**
 * Transforma o que chegou do navegador no texto que vai ao agente.
 *
 * Devolve vazio quando não veio nada de útil: nesse caso o agente segue sem
 * catálogo, o que é melhor que inventar preço.
 */
export function montarTextoDoContexto(bruto: unknown): string {
  if (typeof bruto !== "object" || bruto === null) return "";
  const dados = bruto as Record<string, unknown>;

  const linhas: string[] = [];
  const nome = texto(dados.nome);
  if (nome) linhas.push(`Loja: ${nome}.`);

  const endereco = texto(dados.endereco);
  if (endereco) linhas.push(`Endereço: ${endereco}.`);

  const horarios = texto(dados.horarios);
  if (horarios) linhas.push(`Horário de funcionamento: ${horarios}.`);

  const farmaceutico = texto(dados.farmaceutico);
  if (farmaceutico) {
    linhas.push(
      `Farmacêutico responsável: ${farmaceutico}. É para ele que vai toda dúvida clínica.`,
    );
  }

  if (dados.temMotoboy === true) {
    const taxa = numero(dados.taxaEntrega);
    linhas.push(
      taxa > 0
        ? `A loja entrega por motoboy, com taxa de R$ ${reais(taxa)}.`
        : "A loja entrega por motoboy, sem cobrar taxa.",
    );
  } else {
    linhas.push("A loja não entrega: todo pedido é retirada no balcão.");
  }

  const produtos = Array.isArray(dados.produtos)
    ? dados.produtos.slice(0, MAXIMO_PRODUTOS)
    : [];

  const itens = produtos
    .map((p) => {
      if (typeof p !== "object" || p === null) return "";
      const item = p as Record<string, unknown>;
      const nomeProduto = texto(item.nome);
      if (!nomeProduto) return "";

      const valorPreco = numero(item.preco);
      const preco = reais(valorPreco);
      const estoque = numero(item.estoque);
      const disponibilidade =
        estoque > 0 ? `${estoque} em estoque` : "sem estoque agora";
      const receita = item.exigeReceita === true ? ", exige receita" : "";

      // Na dúvida, é remédio: o navegador pode mandar um produto sem a
      // marca, e tratar remédio como item comum é o erro que não pode
      // acontecer. Sem a marca explícita de que não é, não se promove.
      const remedio = item.remedio !== false || item.exigeReceita === true;
      if (remedio) {
        return `- ${nomeProduto}: R$ ${preco}, ${disponibilidade}${receita} [remédio: sem sugestão nem promoção]`;
      }

      const promocao = numero(item.promocao);
      const valor =
        promocao > 0 && promocao < valorPreco
          ? `em promoção, de R$ ${preco} por R$ ${reais(promocao)}`
          : `R$ ${preco}`;
      return `- ${nomeProduto}: ${valor}, ${disponibilidade} [pode sugerir]`;
    })
    .filter(Boolean);

  if (itens.length > 0) {
    linhas.push("", "Catálogo desta loja:", ...itens);
    linhas.push(
      "",
      "Responda preço e disponibilidade SÓ a partir desta lista. Produto que não está aqui, a loja não tem cadastrado: diga que vai confirmar com a equipe em vez de chutar.",
    );
  } else {
    linhas.push(
      "",
      "O catálogo desta loja ainda está vazio. Não invente preço nem disponibilidade: diga que vai confirmar com a equipe.",
    );
  }

  return linhas.join("\n");
}
