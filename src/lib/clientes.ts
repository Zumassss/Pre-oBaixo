import type { Cliente, Conversa, Pedido, SituacaoCliente } from "@/lib/db/types";

/**
 * A situação de cada cliente, calculada a partir do que aconteceu.
 *
 * Nunca é digitada: se alguém pudesse escrever "comprou" à mão, o filtro (e
 * a campanha que usa o filtro) deixaria de dizer a verdade.
 *
 * Ordem de prioridade: quem comprou é "comprou", mesmo que depois tenha
 * largado um carrinho; só quem nunca comprou cai nas outras.
 */

/** Os 8 dígitos finais: junta "(27) 9..." com "5527 9..." e com o 9 extra. */
export function fimDoTelefone(telefone: string) {
  return telefone.replace(/\D/g, "").slice(-8);
}

export type IndiceCliente = {
  conversas: Conversa[];
  pedidos: Pedido[];
  situacao: SituacaoCliente;
  ultimaConversaEm: number;
};

/** Agrupa conversas e pedidos por telefone, uma vez, para a lista inteira. */
export function indexarClientes(
  clientes: Cliente[],
  conversas: Conversa[],
  pedidos: Pedido[],
): Map<string, IndiceCliente> {
  const conversasPorFim = new Map<string, Conversa[]>();
  for (const c of conversas) {
    const fim = fimDoTelefone(c.telefone);
    if (fim.length < 8) continue;
    const lista = conversasPorFim.get(fim);
    if (lista) lista.push(c);
    else conversasPorFim.set(fim, [c]);
  }
  const pedidosPorFim = new Map<string, Pedido[]>();
  for (const p of pedidos) {
    const fim = fimDoTelefone(p.telefone);
    if (fim.length < 8) continue;
    const lista = pedidosPorFim.get(fim);
    if (lista) lista.push(p);
    else pedidosPorFim.set(fim, [p]);
  }

  const indice = new Map<string, IndiceCliente>();
  for (const cliente of clientes) {
    const fim = fimDoTelefone(cliente.telefone);
    const suasConversas = (conversasPorFim.get(fim) ?? []).sort((a, b) => b.atualizadaEm - a.atualizadaEm);
    const seusPedidos = (pedidosPorFim.get(fim) ?? []).sort((a, b) => b.criadoEm - a.criadoEm);
    indice.set(cliente.id, {
      conversas: suasConversas,
      pedidos: seusPedidos,
      situacao: situacaoDoCliente(cliente, suasConversas, seusPedidos),
      ultimaConversaEm: suasConversas[0]?.atualizadaEm ?? cliente.ultimaMensagemEm ?? 0,
    });
  }
  return indice;
}

export function situacaoDoCliente(
  cliente: Cliente,
  conversas: Conversa[],
  pedidos: Pedido[],
): SituacaoCliente {
  const validos = pedidos.filter((p) => p.status !== "cancelado");
  if (cliente.compras.quantidade > 0 || validos.length > 0) return "comprou";
  if (pedidos.length > 0) return "cancelou";

  const recente = conversas[0];
  if (!recente) return cliente.primeiraMensagemEm > 0 ? "so_conversou" : "sem_contato";
  // A etapa mais avançada entre as conversas: quem chegou ao carrinho uma
  // vez e depois só perguntou horário continua sendo "não fechou".
  const etapas = new Set(conversas.map((c) => c.etapa));
  if (etapas.has("carrinho")) return "nao_fechou";
  if (etapas.has("orcamento")) return "orcou";
  return "so_conversou";
}

/** Etiquetas que aparecem como sugestão. A loja pode criar outras. */
export const ETIQUETAS_SUGERIDAS = [
  "VIP",
  "Uso contínuo",
  "Idoso",
  "Gestante",
  "Entrega",
  "Atacado",
  "Reclamou",
  "Pede sempre à noite",
];
