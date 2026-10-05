import {
  CATEGORIAS_DE_MEDICAMENTO,
  type Cliente,
  type Produto,
  type PublicoCampanha,
} from "@/lib/db/types";
import type { IndiceCliente } from "@/lib/clientes";

/**
 * Regras das campanhas, fora da tela para valerem igual na prévia, no teste
 * e no disparo.
 */

/**
 * Vai no fim de toda campanha, sem opção de tirar.
 *
 * A LGPD pede um jeito simples de parar de receber, e um número que manda
 * propaganda sem essa saída acumula denúncia e é banido pelo WhatsApp.
 */
export const RODAPE_SAIR = "Para não receber mais, responda SAIR.";

/** O WhatsApp aceita até 4.096; acima de 700 quase ninguém lê até o fim. */
export const LIMITE_TEXTO = 4096;
export const TEXTO_LONGO = 700;

/** O texto que sai de verdade: com o primeiro nome e com a saída. */
export function textoFinal(mensagem: string, nome?: string) {
  const primeiro = (nome ?? "").trim().split(/\s+/)[0] ?? "";
  const corpo = mensagem.trim().replaceAll("{nome}", primeiro || "tudo bem");
  return `${corpo}\n\n${RODAPE_SAIR}`;
}

export type Alcance = {
  /** Quem recebe: está no público escolhido e autorizou contato. */
  clientes: Cliente[];
  /** Quantos do público escolhido não autorizaram e por isso ficam de fora. */
  semConsentimento: number;
  /** Dos que recebem, quantos já escreveram para a loja no WhatsApp. */
  jaEscreveram: number;
};

/** Para quem a campanha vai, sempre só com quem autorizou. */
export function alcanceDaCampanha(
  publico: PublicoCampanha,
  clientes: Cliente[],
  indice: Map<string, IndiceCliente>,
): Alcance {
  const escolhidos = clientes.filter((c) => {
    if (publico.modo === "etiquetas") {
      return publico.etiquetas.length > 0 && c.etiquetas.some((e) => publico.etiquetas.includes(e));
    }
    if (publico.modo === "situacao") {
      const s = indice.get(c.id)?.situacao;
      return publico.situacoes.length > 0 && s !== undefined && publico.situacoes.includes(s);
    }
    return true;
  });
  const recebem = escolhidos.filter((c) => c.consentimento);
  return {
    clientes: recebem,
    semConsentimento: escolhidos.length - recebem.length,
    jaEscreveram: recebem.filter((c) => c.primeiraMensagemEm > 0).length,
  };
}

export function ehMedicamento(p: Pick<Produto, "categoria" | "exigeReceita">) {
  return p.exigeReceita || CATEGORIAS_DE_MEDICAMENTO.includes(p.categoria);
}

/**
 * Nomes de remédio do catálogo, reduzidos à primeira palavra ("Loratadina
 * 10mg 12 comprimidos" vira "loratadina"). É o que a trava procura no texto
 * sugerido pela IA, e é o que a tela usa para avisar quem escreveu à mão.
 */
export function palavrasDeRemedio(produtos: Pick<Produto, "nome" | "categoria" | "exigeReceita">[]) {
  const palavras = new Set<string>();
  for (const p of produtos) {
    if (!ehMedicamento(p)) continue;
    const primeira = semAcento(p.nome.trim().split(/\s+/)[0] ?? "").toLowerCase();
    if (primeira.length >= 5) palavras.add(primeira);
  }
  return [...palavras];
}

export function semAcento(texto: string) {
  return texto.normalize("NFD").replace(/\p{M}/gu, "");
}

/** As palavras de remédio que aparecem no texto, para avisar antes de salvar. */
export function remediosNoTexto(texto: string, palavras: string[]) {
  const limpo = semAcento(texto).toLowerCase();
  return palavras.filter((p) => new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(limpo));
}

/** O que vai para o bot: o {nome} fica, ele troca pelo nome de cada um. */
export function textoParaEnvio(mensagem: string) {
  return `${mensagem.trim()}\n\n${RODAPE_SAIR}`;
}
