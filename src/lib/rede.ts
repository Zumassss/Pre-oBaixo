import {
  type Banco,
  dadosDaLoja,
  type Loja,
  pedidoEmAberto,
  pedidoExigeReceita,
} from "@/lib/db/types";

/**
 * Os números de uma loja, para a visão de rede.
 *
 * O cálculo mora aqui e não na tela porque a mesma conta vai para o
 * comparativo, para os alertas e, um dia, para a planilha. Conta repetida em
 * dois lugares vira dois resultados diferentes.
 */
export type ResumoLoja = {
  loja: Loja;
  /** Só pedido entregue e pago. O resto ainda pode ser cancelado. */
  faturamento: number;
  pedidos: number;
  /** Quantos desses já foram entregues e pagos. */
  pedidosFaturados: number;
  pedidosAbertos: number;
  /** Pedidos parados esperando o farmacêutico conferir a receita. */
  aguardandoReceita: number;
  conversasAbertas: number;
  clientes: number;
  estoqueCritico: number;
  ticketMedio: number;
};

export function resumoDaLoja(
  banco: Banco,
  loja: Loja,
  desde: number,
): ResumoLoja {
  const dados = dadosDaLoja(banco, loja.id);

  const noPeriodo = dados.pedidos.filter((p) => p.criadoEm >= desde);
  const faturados = noPeriodo.filter((p) => p.status === "entregue" && p.pago);
  const faturamento = faturados.reduce((soma, p) => soma + p.total, 0);

  return {
    loja,
    faturamento,
    pedidos: noPeriodo.length,
    pedidosFaturados: faturados.length,
    pedidosAbertos: dados.pedidos.filter(pedidoEmAberto).length,
    aguardandoReceita: dados.pedidos.filter(
      (p) => p.status === "aguardando_receita" && pedidoExigeReceita(p),
    ).length,
    conversasAbertas: dados.conversas.filter((c) => c.status !== "resolvida")
      .length,
    clientes: dados.clientes.length,
    estoqueCritico: dados.produtos.filter((p) => p.estoque < p.estoqueMinimo)
      .length,
    ticketMedio: faturados.length ? faturamento / faturados.length : 0,
  };
}

export function resumoDaRede(banco: Banco, desde: number): ResumoLoja[] {
  return banco.lojas.map((loja) => resumoDaLoja(banco, loja, desde));
}

export type TotaisRede = {
  faturamento: number;
  pedidos: number;
  /** Quantos desses já foram entregues e pagos. */
  pedidosFaturados: number;
  pedidosAbertos: number;
  aguardandoReceita: number;
  conversasAbertas: number;
  clientes: number;
  estoqueCritico: number;
  lojasAtivas: number;
  lojasConfiguradas: number;
  ticketMedio: number;
};

export function totaisDaRede(resumos: ResumoLoja[]): TotaisRede {
  const soma = (campo: keyof ResumoLoja) =>
    resumos.reduce((total, r) => total + (r[campo] as number), 0);

  const faturamento = soma("faturamento");
  // O ticket da rede é faturamento sobre pedidos faturados, não a média das
  // médias: média de média dá o mesmo peso a loja grande e loja pequena.
  const faturados = soma("pedidosFaturados");

  return {
    faturamento,
    pedidos: soma("pedidos"),
    pedidosFaturados: faturados,
    pedidosAbertos: soma("pedidosAbertos"),
    aguardandoReceita: soma("aguardandoReceita"),
    conversasAbertas: soma("conversasAbertas"),
    clientes: soma("clientes"),
    estoqueCritico: soma("estoqueCritico"),
    lojasAtivas: resumos.filter((r) => r.loja.ativa).length,
    lojasConfiguradas: resumos.filter((r) => r.loja.configurada).length,
    ticketMedio: faturados ? faturamento / faturados : 0,
  };
}

/** Um ponto que precisa de decisão de quem administra a rede. */
export type Alerta = {
  id: string;
  gravidade: "alta" | "media";
  loja: Loja;
  titulo: string;
  detalhe: string;
};

/**
 * O que está pedindo atenção agora, em toda a rede.
 *
 * A ordem não é por loja, é por gravidade: receita parada segura a venda e é
 * exigência legal, então vem antes de estoque baixo, que ainda dá para
 * repor amanhã.
 */
export function alertasDaRede(resumos: ResumoLoja[]): Alerta[] {
  const alertas: Alerta[] = [];

  for (const r of resumos) {
    if (!r.loja.ativa) continue;

    if (r.aguardandoReceita > 0) {
      alertas.push({
        id: `${r.loja.id}-receita`,
        gravidade: "alta",
        loja: r.loja,
        titulo: `${r.aguardandoReceita} ${r.aguardandoReceita === 1 ? "pedido parado" : "pedidos parados"} na receita`,
        detalhe: "O farmacêutico responsável precisa conferir antes de separar.",
      });
    }

    if (!r.loja.configurada) {
      alertas.push({
        id: `${r.loja.id}-config`,
        gravidade: "alta",
        loja: r.loja,
        titulo: "Cadastro da loja incompleto",
        detalhe:
          "Sem endereço e cidade o agente não consegue responder onde a loja fica.",
      });
    }

    if (r.conversasAbertas > 0) {
      alertas.push({
        id: `${r.loja.id}-conversas`,
        gravidade: "media",
        loja: r.loja,
        titulo: `${r.conversasAbertas} ${r.conversasAbertas === 1 ? "conversa aberta" : "conversas abertas"}`,
        detalhe: "Cliente esperando resposta no atendimento.",
      });
    }

    if (r.estoqueCritico > 0) {
      alertas.push({
        id: `${r.loja.id}-estoque`,
        gravidade: "media",
        loja: r.loja,
        titulo: `${r.estoqueCritico} ${r.estoqueCritico === 1 ? "item abaixo" : "itens abaixo"} do mínimo`,
        detalhe: "Repor antes de faltar na prateleira.",
      });
    }
  }

  return alertas.sort((a, b) =>
    a.gravidade === b.gravidade ? 0 : a.gravidade === "alta" ? -1 : 1,
  );
}
