import { NextResponse } from "next/server";
import { exigirSessao } from "@/lib/servidor/sessao";
import ExcelJS from "exceljs";
import { cabecalhoDaAba, montarTabela, VERMELHO } from "@/lib/planilha";
import { STATUS_PEDIDO_LABEL, type VisaoLoja } from "@/lib/db/types";

export const runtime = "nodejs";

function data(em: number) {
  return new Date(em).toLocaleDateString("pt-BR");
}

/**
 * Gera a planilha a partir dos dados enviados pelo navegador.
 *
 * O navegador já tem os dados na tela (carregados do banco) e manda o que
 * quer na planilha; o servidor só formata.
 */
export async function POST(request: Request) {
  const sessao = await exigirSessao(request);
  if (sessao instanceof NextResponse) return sessao;
  let banco: VisaoLoja;
  try {
    banco = (await request.json()) as VisaoLoja;
  } catch {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  // Um navegador com dado de versão anterior pode não ter pedidos ainda.
  const pedidos = banco.pedidos ?? [];

  const livro = new ExcelJS.Workbook();
  livro.creator = "MAZUS";
  livro.company = banco.loja?.nome || "Preço Baixo";
  livro.created = new Date();

  const nomeLoja = (banco.loja?.nome || "Preço Baixo").toUpperCase();
  const carimbo = new Date().toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
  const endereco = [banco.loja?.endereco, banco.loja?.bairro, banco.loja?.cidade]
    .filter(Boolean)
    .join(", ");

  /* ---------- Resumo ---------- */
  const resumo = livro.addWorksheet("Resumo", {
    properties: { tabColor: { argb: VERMELHO } },
  });
  cabecalhoDaAba(
    resumo,
    nomeLoja,
    "Resumo da loja",
    `${endereco || "Endereço não cadastrado"}. Gerado em ${carimbo}`,
    3,
  );
  montarTabela(
    resumo,
    5,
    [
      { titulo: "Indicador", largura: 34 },
      { titulo: "Valor", largura: 16, alinhamento: "right", formato: "#,##0" },
      { titulo: "Observação", largura: 46 },
    ],
    [
      [
        "Clientes cadastrados",
        banco.clientes.length,
        `${banco.clientes.filter((c) => c.consentimento).length} autorizaram contato`,
      ],
      [
        "Produtos no catálogo",
        banco.produtos.length,
        `${banco.produtos.filter((p) => p.estoque < p.estoqueMinimo).length} abaixo do estoque mínimo`,
      ],
      [
        "Conversas registradas",
        banco.conversas.length,
        `${banco.conversas.filter((c) => c.status !== "resolvida").length} ainda em aberto`,
      ],
      [
        "Pedidos registrados",
        pedidos.length,
        `${pedidos.filter((p) => p.status !== "entregue" && p.status !== "cancelado").length} ainda em aberto`,
      ],
      [
        "Faturamento entregue e pago",
        pedidos
          .filter((p) => p.status === "entregue" && p.pago)
          .reduce((soma, p) => soma + p.total, 0),
        "Soma dos pedidos que saíram da loja e foram pagos",
      ],
      [
        "Campanhas criadas",
        banco.campanhas.length,
        `${banco.campanhas.filter((c) => c.status === "enviada").length} já enviadas`,
      ],
      [
        "Interações com o agente",
        banco.eventos.length,
        "Perguntas e respostas registradas no sistema",
      ],
      [
        "WhatsApp",
        banco.whatsappConectado ? 1 : 0,
        banco.whatsappConectado ? "Canal conectado" : "Canal ainda não conectado",
      ],
    ],
  );

  /* ---------- Clientes ---------- */
  const clientes = livro.addWorksheet("Clientes");
  cabecalhoDaAba(clientes, nomeLoja, "Clientes", `Gerado em ${carimbo}`, 4);
  montarTabela(
    clientes,
    5,
    [
      { titulo: "Nome", largura: 32 },
      { titulo: "Telefone", largura: 20 },
      { titulo: "Endereço", largura: 36 },
      { titulo: "Consentimento", largura: 18, alinhamento: "center" },
      { titulo: "Cadastro", largura: 14, alinhamento: "center" },
    ],
    banco.clientes.map((c) => [
      c.nome,
      c.telefone,
      c.endereco || "",
      c.consentimento ? "autorizado" : "sem opt-in",
      data(c.criadoEm),
    ]),
  );

  /* ---------- Produtos ---------- */
  const produtos = livro.addWorksheet("Produtos");
  cabecalhoDaAba(produtos, nomeLoja, "Catálogo", `Gerado em ${carimbo}`, 6);
  montarTabela(
    produtos,
    5,
    [
      { titulo: "Produto", largura: 40 },
      { titulo: "Categoria", largura: 18 },
      { titulo: "Estoque", largura: 12, alinhamento: "right", formato: "#,##0" },
      { titulo: "Mínimo", largura: 12, alinhamento: "right", formato: "#,##0" },
      { titulo: "Receita", largura: 12, alinhamento: "center" },
      { titulo: "Preço", largura: 14, alinhamento: "right", formato: "R$ #,##0.00" },
    ],
    banco.produtos.map((p) => [
      p.nome,
      p.categoria,
      p.estoque,
      p.estoqueMinimo,
      p.exigeReceita ? "sim" : "não",
      p.preco,
    ]),
  );

  /* ---------- Conversas ---------- */
  const conversas = livro.addWorksheet("Conversas");
  cabecalhoDaAba(conversas, nomeLoja, "Conversas", `Gerado em ${carimbo}`, 5);
  montarTabela(
    conversas,
    5,
    [
      { titulo: "Cliente", largura: 30 },
      { titulo: "Telefone", largura: 20 },
      { titulo: "Status", largura: 18, alinhamento: "center" },
      { titulo: "Mensagens", largura: 14, alinhamento: "right", formato: "#,##0" },
      { titulo: "Atualizada", largura: 16, alinhamento: "center" },
    ],
    banco.conversas.map((c) => [
      c.cliente,
      c.telefone,
      c.status === "com_atendente" ? "com atendente" : c.status,
      c.mensagens.length,
      data(c.atualizadaEm),
    ]),
  );

  /* ---------- Pedidos ---------- */
  const abaPedidos = livro.addWorksheet("Pedidos");
  cabecalhoDaAba(abaPedidos, nomeLoja, "Pedidos", `Gerado em ${carimbo}`, 8);
  montarTabela(
    abaPedidos,
    5,
    [
      { titulo: "Pedido", largura: 10, alinhamento: "center" },
      { titulo: "Cliente", largura: 28 },
      { titulo: "Telefone", largura: 18 },
      { titulo: "Origem", largura: 12, alinhamento: "center" },
      { titulo: "Itens", largura: 40 },
      { titulo: "Status", largura: 22, alinhamento: "center" },
      { titulo: "Entrega", largura: 14, alinhamento: "center" },
      { titulo: "Endereço", largura: 34 },
      { titulo: "Pagamento", largura: 16, alinhamento: "center" },
      {
        titulo: "Taxa",
        largura: 11,
        alinhamento: "right",
        formato: 'R$ #,##0.00',
      },
      {
        titulo: "Total",
        largura: 14,
        alinhamento: "right",
        formato: 'R$ #,##0.00',
      },
    ],
    pedidos.map((p) => [
      p.numero,
      p.cliente,
      p.telefone || "sem telefone",
      p.origem === "whatsapp" ? "WhatsApp" : "Balcão",
      p.itens.map((i) => `${i.quantidade}x ${i.nome}`).join(", "),
      STATUS_PEDIDO_LABEL[p.status],
      p.formaEntrega === "entrega" ? "Motoboy" : "Retirada",
      p.enderecoEntrega || "",
      p.pago
        ? "pago"
        : p.formaPagamento === "pix"
          ? "pix pendente"
          : p.formaEntrega === "entrega"
            ? "na entrega"
            : "na retirada",
      p.taxaEntrega ?? 0,
      p.total,
    ]),
  );

  /* ---------- Campanhas ---------- */
  const campanhas = livro.addWorksheet("Campanhas");
  cabecalhoDaAba(campanhas, nomeLoja, "Campanhas", `Gerado em ${carimbo}`, 4);
  montarTabela(
    campanhas,
    5,
    [
      { titulo: "Campanha", largura: 36 },
      { titulo: "Status", largura: 14, alinhamento: "center" },
      { titulo: "Agendada", largura: 20 },
      { titulo: "Criada", largura: 14, alinhamento: "center" },
    ],
    banco.campanhas.map((c) => [
      c.nome,
      c.status,
      c.agendadaPara || "sem data",
      data(c.criadoEm),
    ]),
  );

  const buffer = await livro.xlsx.writeBuffer();
  const arquivo = `relatorio-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${arquivo}"`,
      "Cache-Control": "no-store",
    },
  });
}
