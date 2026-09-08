import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { stores } from "@/lib/mock/stores";
import { products } from "@/lib/mock/catalog";
import { campaigns } from "@/lib/mock/crm";
import { hourlyVolume, revenueByDay } from "@/lib/mock/metrics";

export const runtime = "nodejs";

/* Paleta da marca aplicada à planilha. O ARGB do ExcelJS não usa "#". */
const VERMELHO = "FFFF1741";
const VERMELHO_ESCURO = "FFC00527";
const GRAFITE = "FF16161C";
const CINZA_LINHA = "FFF6F6F8";
const BORDA = "FFE4E4EA";

type Alinhamento = "left" | "center" | "right";

function cabecalhoDaAba(
  aba: ExcelJS.Worksheet,
  titulo: string,
  subtitulo: string,
  colunas: number,
) {
  aba.mergeCells(1, 1, 1, colunas);
  const t = aba.getCell(1, 1);
  t.value = "PREÇO BAIXO FARMÁCIAS";
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
  colunas: { titulo: string; largura: number; alinhamento?: Alinhamento; formato?: string }[],
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
      indent: c.alinhamento === "left" || !c.alinhamento ? 1 : 0,
    };
    cel.border = {
      top: { style: "thin", color: { argb: BORDA } },
      bottom: { style: "thin", color: { argb: BORDA } },
      left: { style: "thin", color: { argb: BORDA } },
      right: { style: "thin", color: { argb: BORDA } },
    };
  });
  cabecalho.height = 22;

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
      cel.border = {
        bottom: { style: "hair", color: { argb: BORDA } },
      };
    });
  });

  // Congela o cabeçalho e liga o filtro automático.
  aba.views = [{ state: "frozen", ySplit: linhaInicial }];
  aba.autoFilter = {
    from: { row: linhaInicial, column: 1 },
    to: { row: linhaInicial + linhas.length, column: colunas.length },
  };
}

export async function GET() {
  const livro = new ExcelJS.Workbook();
  livro.creator = "MAZUS";
  livro.company = "Preço Baixo Farmácias";
  livro.created = new Date();

  const carimbo = new Date().toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });

  /* ---------- Resumo ---------- */
  const resumo = livro.addWorksheet("Resumo", {
    properties: { tabColor: { argb: VERMELHO } },
  });
  cabecalhoDaAba(resumo, "Resumo da operação", `Gerado em ${carimbo}`, 4);
  montarTabela(
    resumo,
    5,
    [
      { titulo: "Indicador", largura: 34 },
      { titulo: "Valor", largura: 16, alinhamento: "right" },
      { titulo: "Variação", largura: 14, alinhamento: "right" },
      { titulo: "Observação", largura: 40 },
    ],
    [
      ["Conversas atendidas", 4318, "18,4%", "Atendidas pelo agente no período"],
      ["Resolvido sem humano", "87,2%", "6,1%", "Meta da rede é 80%"],
      ["Tempo médio de resposta", "8s", "-42,5%", "Média humana era 4 min"],
      ["Receita influenciada", 186400, "24,7%", "Pedidos originados no WhatsApp"],
      ["Ticket médio", 74.2, "3,1%", "Por pedido via agente"],
      ["Unidades conectadas", stores.filter((s) => s.status === "online").length, "", `De ${stores.length} no total`],
    ],
  );
  resumo.getColumn(2).numFmt = "#,##0.00";

  /* ---------- Unidades ---------- */
  const unidades = livro.addWorksheet("Unidades");
  cabecalhoDaAba(unidades, "Desempenho por unidade", `Gerado em ${carimbo}`, 6);
  montarTabela(
    unidades,
    5,
    [
      { titulo: "Unidade", largura: 28 },
      { titulo: "Cidade", largura: 22 },
      { titulo: "Status", largura: 14, alinhamento: "center" },
      { titulo: "Conversas", largura: 14, alinhamento: "right", formato: "#,##0" },
      { titulo: "Pedidos", largura: 12, alinhamento: "right", formato: "#,##0" },
      { titulo: "Conversão", largura: 14, alinhamento: "right", formato: "0.0%" },
    ],
    stores.map((s) => [
      s.name,
      s.city,
      s.status === "atencao" ? "atenção" : s.status,
      s.conversas,
      s.pedidos,
      s.conversas ? s.pedidos / s.conversas : 0,
    ]),
  );

  /* ---------- Produtos ---------- */
  const catalogo = livro.addWorksheet("Produtos");
  cabecalhoDaAba(catalogo, "Produtos mais consultados", `Gerado em ${carimbo}`, 6);
  montarTabela(
    catalogo,
    5,
    [
      { titulo: "Produto", largura: 40 },
      { titulo: "Categoria", largura: 18 },
      { titulo: "Consultas", largura: 13, alinhamento: "right", formato: "#,##0" },
      { titulo: "Estoque", largura: 12, alinhamento: "right", formato: "#,##0" },
      { titulo: "Mínimo", largura: 12, alinhamento: "right", formato: "#,##0" },
      { titulo: "Preço", largura: 14, alinhamento: "right", formato: 'R$ #,##0.00' },
    ],
    products.map((p) => [
      p.name,
      p.category,
      p.askedTimes,
      p.stock,
      p.minStock,
      p.price,
    ]),
  );

  /* ---------- Campanhas ---------- */
  const campanhas = livro.addWorksheet("Campanhas");
  cabecalhoDaAba(campanhas, "Campanhas do período", `Gerado em ${carimbo}`, 6);
  montarTabela(
    campanhas,
    5,
    [
      { titulo: "Campanha", largura: 38 },
      { titulo: "Status", largura: 14, alinhamento: "center" },
      { titulo: "Público", largura: 13, alinhamento: "right", formato: "#,##0" },
      { titulo: "Abertura", largura: 13, alinhamento: "right", formato: "0.0%" },
      { titulo: "Conversão", largura: 13, alinhamento: "right", formato: "0.0%" },
      { titulo: "Receita", largura: 16, alinhamento: "right", formato: 'R$ #,##0.00' },
    ],
    campaigns.map((c) => [
      c.name,
      c.status,
      c.audience,
      c.sent ? c.opened / c.sent : 0,
      c.sent ? c.converted / c.sent : 0,
      c.revenue,
    ]),
  );

  /* ---------- Séries ---------- */
  const series = livro.addWorksheet("Séries");
  cabecalhoDaAba(series, "Volume por hora e receita por dia", `Gerado em ${carimbo}`, 4);
  montarTabela(
    series,
    5,
    [
      { titulo: "Hora", largura: 12, alinhamento: "center" },
      { titulo: "Mensagens", largura: 15, alinhamento: "right", formato: "#,##0" },
      { titulo: "Dia", largura: 12, alinhamento: "center" },
      { titulo: "Receita", largura: 16, alinhamento: "right", formato: 'R$ #,##0.00' },
    ],
    hourlyVolume.map((h, i) => [
      h.hour,
      h.value,
      revenueByDay[i]?.day ?? "",
      revenueByDay[i]?.value ?? "",
    ]),
  );

  const buffer = await livro.xlsx.writeBuffer();
  const arquivo = `preco-baixo-relatorio-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${arquivo}"`,
      "Cache-Control": "no-store",
    },
  });
}
