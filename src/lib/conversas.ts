import {
  chaveDoCliente,
  conversaAtiva,
  type Conversa,
} from "@/lib/db/types";

/**
 * O histórico de atendimento de uma pessoa.
 *
 * O sistema guarda conversas, não clientes de conversa: cada atendimento é um
 * registro solto. Quem atende, porém, não pensa em conversas, pensa em
 * pessoas: "o que já falei com a dona Marta". Este arquivo faz essa virada.
 */
export type HistoricoCliente = {
  /** O que junta os atendimentos da mesma pessoa. */
  chave: string;
  nome: string;
  telefone: string;
  /** Da mais recente para a mais antiga. */
  conversas: Conversa[];
  /** Quantas ainda estão na fila de quem atende. */
  ativas: number;
  mensagens: number;
  ultimaEm: number;
  /** Quando esta pessoa apareceu pela primeira vez. */
  desde: number;
};

/**
 * Junta as conversas por pessoa.
 *
 * O nome vem da conversa mais recente: se a pessoa se apresentou com o nome
 * completo da última vez, é esse que a loja reconhece hoje.
 */
export function historicoPorCliente(conversas: Conversa[]): HistoricoCliente[] {
  const porChave = new Map<string, Conversa[]>();

  for (const conversa of conversas) {
    const chave = chaveDoCliente(conversa);
    const lista = porChave.get(chave);
    if (lista) lista.push(conversa);
    else porChave.set(chave, [conversa]);
  }

  const historicos: HistoricoCliente[] = [];

  for (const [chave, lista] of porChave) {
    const ordenadas = [...lista].sort((a, b) => b.atualizadaEm - a.atualizadaEm);
    const recente = ordenadas[0];

    historicos.push({
      chave,
      nome: recente.cliente,
      telefone: recente.telefone,
      conversas: ordenadas,
      ativas: ordenadas.filter(conversaAtiva).length,
      mensagens: ordenadas.reduce((n, c) => n + c.mensagens.length, 0),
      ultimaEm: recente.atualizadaEm,
      desde: Math.min(...ordenadas.map((c) => c.criadaEm || c.atualizadaEm)),
    });
  }

  return historicos.sort((a, b) => b.ultimaEm - a.ultimaEm);
}

/** As conversas que ainda estão na fila. Resolvida sai daqui. */
export function conversasAtivas(conversas: Conversa[]) {
  return conversas.filter(conversaAtiva);
}

/** Um resumo de uma linha, para a lista não exigir abrir a conversa. */
export function resumoDaConversa(conversa: Conversa) {
  const ultima = conversa.mensagens[conversa.mensagens.length - 1];
  if (!ultima) return "Sem mensagens ainda";
  const quem =
    ultima.origem === "cliente"
      ? ""
      : ultima.origem === "agente"
        ? "Agente: "
        : `${ultima.autor || "Você"}: `;
  return `${quem}${ultima.texto}`;
}
