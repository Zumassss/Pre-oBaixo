import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { STATUS_PEDIDO_LABEL, type Pedido, type StatusPedido } from "@/lib/db/types";
import { cabecalhoDaAba, montarTabela, VERMELHO } from "@/lib/planilha";

export const runtime = "nodejs";

/** Teto de linhas: um ano de uma loja movimentada cabe com folga. */
const MAXIMO = 20000;

const MOEDA = '"R$" #,##0.00';
const FUSO = "America/Sao_Paulo";

function texto(v: unknown, max = 200) {
  return typeof v === "string" ? v.slice(0, max) : "";
}
function numero(v: unknown) {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}
function dia(em: number) {
  return new Date(em).toLocaleDateString("pt-BR", { timeZone: FUSO });
}
function hora(em: number) {
  return new Date(em).toLocaleTimeString("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" });
}

/**
 * A planilha do histórico de pedidos, exatamente com o que está filtrado na
 * tela. O navegador manda os pedidos (já carregados do banco) e a descrição
 * dos filtros, que vai no topo de cada aba para ninguém confundir a planilha
 * do mês com a do ano.
 */
export async function POST(request: Request) {
  let corpo: Record<string, unknown>;
  try {
    corpo = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const loja = texto(corpo.loja, 80);
  const filtros = texto(corpo.filtros, 400);
  const brutos = Array.isArray(corpo.pedidos) ? corpo.pedidos.slice(0, MAXIMO) : [];
  const pedidos = brutos.filter((p): p is Pedido => typeof p === "object" && p !== null) as Pedido[];

  const livro = new ExcelJS.Workbook();
  livro.creator = "Preço Baixo · MAZUS";
  livro.created = new Date();

  // Pedidos, um por linha.
  const aba = livro.addWorksheet("Pedidos", { properties: { tabColor: { argb: VERMELHO } } });
  cabecalhoDaAba(aba, loja, "Histórico de pedidos", filtros, 13);
  montarTabela(
    aba,
    5,
    [
      { titulo: "Nº", largura: 7, alinhamento: "center" },
      { titulo: "Data", largura: 12, alinhamento: "center" },
      { titulo: "Hora", largura: 8, alinhamento: "center" },
      { titulo: "Cliente", largura: 26 },
      { titulo: "Telefone", largura: 17 },
      { titulo: "Origem", largura: 11 },
      { titulo: "Entrega", largura: 11 },
      { titulo: "Situação", largura: 20 },
      { titulo: "Itens", largura: 48 },
      { titulo: "Subtotal", largura: 12, alinhamento: "right", formato: MOEDA },
      { titulo: "Entrega (R$)", largura: 12, alinhamento: "right", formato: MOEDA },
      { titulo: "Total", largura: 12, alinhamento: "right", formato: MOEDA },
      { titulo: "Pago", largura: 7, alinhamento: "center" },
    ],
    pedidos.map((p) => [
      numero(p.numero),
      dia(numero(p.criadoEm)),
      hora(numero(p.criadoEm)),
      texto(p.cliente, 80),
      texto(p.telefone, 30),
      p.origem === "whatsapp" ? "WhatsApp" : "Balcão",
      p.formaEntrega === "entrega" ? "Motoboy" : "Retirada",
      STATUS_PEDIDO_LABEL[p.status as StatusPedido] ?? texto(p.status, 30),
      (Array.isArray(p.itens) ? p.itens : []).map((i) => `${numero(i.quantidade)}x ${texto(i.nome, 80)}`).join("; "),
      numero(p.subtotal),
      numero(p.taxaEntrega),
      numero(p.total),
      p.pago ? "Sim" : "Não",
    ]),
  );

  // Itens, um por linha: é o que permite tabela dinâmica por produto.
  const itens = livro.addWorksheet("Itens");
  cabecalhoDaAba(itens, loja, "Itens vendidos", filtros, 8);
  const linhasItens: (string | number)[][] = [];
  for (const p of pedidos) {
    for (const i of Array.isArray(p.itens) ? p.itens : []) {
      linhasItens.push([
        numero(p.numero),
        dia(numero(p.criadoEm)),
        texto(p.cliente, 80),
        texto(i.nome, 120),
        numero(i.quantidade),
        numero(i.precoUnitario),
        numero(i.quantidade) * numero(i.precoUnitario),
        STATUS_PEDIDO_LABEL[p.status as StatusPedido] ?? "",
      ]);
    }
  }
  montarTabela(
    itens,
    5,
    [
      { titulo: "Pedido", largura: 8, alinhamento: "center" },
      { titulo: "Data", largura: 12, alinhamento: "center" },
      { titulo: "Cliente", largura: 26 },
      { titulo: "Produto", largura: 42 },
      { titulo: "Qtd.", largura: 7, alinhamento: "center" },
      { titulo: "Preço", largura: 12, alinhamento: "right", formato: MOEDA },
      { titulo: "Total", largura: 12, alinhamento: "right", formato: MOEDA },
      { titulo: "Situação", largura: 20 },
    ],
    linhasItens,
  );

  // Resumo por dia e por produto, sem cancelados.
  const validos = pedidos.filter((p) => p.status !== "cancelado");
  const porDia = new Map<string, { pedidos: number; total: number }>();
  for (const p of validos) {
    const chave = new Date(numero(p.criadoEm)).toLocaleDateString("en-CA", { timeZone: FUSO });
    const atual = porDia.get(chave) ?? { pedidos: 0, total: 0 };
    atual.pedidos++;
    atual.total += numero(p.total);
    porDia.set(chave, atual);
  }
  const porProduto = new Map<string, { quantidade: number; total: number }>();
  for (const p of validos) {
    for (const i of Array.isArray(p.itens) ? p.itens : []) {
      const atual = porProduto.get(texto(i.nome, 120)) ?? { quantidade: 0, total: 0 };
      atual.quantidade += numero(i.quantidade);
      atual.total += numero(i.quantidade) * numero(i.precoUnitario);
      porProduto.set(texto(i.nome, 120), atual);
    }
  }

  const resumo = livro.addWorksheet("Resumo por dia");
  cabecalhoDaAba(resumo, loja, "Faturamento por dia (sem cancelados)", filtros, 4);
  montarTabela(
    resumo,
    5,
    [
      { titulo: "Dia", largura: 14, alinhamento: "center" },
      { titulo: "Pedidos", largura: 10, alinhamento: "center" },
      { titulo: "Faturamento", largura: 16, alinhamento: "right", formato: MOEDA },
      { titulo: "Ticket médio", largura: 16, alinhamento: "right", formato: MOEDA },
    ],
    [...porDia.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([d, v]) => [d.split("-").reverse().join("/"), v.pedidos, v.total, v.pedidos ? v.total / v.pedidos : 0]),
  );

  const produtos = livro.addWorksheet("Por produto");
  cabecalhoDaAba(produtos, loja, "Produtos vendidos (sem cancelados)", filtros, 3);
  montarTabela(
    produtos,
    5,
    [
      { titulo: "Produto", largura: 44 },
      { titulo: "Quantidade", largura: 12, alinhamento: "center" },
      { titulo: "Faturamento", largura: 16, alinhamento: "right", formato: MOEDA },
    ],
    [...porProduto.entries()].sort((a, b) => b[1].total - a[1].total).map(([n, v]) => [n, v.quantidade, v.total]),
  );

  const buffer = await livro.xlsx.writeBuffer();
  const nome = `historico-pedidos-${new Date().toLocaleDateString("en-CA", { timeZone: FUSO })}.xlsx`;
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nome}"`,
    },
  });
}
