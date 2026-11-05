import { NextResponse } from "next/server";
import { exigirSessao } from "@/lib/servidor/sessao";
import ExcelJS from "exceljs";
import { cabecalhoDaAba, montarTabela, VERMELHO } from "@/lib/planilha";
import { STATUS_PEDIDO_LABEL, type VisaoLoja } from "@/lib/db/types";
import {
  type PeriodoRelatorio,
  RELATORIOS,
  relatorioAtendimento,
  relatorioClientes,
  relatorioEstoque,
  relatorioProdutos,
  relatorioVendas,
  situacaoDoEstoque,
  type TipoRelatorio,
} from "@/lib/relatorios";

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
  let pedido: { relatorio?: TipoRelatorio; periodo?: PeriodoRelatorio } = {};
  try {
    const corpo = (await request.json()) as Record<string, unknown>;
    // Formato novo: { visao, relatorio, periodo }. O antigo (a visão solta)
    // continua aceito: é o que a visão de rede manda para a planilha completa.
    if (corpo && typeof corpo === "object" && "visao" in corpo) {
      banco = corpo.visao as VisaoLoja;
      pedido = { relatorio: corpo.relatorio as TipoRelatorio, periodo: corpo.periodo as PeriodoRelatorio };
    } else {
      banco = corpo as unknown as VisaoLoja;
    }
  } catch {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  if (pedido.relatorio && pedido.relatorio !== "completo") {
    return relatorioFocado(banco, pedido.relatorio, pedido.periodo);
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

/* ------------------------------------------------------------------
   Relatório de um assunto só
   ------------------------------------------------------------------ */

function dataHora(em: number) {
  return new Date(em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/**
 * A planilha de um relatório da tela, com o mesmo recorte que a prévia
 * mostrou. O período vai escrito no topo de cada aba: quem abrir o arquivo
 * daqui a um mês precisa saber de quando são aqueles números.
 */
async function relatorioFocado(banco: VisaoLoja, tipo: TipoRelatorio, periodo?: PeriodoRelatorio) {
  const definicao = RELATORIOS.find((r) => r.id === tipo);
  if (!definicao) return NextResponse.json({ error: "Relatório desconhecido." }, { status: 400 });
  if (definicao.usaPeriodo && (!periodo || !Number.isFinite(periodo.de) || !Number.isFinite(periodo.ate))) {
    return NextResponse.json({ error: "Período inválido." }, { status: 400 });
  }
  const p = periodo ?? { de: 0, ate: Date.now(), rotulo: "" };

  const v: VisaoLoja = {
    ...banco,
    pedidos: banco.pedidos ?? [],
    conversas: banco.conversas ?? [],
    clientes: (banco.clientes ?? []).map((c) => ({ ...c, nascimento: c.nascimento ?? "" })),
    produtos: banco.produtos ?? [],
  };

  const livro = new ExcelJS.Workbook();
  livro.creator = "MAZUS";
  livro.created = new Date();
  const nomeLoja = (v.loja?.nome || "Preço Baixo").toUpperCase();
  const carimbo = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  const quando = definicao.usaPeriodo
    ? `${p.rotulo}: ${new Date(p.de).toLocaleDateString("pt-BR")} a ${new Date(p.ate).toLocaleDateString("pt-BR")}`
    : "Situação de agora";
  const sub = `${quando}. Gerado em ${carimbo}`;

  const resumoAba = (linhas: (string | number)[][], formato = "#,##0") => {
    const aba = livro.addWorksheet("Resumo", { properties: { tabColor: { argb: VERMELHO } } });
    cabecalhoDaAba(aba, nomeLoja, definicao.titulo, sub, 3);
    montarTabela(
      aba,
      5,
      [
        { titulo: "Indicador", largura: 34 },
        { titulo: "Valor", largura: 18, alinhamento: "right", formato },
        { titulo: "O que é", largura: 52 },
      ],
      linhas,
    );
  };

  if (tipo === "vendas") {
    const r = relatorioVendas(v, p);
    resumoAba(
      [
        ["Vendido (R$)", r.vendido, "Pedidos que não foram cancelados"],
        ["Recebido (R$)", r.recebido, "Desses, os que já estão pagos"],
        ["A receber (R$)", r.aReceber, "Vendido e ainda não pago"],
        ["Pedidos vendidos", r.validos, "Quantidade de pedidos não cancelados"],
        ["Ticket médio (R$)", r.ticket, "Vendido dividido pelo número de pedidos"],
        ["Pelo WhatsApp (R$)", r.whatsapp, "Vendido em pedidos que vieram do WhatsApp"],
        ["No balcão (R$)", r.balcao, "Vendido em pedidos registrados na loja"],
        ["Cancelados", r.cancelados, "Pedidos cancelados no período (fora do vendido)"],
      ],
      "#,##0.00",
    );
    const dias = livro.addWorksheet("Por dia");
    cabecalhoDaAba(dias, nomeLoja, "Vendido por dia", sub, 3);
    montarTabela(
      dias,
      5,
      [
        { titulo: "Dia", largura: 26 },
        { titulo: "Pedidos", largura: 12, alinhamento: "right", formato: "#,##0" },
        { titulo: "Vendido", largura: 16, alinhamento: "right", formato: "R$ #,##0.00" },
      ],
      r.porDia.map((d) => [d.detalhe, d.pedidos, d.total]),
    );
    const aba = livro.addWorksheet("Pedidos");
    cabecalhoDaAba(aba, nomeLoja, "Pedidos do período", sub, 7);
    montarTabela(
      aba,
      5,
      [
        { titulo: "Pedido", largura: 10, alinhamento: "center" },
        { titulo: "Quando", largura: 18 },
        { titulo: "Cliente", largura: 28 },
        { titulo: "Itens", largura: 44 },
        { titulo: "Situação", largura: 22 },
        { titulo: "Pago", largura: 10, alinhamento: "center" },
        { titulo: "Total", largura: 14, alinhamento: "right", formato: "R$ #,##0.00" },
      ],
      r.pedidos.map((x) => [
        x.numero,
        dataHora(x.criadoEm),
        x.cliente,
        x.itens.map((i) => `${i.quantidade}x ${i.nome}`).join(", "),
        STATUS_PEDIDO_LABEL[x.status],
        x.pago ? "sim" : "não",
        x.total,
      ]),
    );
  }

  if (tipo === "produtos") {
    const r = relatorioProdutos(v, p);
    const aba = livro.addWorksheet("Mais vendidos", { properties: { tabColor: { argb: VERMELHO } } });
    cabecalhoDaAba(aba, nomeLoja, definicao.titulo, sub, 5);
    montarTabela(
      aba,
      5,
      [
        { titulo: "Posição", largura: 10, alinhamento: "center" },
        { titulo: "Produto", largura: 44 },
        { titulo: "Unidades", largura: 12, alinhamento: "right", formato: "#,##0" },
        { titulo: "Em pedidos", largura: 12, alinhamento: "right", formato: "#,##0" },
        { titulo: "Vendido", largura: 16, alinhamento: "right", formato: "R$ #,##0.00" },
      ],
      r.ranking.map((x, i) => [i + 1, x.nome, x.quantidade, x.pedidos, x.faturamento]),
    );
    const parados = livro.addWorksheet("Sem venda");
    cabecalhoDaAba(parados, nomeLoja, "No catálogo e sem venda no período", sub, 3);
    montarTabela(
      parados,
      5,
      [
        { titulo: "Produto", largura: 44 },
        { titulo: "Estoque", largura: 12, alinhamento: "right", formato: "#,##0" },
        { titulo: "Preço", largura: 14, alinhamento: "right", formato: "R$ #,##0.00" },
      ],
      r.parados.map((x) => [x.nome, x.estoque, x.preco]),
    );
  }

  if (tipo === "atendimento") {
    const r = relatorioAtendimento(v, p);
    resumoAba([
      ["Conversas", r.total, "Conversas com movimento no período"],
      ["Viraram pedido", r.viraramPedido, "Conversas de quem fez pedido no mesmo período"],
      ["Resolvidas", r.resolvidas, "Já saíram da fila"],
      ["Atendidas pela equipe", r.comEquipe, "Alguém da loja assumiu"],
      ["Só com o agente", r.soAgente, "O agente resolveu sem ninguém assumir"],
      ["Chamaram a equipe", r.chamados, "Farmacêutico, atendente ou reclamação"],
      ["Mensagens", r.mensagens, "Somando cliente, agente e equipe"],
    ]);
    const aba = livro.addWorksheet("Conversas");
    cabecalhoDaAba(aba, nomeLoja, "Conversas do período", sub, 5);
    montarTabela(
      aba,
      5,
      [
        { titulo: "Cliente", largura: 30 },
        { titulo: "Telefone", largura: 20 },
        { titulo: "Última mensagem", largura: 18 },
        { titulo: "Situação", largura: 18 },
        { titulo: "Mensagens", largura: 12, alinhamento: "right", formato: "#,##0" },
      ],
      r.conversas.map((c) => [
        c.cliente,
        c.telefone,
        dataHora(c.atualizadaEm),
        c.status === "resolvida" ? "resolvida" : c.status === "com_atendente" ? "com a equipe" : "com o agente",
        c.mensagens.length,
      ]),
    );
  }

  if (tipo === "clientes") {
    const r = relatorioClientes(v, p);
    resumoAba([
      ["Clientes novos", r.novos.length, "Cadastrados no período"],
      ["Voltaram a comprar", r.voltaram.length, "Já eram clientes e compraram no período"],
      ["Total de clientes", r.total, "Todos os cadastros da loja"],
      ["Autorizaram campanha", r.autorizaram, "Podem receber mensagem de campanha (LGPD)"],
      ["Aniversariantes do mês", r.aniversariantes.length, "Com data de nascimento neste mês"],
    ]);
    const aba = livro.addWorksheet("Novos");
    cabecalhoDaAba(aba, nomeLoja, "Clientes novos no período", sub, 4);
    montarTabela(
      aba,
      5,
      [
        { titulo: "Nome", largura: 32 },
        { titulo: "Telefone", largura: 20 },
        { titulo: "Cadastro", largura: 18 },
        { titulo: "Campanha", largura: 14, alinhamento: "center" },
      ],
      r.novos.map((c) => [c.nome, c.telefone, dataHora(c.criadoEm), c.consentimento ? "autorizou" : "não"]),
    );
  }

  if (tipo === "estoque") {
    const r = relatorioEstoque(v);
    const aba = livro.addWorksheet("Estoque", { properties: { tabColor: { argb: VERMELHO } } });
    cabecalhoDaAba(aba, nomeLoja, definicao.titulo, sub, 6);
    montarTabela(
      aba,
      5,
      [
        { titulo: "Produto", largura: 44 },
        { titulo: "Categoria", largura: 18 },
        { titulo: "Estoque", largura: 12, alinhamento: "right", formato: "#,##0" },
        { titulo: "Mínimo", largura: 12, alinhamento: "right", formato: "#,##0" },
        { titulo: "Situação", largura: 14, alinhamento: "center" },
        { titulo: "Valor de venda", largura: 16, alinhamento: "right", formato: "R$ #,##0.00" },
      ],
      r.itens.map((x) => [x.nome, x.categoria, x.estoque, x.estoqueMinimo, situacaoDoEstoque(x), Math.max(0, x.estoque) * x.preco]),
    );
  }

  const buffer = await livro.xlsx.writeBuffer();
  const arquivo = `${tipo}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${arquivo}"`,
      "Cache-Control": "no-store",
    },
  });
}
