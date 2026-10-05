// Caminho relativo com extensão: o bot do WhatsApp roda este arquivo direto
// no Node, que não conhece o atalho "@/" nem completa a extensão sozinho.
import {
  type AjustesAgente,
  ehMedicamento,
  normalizarAjustesAgente,
  pedidoEmAberto,
  STATUS_PEDIDO_LABEL,
  type StatusPedido,
  type VisaoLoja,
  whatsappNoAr,
} from "./db/types.ts";
import { situacaoDaLoja, textoDosHorarios } from "./loja-regras.ts";

/**
 * O que o agente precisa saber sobre a loja para responder.
 *
 * No chat do painel, quem envia os dados é o navegador. Por isso o servidor
 * nunca confia no tamanho do que chega: ele recorta antes de montar o texto,
 * senão uma requisição grande viraria uma conta grande na API. O bot do
 * WhatsApp lê do banco e passa pelo mesmo caminho, para os dois canais
 * enxergarem o catálogo do mesmo jeito.
 */

export type ProdutoDoContexto = {
  nome: string;
  preco: number;
  /** Zero quando não há promoção. Remédio chega sempre com zero. */
  promocao: number;
  estoque: number;
  exigeReceita: boolean;
  /** Remédio nunca entra em sugestão, complemento nem promoção. */
  remedio: boolean;
};

export type ContextoLoja = {
  nome: string;
  endereco: string;
  horarios: string;
  farmaceutico: string;
  temMotoboy: boolean;
  taxaEntrega: number;
  produtos: ProdutoDoContexto[];
  ajustes: AjustesAgente;
};

/** Quantos produtos do catálogo seguem junto de cada pergunta. */
const MAXIMO_PRODUTOS = 80;
const MAXIMO_TEXTO = 160;
const MAXIMO_TEXTO_LONGO = 700;

export function extrairContexto(visao: VisaoLoja): ContextoLoja {
  const { loja } = visao;
  return {
    nome: loja.nome,
    endereco: [loja.endereco, loja.bairro, loja.cidade, loja.uf].filter(Boolean).join(", "),
    horarios: loja.horarios,
    farmaceutico: [loja.farmaceutico, loja.crf].filter(Boolean).join(" "),
    temMotoboy: loja.temMotoboy,
    taxaEntrega: loja.taxaEntrega,
    produtos: visao.produtos.slice(0, MAXIMO_PRODUTOS).map((p) => {
      const remedio = ehMedicamento(p);
      return {
        nome: p.nome,
        preco: p.preco,
        promocao: remedio ? 0 : p.promocao,
        estoque: p.estoque,
        exigeReceita: p.exigeReceita,
        remedio,
      };
    }),
    ajustes: visao.agente,
  };
}

function texto(valor: unknown, maximo = MAXIMO_TEXTO): string {
  return typeof valor === "string" ? valor.slice(0, maximo).trim() : "";
}

function numero(valor: unknown): number {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : 0;
}

function reais(valor: number) {
  return valor.toFixed(2).replace(".", ",");
}

/** O que a loja configurou para o agente, em frases curtas. */
function textoDosAjustes(ajustes: AjustesAgente, temMotoboy: boolean, agora: Date): string[] {
  const linhas: string[] = [];

  const situacao = situacaoDaLoja(ajustes, agora);
  linhas.push(`Horário: ${textoDosHorarios(ajustes)}.`);
  linhas.push(`Neste momento a loja está ${situacao.texto}. Use isso para dizer se está aberta.`);
  const especial = texto(ajustes.observacaoHorario, MAXIMO_TEXTO_LONGO);
  if (especial) linhas.push(`Horários especiais: ${especial}`);

  if (temMotoboy) {
    const e = ajustes.entrega;
    if (e.modo === "fixa") {
      linhas.push(
        e.taxaFixa > 0
          ? `Entrega por motoboy com taxa de R$ ${reais(e.taxaFixa)}.`
          : "Entrega por motoboy sem taxa.",
      );
    } else if (e.modo === "bairro") {
      const tabela = e.bairros
        .slice(0, 40)
        .map((b) => `${texto(b.nome, 60)} R$ ${reais(numero(b.taxa))}`)
        .join("; ");
      linhas.push(`Entrega por motoboy com taxa por bairro: ${tabela || "tabela vazia"}.`);
      linhas.push(
        e.foraDaTabela === "taxa_padrao"
          ? `Bairro fora da tabela paga R$ ${reais(e.taxaPadrao)}.`
          : "Bairro fora da tabela: a loja não entrega.",
      );
    } else {
      linhas.push(
        `Entrega por motoboy com taxa por distância: R$ ${reais(e.taxaBase)} até ${e.kmInclusos} km e R$ ${reais(e.porKm)} por km a mais, até ${e.raioMaximoKm} km.`,
      );
    }
    linhas.push(
      "Para dizer a taxa de um endereço, use a ferramenta calcular_entrega com rua, número e bairro; nunca calcule de cabeça.",
    );
    if (e.pedidoMinimo > 0) linhas.push(`Pedido mínimo para entrega: R$ ${reais(e.pedidoMinimo)}.`);
    if (e.freteGratisAcima > 0) linhas.push(`Entrega grátis em pedidos a partir de R$ ${reais(e.freteGratisAcima)}.`);
    if (e.tempoMinutos > 0) linhas.push(`Tempo médio de entrega: cerca de ${e.tempoMinutos} minutos.`);
    const horario = texto(e.horario);
    if (horario) linhas.push(`Horário de entrega: ${horario}.`);
  } else {
    linhas.push("A loja não entrega: todo pedido é retirada no balcão.");
  }

  const p = ajustes.pagamento;
  const formas = [
    p.dinheiro && "dinheiro",
    p.pix && "Pix",
    p.debito && "cartão de débito",
    p.credito && "cartão de crédito",
  ].filter(Boolean);
  if (formas.length) linhas.push(`Formas de pagamento: ${formas.join(", ")}.`);
  if (temMotoboy) {
    linhas.push(
      p.maquininhaNaEntrega
        ? "O motoboy leva maquininha de cartão."
        : "O motoboy não leva maquininha: na entrega, só dinheiro ou Pix.",
    );
    if (p.dinheiro) {
      linhas.push(p.trocoNaEntrega ? "O motoboy leva troco; pergunte para quanto." : "O motoboy não leva troco.");
    }
  }
  const obsPagamento = texto(p.observacao);
  if (obsPagamento) linhas.push(`Sobre pagamento: ${obsPagamento}`);

  const s = ajustes.servicos;
  const servicos = [
    s.pressao && "aferição de pressão",
    s.glicemia && "teste de glicemia",
    s.injetaveis && "aplicação de injetáveis",
    s.furoOrelha && "furo de orelha",
    texto(s.outros),
  ].filter(Boolean);
  if (servicos.length) linhas.push(`Serviços na loja: ${servicos.join(", ")}.`);

  const extras: [string, string][] = [
    ["Convênios aceitos", ajustes.convenios],
    ["Troca e devolução", ajustes.politicaTroca],
    ["Retirada por outra pessoa", ajustes.retiradaTerceiros],
    ["Fidelidade e descontos", ajustes.fidelidade],
  ];
  for (const [rotulo, valor] of extras) {
    const t = texto(valor, MAXIMO_TEXTO_LONGO);
    if (t) linhas.push(`${rotulo}: ${t}`);
  }

  const perguntas = ajustes.perguntas
    .slice(0, 25)
    .map((q) => ({ p: texto(q.pergunta), r: texto(q.resposta, MAXIMO_TEXTO_LONGO) }))
    .filter((q) => q.p && q.r);
  if (perguntas.length) {
    linhas.push("", "Perguntas frequentes (use estas respostas):");
    for (const q of perguntas) linhas.push(`- ${q.p} → ${q.r}`);
  }

  const observacoes = texto(ajustes.observacoes, 1500);
  if (observacoes) linhas.push("", `Observações da loja: ${observacoes}`);
  return linhas;
}

/**
 * Transforma o que chegou (do navegador ou do banco) no texto que vai ao
 * agente de atendimento.
 *
 * Devolve vazio quando não veio nada de útil: nesse caso o agente segue sem
 * catálogo, o que é melhor que inventar preço.
 */
export function montarTextoDoContexto(bruto: unknown, agora = new Date()): string {
  if (typeof bruto !== "object" || bruto === null) return "";
  const dados = bruto as Record<string, unknown>;
  const ajustes = normalizarAjustesAgente(
    typeof dados.ajustes === "object" ? (dados.ajustes as Record<string, unknown>) : null,
  );

  const linhas: string[] = [];
  const nome = texto(dados.nome);
  if (nome) linhas.push(`Loja: ${nome}.`);
  const atendente = texto(ajustes.nomeAtendente, 40);
  if (atendente) linhas.push(`Seu nome no atendimento é ${atendente}.`);
  const saudacao = texto(ajustes.saudacao, 300);
  if (saudacao) linhas.push(`Saudação da loja para a primeira mensagem: ${saudacao}`);
  linhas.push(
    ajustes.tom === "formal"
      ? "Tom: formal e educado, trate por senhor ou senhora."
      : ajustes.tom === "proximo"
        ? "Tom: próximo e descontraído, como alguém do bairro."
        : "Tom: simpático e profissional.",
  );

  const endereco = texto(dados.endereco);
  if (endereco) linhas.push(`Endereço: ${endereco}.`);

  const farmaceutico = texto(dados.farmaceutico);
  if (farmaceutico) {
    linhas.push(`Farmacêutico responsável: ${farmaceutico}. É para ele que vai toda dúvida clínica.`);
  }

  linhas.push(...textoDosAjustes(ajustes, dados.temMotoboy === true, agora));

  const produtos = Array.isArray(dados.produtos) ? dados.produtos.slice(0, MAXIMO_PRODUTOS) : [];

  const itens = produtos
    .map((p) => {
      if (typeof p !== "object" || p === null) return "";
      const item = p as Record<string, unknown>;
      const nomeProduto = texto(item.nome);
      if (!nomeProduto) return "";

      const valorPreco = numero(item.preco);
      const preco = reais(valorPreco);
      const estoque = numero(item.estoque);
      const disponibilidade = estoque > 0 ? `${estoque} em estoque` : "sem estoque agora";
      const receita = item.exigeReceita === true ? ", exige receita" : "";

      // Na dúvida, é remédio: o navegador pode mandar um produto sem a
      // marca, e tratar remédio como item comum é o erro que não pode
      // acontecer. Sem a marca explícita de que não é, não se promove.
      const remedio = item.remedio !== false || item.exigeReceita === true;
      if (remedio) {
        return `- ${nomeProduto}: R$ ${preco}, ${disponibilidade}${receita} [remédio: sem sugestão nem promoção]`;
      }

      const promocao = numero(item.promocao);
      const valor =
        promocao > 0 && promocao < valorPreco
          ? `em promoção, de R$ ${preco} por R$ ${reais(promocao)}`
          : `R$ ${preco}`;
      return `- ${nomeProduto}: ${valor}, ${disponibilidade} [pode sugerir]`;
    })
    .filter(Boolean);

  if (itens.length > 0) {
    linhas.push("", "Catálogo desta loja:", ...itens);
    linhas.push(
      "",
      "Responda preço e disponibilidade SÓ a partir desta lista. Produto que não está aqui, a loja não tem cadastrado: diga que vai confirmar com a equipe em vez de chutar.",
    );
  } else {
    linhas.push(
      "",
      "O catálogo desta loja ainda está vazio. Não invente preço nem disponibilidade: diga que vai confirmar com a equipe.",
    );
  }

  return linhas.join("\n");
}

/* ------------------------------------------------------------------
   Resumo da operação, para o assistente da equipe
   ------------------------------------------------------------------ */

/** Início do dia em Brasília, em milissegundos. */
export function inicioDoDia(agora = new Date(), diasAtras = 0) {
  const dia = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
  // Brasília não tem horário de verão desde 2019: o fuso é sempre -03:00.
  return new Date(`${dia}T00:00:00-03:00`).getTime() - diasAtras * 86400000;
}

export type ResumoOperacao = {
  geradoEm: number;
  whatsappNoAr: boolean;
  agenteLigado: boolean;
  conversas: {
    hoje: number;
    novasHoje: number;
    ontem: number;
    abertasComAgente: number;
    comAtendente: number;
    mensagensDeClientesHoje: number;
    alertas: { cliente: string; tipo: string; resumo: string }[];
    envioPendente: number;
  };
  pedidos: {
    hoje: number;
    totalHoje: number;
    ontem: number;
    totalOntem: number;
    seteDias: number;
    totalSeteDias: number;
    trintaDias: number;
    totalTrintaDias: number;
    porStatus: Record<string, number>;
    emAberto: { numero: number; cliente: string; status: string; total: number; entrega: string }[];
    whatsappHoje: number;
  };
  clientes: { total: number; novosHoje: number; comConsentimento: number; doWhatsapp: number };
  estoque: { baixo: { nome: string; estoque: number; minimo: number }[]; zerados: number; produtos: number };
  maisVendidos: { nome: string; quantidade: number }[];
  campanhas: { agendadas: number; rascunhos: number };
};

/**
 * Os números da loja que a equipe costuma perguntar. Calculado no navegador
 * a partir do que já está na tela (pedidos dos últimos 60 dias, conversas
 * dos últimos 90), e enviado já resumido: o servidor nunca recebe a lista
 * de clientes.
 */
export function extrairResumoOperacao(visao: VisaoLoja, agora = new Date()): ResumoOperacao {
  const hoje = inicioDoDia(agora);
  const ontem = inicioDoDia(agora, 1);
  const seteDias = inicioDoDia(agora, 6);
  const trintaDias = inicioDoDia(agora, 29);

  const valendo = visao.pedidos.filter((p) => p.status !== "cancelado");
  const entre = (de: number, ate: number) => valendo.filter((p) => p.criadoEm >= de && p.criadoEm < ate);
  const soma = (lista: { total: number }[]) => lista.reduce((s, p) => s + p.total, 0);
  const pedidosHoje = entre(hoje, Infinity);
  const pedidosOntem = entre(ontem, hoje);
  const pedidosSete = entre(seteDias, Infinity);
  const pedidosTrinta = entre(trintaDias, Infinity);

  const porStatus: Record<string, number> = {};
  for (const p of visao.pedidos.filter(pedidoEmAberto)) {
    const rotulo = STATUS_PEDIDO_LABEL[p.status as StatusPedido];
    porStatus[rotulo] = (porStatus[rotulo] ?? 0) + 1;
  }

  const vendidos = new Map<string, number>();
  for (const p of pedidosTrinta) {
    for (const i of p.itens) vendidos.set(i.nome, (vendidos.get(i.nome) ?? 0) + i.quantidade);
  }

  const teveMensagem = (de: number, ate: number) =>
    visao.conversas.filter((c) => c.mensagens.some((m) => m.em >= de && m.em < ate)).length;

  return {
    geradoEm: agora.getTime(),
    whatsappNoAr: whatsappNoAr(visao.whatsapp, agora.getTime()),
    agenteLigado: visao.agenteLigado.ativo,
    conversas: {
      hoje: teveMensagem(hoje, Infinity),
      novasHoje: visao.conversas.filter((c) => c.criadaEm >= hoje).length,
      ontem: teveMensagem(ontem, hoje),
      abertasComAgente: visao.conversas.filter((c) => c.status === "aberta").length,
      comAtendente: visao.conversas.filter((c) => c.status === "com_atendente").length,
      mensagensDeClientesHoje: visao.conversas.reduce(
        (s, c) => s + c.mensagens.filter((m) => m.origem === "cliente" && m.em >= hoje).length,
        0,
      ),
      alertas: visao.conversas
        .filter((c) => c.alerta && c.status !== "resolvida")
        .slice(0, 10)
        .map((c) => ({ cliente: c.cliente, tipo: c.alerta!.tipo, resumo: c.alerta!.resumo })),
      envioPendente: visao.conversas.reduce(
        (s, c) => s + c.mensagens.filter((m) => m.envio === "pendente").length,
        0,
      ),
    },
    pedidos: {
      hoje: pedidosHoje.length,
      totalHoje: soma(pedidosHoje),
      ontem: pedidosOntem.length,
      totalOntem: soma(pedidosOntem),
      seteDias: pedidosSete.length,
      totalSeteDias: soma(pedidosSete),
      trintaDias: pedidosTrinta.length,
      totalTrintaDias: soma(pedidosTrinta),
      porStatus,
      emAberto: visao.pedidos
        .filter(pedidoEmAberto)
        .slice(0, 15)
        .map((p) => ({
          numero: p.numero,
          cliente: p.cliente,
          status: STATUS_PEDIDO_LABEL[p.status],
          total: p.total,
          entrega: p.formaEntrega,
        })),
      whatsappHoje: pedidosHoje.filter((p) => p.origem === "whatsapp").length,
    },
    clientes: {
      total: visao.clientes.length,
      novosHoje: visao.clientes.filter((c) => c.criadoEm >= hoje).length,
      comConsentimento: visao.clientes.filter((c) => c.consentimento).length,
      doWhatsapp: visao.clientes.filter((c) => c.primeiraMensagemEm > 0).length,
    },
    estoque: {
      baixo: visao.produtos
        .filter((p) => p.estoque <= p.estoqueMinimo)
        .slice(0, 15)
        .map((p) => ({ nome: p.nome, estoque: p.estoque, minimo: p.estoqueMinimo })),
      zerados: visao.produtos.filter((p) => p.estoque <= 0).length,
      produtos: visao.produtos.length,
    },
    maisVendidos: [...vendidos.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([nome, quantidade]) => ({ nome, quantidade })),
    campanhas: {
      agendadas: visao.campanhas.filter((c) => c.status === "agendada").length,
      rascunhos: visao.campanhas.filter((c) => c.status === "rascunho").length,
    },
  };
}

/** O resumo em texto, recortado: o servidor não confia no que chega. */
export function montarTextoOperacao(bruto: unknown): string {
  if (typeof bruto !== "object" || bruto === null) return "";
  const r = bruto as Partial<ResumoOperacao>;
  const n = (v: unknown) => numero(v);
  const linhas: string[] = [];
  const quando = new Date(n(r.geradoEm) || Date.now()).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  linhas.push(`Dados de agora: ${quando} (horário de Brasília).`);
  linhas.push(
    `WhatsApp: ${r.whatsappNoAr ? "conectado" : "desconectado"}. Agente respondendo sozinho: ${r.agenteLigado ? "sim" : "não, desligado"}.`,
  );

  const c = r.conversas;
  if (c) {
    linhas.push(
      `Conversas com clientes: ${n(c.hoje)} com mensagem hoje (${n(c.novasHoje)} começaram hoje), ${n(c.ontem)} ontem. ${n(c.mensagensDeClientesHoje)} mensagens de clientes hoje.`,
      `Agora: ${n(c.abertasComAgente)} com o agente, ${n(c.comAtendente)} com alguém da equipe, ${n(c.envioPendente)} mensagens da equipe esperando envio.`,
    );
    const alertas = Array.isArray(c.alertas) ? c.alertas.slice(0, 10) : [];
    if (alertas.length) {
      linhas.push("Conversas esperando uma pessoa:");
      for (const a of alertas) {
        linhas.push(`- ${texto(a.cliente, 60)}: ${texto(a.tipo, 30)}, ${texto(a.resumo)}`);
      }
    } else {
      linhas.push("Nenhuma conversa esperando farmacêutico ou atendente.");
    }
  }

  const p = r.pedidos;
  if (p) {
    linhas.push(
      `Pedidos (sem cancelados): hoje ${n(p.hoje)} somando R$ ${reais(n(p.totalHoje))} (${n(p.whatsappHoje)} pelo WhatsApp); ontem ${n(p.ontem)} somando R$ ${reais(n(p.totalOntem))}; últimos 7 dias ${n(p.seteDias)} somando R$ ${reais(n(p.totalSeteDias))}; últimos 30 dias ${n(p.trintaDias)} somando R$ ${reais(n(p.totalTrintaDias))}.`,
    );
    const status = Object.entries(p.porStatus ?? {})
      .slice(0, 10)
      .map(([k, v]) => `${texto(k, 30)}: ${n(v)}`);
    linhas.push(status.length ? `Pedidos em aberto por etapa: ${status.join(", ")}.` : "Nenhum pedido em aberto.");
    for (const pe of (Array.isArray(p.emAberto) ? p.emAberto : []).slice(0, 15)) {
      linhas.push(
        `- #${n(pe.numero)} ${texto(pe.cliente, 60)}, ${texto(pe.status, 30)}, R$ ${reais(n(pe.total))}, ${pe.entrega === "entrega" ? "entrega" : "retirada"}`,
      );
    }
  }

  const cl = r.clientes;
  if (cl) {
    linhas.push(
      `Clientes cadastrados: ${n(cl.total)} (${n(cl.novosHoje)} novos hoje, ${n(cl.doWhatsapp)} vieram do WhatsApp, ${n(cl.comConsentimento)} aceitaram receber campanha).`,
    );
  }

  const e = r.estoque;
  if (e) {
    linhas.push(`Catálogo: ${n(e.produtos)} produtos, ${n(e.zerados)} sem estoque.`);
    const baixo = (Array.isArray(e.baixo) ? e.baixo : []).slice(0, 15);
    if (baixo.length) {
      linhas.push("Estoque no mínimo ou abaixo:");
      for (const b of baixo) linhas.push(`- ${texto(b.nome, 80)}: ${n(b.estoque)} (mínimo ${n(b.minimo)})`);
    }
  }

  const mais = (Array.isArray(r.maisVendidos) ? r.maisVendidos : []).slice(0, 5);
  if (mais.length) {
    linhas.push(
      `Mais vendidos em 30 dias: ${mais.map((m) => `${texto(m.nome, 60)} (${n(m.quantidade)})`).join(", ")}.`,
    );
  }
  if (r.campanhas) {
    linhas.push(`Campanhas: ${n(r.campanhas.agendadas)} agendadas, ${n(r.campanhas.rascunhos)} em rascunho.`);
  }
  return linhas.join("\n");
}
