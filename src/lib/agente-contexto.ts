import type { VisaoLoja } from "@/lib/db/types";

/**
 * O que o agente precisa saber sobre a loja para responder.
 *
 * Existia um buraco aqui: o comportamento do agente dizia que ele responde
 * preço, estoque, horário e endereço, mas nada disso chegava até ele. Ele
 * respondia no escuro. Este arquivo é a ponte.
 *
 * Os cadastros vivem no navegador enquanto não há banco, então quem tem os
 * dados é o cliente, e é ele que os envia. Por isso o servidor nunca confia
 * no tamanho do que chega: ele recorta antes de montar o texto, senão uma
 * requisição grande viraria uma conta grande na API.
 */

export type ProdutoDoContexto = {
  nome: string;
  preco: number;
  estoque: number;
  exigeReceita: boolean;
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
    produtos: visao.produtos.slice(0, MAXIMO_PRODUTOS).map((p) => ({
      nome: p.nome,
      preco: p.preco,
      estoque: p.estoque,
      exigeReceita: p.exigeReceita,
    })),
  };
}

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.slice(0, MAXIMO_TEXTO).trim() : "";
}

function numero(valor: unknown): number {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : 0;
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
        ? `A loja entrega por motoboy, com taxa de R$ ${taxa.toFixed(2).replace(".", ",")}.`
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

      const preco = numero(item.preco).toFixed(2).replace(".", ",");
      const estoque = numero(item.estoque);
      const disponibilidade =
        estoque > 0 ? `${estoque} em estoque` : "sem estoque agora";
      const receita = item.exigeReceita === true ? ", exige receita" : "";

      return `- ${nomeProduto}: R$ ${preco}, ${disponibilidade}${receita}`;
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
