import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { STATUS_PEDIDO_LABEL, type BancoLocal } from "@/lib/db/types";

export const runtime = "nodejs";

/* Paleta da marca aplicada à planilha. O ARGB do ExcelJS não usa "#". */
const VERMELHO = "FFFF1741";
const VERMELHO_ESCURO = "FFC00527";
const GRAFITE = "FF16161C";
const CINZA_LINHA = "FFF6F6F8";
const BORDA = "FFE4E4EA";

type Alinhamento = "left" | "center" | "right";
type Coluna = {
  titulo: string;
  largura: number;
  alinhamento?: Alinhamento;
  formato?: string;
};

function cabecalhoDaAba(
  aba: ExcelJS.Worksheet,
  loja: string,
  titulo: string,
  subtitulo: string,
  colunas: number,
) {
  aba.mergeCells(1, 1, 1, colunas);
  const t = aba.getCell(1, 1);
  t.value = loja || "PREÇO BAIXO";
  t.font = { name: "Calibri", size: 16, bold: true, color: { argb: "FFFFFFFF" } };
  t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERMELHO } };
  t.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  aba.getRow(1).height = 30;

  aba.mergeCells(2, 1, 2, colunas);
  const s = aba.getCell(2, 1);
  s.value = titulo;
  s.font = { name: "Calibri", size: 12, bold: true, color: { argb: "FFFFFFFF" } };
  s.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRAFITE } };
  s.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  aba.getRow(2).height = 22;

  aba.mergeCells(3, 1, 3, colunas);
  const d = aba.getCell(3, 1);
  d.value = subtitulo;
  d.font = { name: "Calibri", size: 9, italic: true, color: { argb: "FF6A6A77" } };
  d.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  aba.getRow(3).height = 18;

  aba.getRow(4).height = 6;
}

function montarTabela(
  aba: ExcelJS.Worksheet,
  linhaInicial: number,
  colunas: Coluna[],
  linhas: (string | number)[][],
) {
  colunas.forEach((c, i) => {
    aba.getColumn(i + 1).width = c.largura;
  });

  const cabecalho = aba.getRow(linhaInicial);
  colunas.forEach((c, i) => {
    const cel = cabecalho.getCell(i + 1);
    cel.value = c.titulo;
    cel.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERMELHO_ESCURO } };
    cel.alignment = {
      vertical: "middle",
      horizontal: c.alinhamento ?? "left",
      indent: (c.alinhamento ?? "left") === "left" ? 1 : 0,
    };
    cel.border = {
      top: { style: "thin", color: { argb: BORDA } },
      bottom: { style: "thin", color: { argb: BORDA } },
      left: { style: "thin", color: { argb: BORDA } },
      right: { style: "thin", color: { argb: BORDA } },
    };
  });
  cabecalho.height = 22;

  if (linhas.length === 0) {
    // Uma planilha com aba vazia confunde. Deixamos dito que está vazio.
    aba.mergeCells(linhaInicial + 1, 1, linhaInicial + 1, colunas.length);
    const vazio = aba.getCell(linhaInicial + 1, 1);
    vazio.value = "Nenhum registro cadastrado até agora.";
    vazio.font = {
      name: "Calibri",
      size: 10,
      italic: true,
      color: { argb: "FF8A8A96" },
    };
    vazio.alignment = { vertical: "middle", horizontal: "center" };
    aba.getRow(linhaInicial + 1).height = 26;
    return;
  }

  linhas.forEach((linha, indice) => {
    const row = aba.getRow(linhaInicial + 1 + indice);
    row.height = 19;
    linha.forEach((valor, i) => {
      const cel = row.getCell(i + 1);
      cel.value = valor;
      cel.font = { name: "Calibri", size: 10, color: { argb: "FF16161C" } };
      cel.alignment = {
        vertical: "middle",
        horizontal: colunas[i]?.alinhamento ?? "left",
        indent: (colunas[i]?.alinhamento ?? "left") === "left" ? 1 : 0,
      };
      if (colunas[i]?.formato) cel.numFmt = colunas[i].formato!;
      // Zebra: a leitura de tabela larga fica bem mais fácil.
      if (indice % 2 === 1) {
        cel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CINZA_LINHA } };
      }
      cel.border = { bottom: { style: "hair", color: { argb: BORDA } } };
    });
  });

  aba.views = [{ state: "frozen", ySplit: linhaInicial }];
  aba.autoFilter = {
    from: { row: linhaInicial, column: 1 },
    to: { row: linhaInicial + linhas.length, column: colunas.length },
  };
}

function data(em: number) {
  return new Date(em).toLocaleDateString("pt-BR");
}

/**
 * Gera a planilha a partir dos dados enviados pelo navegador.
 *
 * Os cadastros ficam no armazenamento local do cliente enquanto não há
 * banco, então é o cliente quem manda o conteúdo. Quando o banco existir,
 * esta rota passa a ler do servidor e o corpo da requisição some.
 */
export async function POST(request: Request) {
  let banco: BancoLocal;
  try {
    banco = (await request.json()) as BancoLocal;
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
      { titulo: "Consentimento", largura: 18, alinhamento: "center" },
      { titulo: "Cadastro", largura: 14, alinhamento: "center" },
    ],
    banco.clientes.map((c) => [
      c.nome,
      c.telefone,
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
      { titulo: "Pagamento", largura: 16, alinhamento: "center" },
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
      p.pago
        ? "pago"
        : p.formaPagamento === "pix"
          ? "pix pendente"
          : "na retirada",
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
