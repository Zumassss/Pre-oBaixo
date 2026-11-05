import { fimDoTelefone } from "@/lib/clientes";
import type { Conversa, Pedido, Produto, VisaoLoja } from "@/lib/db/types";

/**
 * As contas dos relatórios, num lugar só.
 *
 * A tela mostra a prévia e o servidor monta a planilha a partir das mesmas
 * funções. Antes eram contas separadas: a tela mostrava o período escolhido
 * e a planilha saía com tudo desde sempre, e ninguém sabia o que estava
 * baixando.
 *
 * Duas palavras com sentido fixo em todo o sistema:
 * - Vendido: pedidos que não foram cancelados.
 * - Recebido: desses, os que já estão pagos.
 */

export type TipoRelatorio = "vendas" | "produtos" | "atendimento" | "estoque" | "clientes" | "completo";

export type PeriodoRelatorio = { de: number; ate: number; rotulo: string };

export const RELATORIOS: { id: TipoRelatorio; titulo: string; pergunta: string; usaPeriodo: boolean }[] = [
  { id: "vendas", titulo: "Vendas", pergunta: "Quanto a loja vendeu e recebeu", usaPeriodo: true },
  { id: "produtos", titulo: "Produtos mais vendidos", pergunta: "O que mais saiu e quanto rendeu", usaPeriodo: true },
  { id: "atendimento", titulo: "Atendimento", pergunta: "Quantas conversas e quantas viraram pedido", usaPeriodo: true },
  { id: "clientes", titulo: "Clientes", pergunta: "Quem é novo, quem voltou, quem autorizou campanha", usaPeriodo: true },
  { id: "estoque", titulo: "Estoque", pergunta: "O que está acabando e quanto há na prateleira", usaPeriodo: false },
  { id: "completo", titulo: "Planilha completa", pergunta: "Todos os cadastros da loja, sem filtro de data", usaPeriodo: false },
];

const DIA = 86_400_000;

export function dentro(em: number, p: PeriodoRelatorio) {
  return em >= p.de && em <= p.ate;
}

function diaIso(em: number) {
  const d = new Date(em);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------
   Vendas
   ------------------------------------------------------------------ */

export function relatorioVendas(v: VisaoLoja, p: PeriodoRelatorio) {
  const doPeriodo = v.pedidos.filter((x) => dentro(x.criadoEm, p)).sort((a, b) => b.criadoEm - a.criadoEm);
  const validos = doPeriodo.filter((x) => x.status !== "cancelado");
  const vendido = validos.reduce((s, x) => s + x.total, 0);
  const recebido = validos.filter((x) => x.pago).reduce((s, x) => s + x.total, 0);
  const cancelados = doPeriodo.filter((x) => x.status === "cancelado");

  // Um ponto por dia do período, inclusive os dias sem venda: um buraco no
  // gráfico é informação.
  const porDia: { chave: string; rotulo: string; detalhe: string; total: number; pedidos: number }[] = [];
  const inicio = new Date(p.de);
  inicio.setHours(0, 0, 0, 0);
  for (let t = inicio.getTime(); t <= p.ate; t += DIA) {
    const chave = diaIso(t);
    const doDia = validos.filter((x) => diaIso(x.criadoEm) === chave);
    const d = new Date(t);
    porDia.push({
      chave,
      rotulo: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      detalhe: d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" }),
      total: doDia.reduce((s, x) => s + x.total, 0),
      pedidos: doDia.length,
    });
  }

  const soma = (lista: Pedido[]) => lista.reduce((s, x) => s + x.total, 0);
  return {
    pedidos: doPeriodo,
    validos: validos.length,
    vendido,
    recebido,
    aReceber: vendido - recebido,
    ticket: validos.length ? vendido / validos.length : 0,
    cancelados: cancelados.length,
    valorCancelado: soma(cancelados),
    porDia,
    whatsapp: soma(validos.filter((x) => x.origem === "whatsapp")),
    balcao: soma(validos.filter((x) => x.origem !== "whatsapp")),
    entregas: validos.filter((x) => x.formaEntrega === "entrega").length,
  };
}

/* ------------------------------------------------------------------
   Produtos mais vendidos
   ------------------------------------------------------------------ */

export function relatorioProdutos(v: VisaoLoja, p: PeriodoRelatorio) {
  const validos = v.pedidos.filter((x) => dentro(x.criadoEm, p) && x.status !== "cancelado");
  const mapa = new Map<string, { nome: string; quantidade: number; faturamento: number; pedidos: number }>();
  for (const pedido of validos) {
    for (const item of pedido.itens) {
      const chave = item.produtoId || item.nome;
      const atual = mapa.get(chave) ?? { nome: item.nome, quantidade: 0, faturamento: 0, pedidos: 0 };
      atual.quantidade += item.quantidade;
      atual.faturamento += item.quantidade * item.precoUnitario;
      atual.pedidos += 1;
      mapa.set(chave, atual);
    }
  }
  const ranking = [...mapa.values()].sort((a, b) => b.quantidade - a.quantidade || b.faturamento - a.faturamento);
  return {
    ranking,
    unidades: ranking.reduce((s, x) => s + x.quantidade, 0),
    faturamento: ranking.reduce((s, x) => s + x.faturamento, 0),
    // O que está no catálogo e não vendeu nada no período.
    parados: v.produtos.filter((prod) => !mapa.has(prod.id) && !mapa.has(prod.nome)),
  };
}

/* ------------------------------------------------------------------
   Atendimento
   ------------------------------------------------------------------ */

export function relatorioAtendimento(v: VisaoLoja, p: PeriodoRelatorio) {
  const conversas: Conversa[] = v.conversas
    .filter((c) => dentro(c.atualizadaEm, p))
    .sort((a, b) => b.atualizadaEm - a.atualizadaEm);
  const comPedido = new Set(
    v.pedidos.filter((x) => dentro(x.criadoEm, p) && x.status !== "cancelado").map((x) => fimDoTelefone(x.telefone)),
  );
  const viraramPedido = conversas.filter((c) => comPedido.has(fimDoTelefone(c.telefone))).length;
  return {
    conversas,
    total: conversas.length,
    resolvidas: conversas.filter((c) => c.status === "resolvida").length,
    comEquipe: conversas.filter((c) => c.status === "com_atendente" || Boolean(c.assumidaPor)).length,
    soAgente: conversas.filter((c) => !c.assumidaPor && c.status !== "com_atendente").length,
    chamados: conversas.filter((c) => c.alerta).length,
    mensagens: conversas.reduce((s, c) => s + c.mensagens.length, 0),
    viraramPedido,
    conversao: conversas.length ? viraramPedido / conversas.length : 0,
  };
}

/* ------------------------------------------------------------------
   Clientes
   ------------------------------------------------------------------ */

export function relatorioClientes(v: VisaoLoja, p: PeriodoRelatorio) {
  const novos = v.clientes.filter((c) => dentro(c.criadoEm, p)).sort((a, b) => b.criadoEm - a.criadoEm);
  const compraramNoPeriodo = new Map<string, number>();
  for (const pedido of v.pedidos) {
    if (!dentro(pedido.criadoEm, p) || pedido.status === "cancelado") continue;
    const fim = fimDoTelefone(pedido.telefone);
    compraramNoPeriodo.set(fim, (compraramNoPeriodo.get(fim) ?? 0) + 1);
  }
  const voltaram = v.clientes.filter(
    (c) => !dentro(c.criadoEm, p) && (compraramNoPeriodo.get(fimDoTelefone(c.telefone)) ?? 0) > 0,
  );
  const mes = new Date().getMonth() + 1;
  const aniversariantes = v.clientes.filter((c) => Number(String(c.nascimento ?? "").split("-")[1]) === mes);
  return {
    novos,
    voltaram,
    total: v.clientes.length,
    autorizaram: v.clientes.filter((c) => c.consentimento).length,
    aniversariantes,
  };
}

/* ------------------------------------------------------------------
   Estoque
   ------------------------------------------------------------------ */

export function situacaoDoEstoque(p: Produto) {
  if (p.estoque <= 0) return "sem estoque";
  if (p.estoque < p.estoqueMinimo) return "repor";
  return "ok";
}

export function relatorioEstoque(v: VisaoLoja) {
  const itens = [...v.produtos].sort(
    (a, b) => a.estoque - a.estoqueMinimo - (b.estoque - b.estoqueMinimo),
  );
  return {
    itens,
    repor: itens.filter((p) => p.estoque > 0 && p.estoque < p.estoqueMinimo),
    zerados: itens.filter((p) => p.estoque <= 0),
    unidades: itens.reduce((s, p) => s + Math.max(0, p.estoque), 0),
    // Pelo preço de venda: a loja não cadastra custo, então é o que a
    // prateleira vale se tudo for vendido, não o que custou.
    valorDeVenda: itens.reduce((s, p) => s + Math.max(0, p.estoque) * p.preco, 0),
  };
}
