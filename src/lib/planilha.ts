import type ExcelJS from "exceljs";

/**
 * A cara das planilhas do sistema: faixa vermelha com o nome da loja,
 * cabeçalho escuro, zebra nas linhas, filtro e cabeçalho congelado. Usada
 * pelo relatório geral e pelo histórico de pedidos, para as duas saírem
 * iguais.
 */

/* Paleta da marca aplicada à planilha. O ARGB do ExcelJS não usa "#". */
export const VERMELHO = "FFFF1741";
const VERMELHO_ESCURO = "FFC00527";
const GRAFITE = "FF16161C";
const CINZA_LINHA = "FFF6F6F8";
const BORDA = "FFE4E4EA";

export type Alinhamento = "left" | "center" | "right";
export type Coluna = {
  titulo: string;
  largura: number;
  alinhamento?: Alinhamento;
  formato?: string;
};

export function cabecalhoDaAba(
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

export function montarTabela(
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

