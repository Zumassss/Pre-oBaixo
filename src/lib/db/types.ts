/**
 * Tipos do sistema.
 *
 * O sistema atende uma REDE de farmácias. Cada loja enxerga apenas os
 * próprios dados; quem vê a rede inteira é o administrador, e só ele.
 * Essa separação é a regra mais importante do modelo: se um dia a tela de
 * uma loja mostrar dado de outra, é falha grave, não detalhe.
 */

/* ------------------------------------------------------------------
   Acesso
   ------------------------------------------------------------------ */

/**
 * Quem está usando o sistema.
 *
 * `admin` administra a rede toda. `loja` opera uma unidade e não sai dela.
 */
export type Papel = "admin" | "loja";

export type Usuario = {
  id: string;
  /** O que a pessoa digita para entrar. */
  usuario: string;
  nome: string;
  papel: Papel;
  /*
   * Não existe senha aqui de propósito. Ela vive só no banco, como hash, e
   * quem confere é a função `entrar` no servidor. O navegador recebe um
   * token de sessão e nada mais.
   */
  /** Preenchido só quando o papel é `loja`. */
  lojaId?: string;
};

export type Sessao = {
  usuarioId: string;
  /** Qual loja o administrador está olhando agora. */
  lojaSelecionada: string;
  em: number;
};

/* ------------------------------------------------------------------
   Loja
   ------------------------------------------------------------------ */

/** O cadastro de uma unidade da rede. */
export type Loja = {
  id: string;
  nome: string;
  endereco: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  telefone: string;
  cnpj: string;
  farmaceutico: string;
  crf: string;
  horarios: string;
  /** Fica falso até alguém preencher os dados obrigatórios. */
  configurada: boolean;
  /** Sem motoboy, todo pedido é retirada no balcão. */
  temMotoboy: boolean;
  /** Quanto a loja cobra para entregar. Zero significa entrega grátis. */
  taxaEntrega: number;
  /** Loja desativada some da operação mas o histórico continua. */
  ativa: boolean;
  criadaEm: number;
};

export function novaLoja(id: string, nome: string): Loja {
  return {
    id,
    nome,
    endereco: "",
    bairro: "",
    cidade: "",
    uf: "",
    cep: "",
    telefone: "",
    cnpj: "",
    farmaceutico: "",
    crf: "",
    horarios: "",
    configurada: false,
    temMotoboy: false,
    taxaEntrega: 0,
    ativa: true,
    criadaEm: Date.now(),
  };
}

/* ------------------------------------------------------------------
   Cadastros da loja
   ------------------------------------------------------------------ */

/** De onde o cadastro veio. */
export type OrigemCliente = "whatsapp" | "manual" | "balcao";

export type Cliente = {
  id: string;
  nome: string;
  telefone: string;
  /** Consentimento para receber campanha, exigido pela LGPD. */
  consentimento: boolean;
  observacao: string;
  /** Usado para entrega, quando houver. */
  endereco: string;
  criadoEm: number;
  origem: OrigemCliente;
  /** Etiquetas que a loja escolhe (VIP, uso contínuo, idoso...). */
  etiquetas: string[];
  /**
   * Quando a pessoa escreveu para a loja pelo WhatsApp. Zero significa que
   * nunca escreveu, e por isso a loja não pode puxar conversa com ela pelo
   * WhatsApp: mandar mensagem para quem não pediu é o que faz o número ser
   * banido.
   */
  primeiraMensagemEm: number;
  ultimaMensagemEm: number;
  /**
   * Compras de todos os tempos, mantidas a cada pedido. A tela carrega só os
   * pedidos recentes; sem este resumo, quem comprou há seis meses pareceria
   * alguém que nunca comprou.
   */
  compras: { quantidade: number; total: number; ultimaEm: number };
};

export const CLIENTE_PADRAO: Omit<Cliente, "id" | "nome" | "telefone" | "criadoEm"> = {
  consentimento: false,
  observacao: "",
  endereco: "",
  origem: "manual",
  etiquetas: [],
  primeiraMensagemEm: 0,
  ultimaMensagemEm: 0,
  compras: { quantidade: 0, total: 0, ultimaEm: 0 },
};

export type Produto = {
  id: string;
  nome: string;
  categoria: string;
  preco: number;
  /**
   * Preço de promoção. Zero significa sem promoção.
   *
   * Produto que exige receita nunca tem promoção: a ANVISA proíbe anunciar
   * medicamento de tarja ao público, e o agente fala de promoção para
   * cliente no WhatsApp. A tela e o agente conferem isso.
   */
  promocao: number;
  estoque: number;
  estoqueMinimo: number;
  exigeReceita: boolean;
  criadoEm: number;
};

/** Categorias que são remédio. O agente nunca sugere nem promove estas. */
export const CATEGORIAS_DE_MEDICAMENTO = ["Genérico", "Referência", "Similar"];

/**
 * Se o produto é remédio.
 *
 * Exigir receita basta para ser remédio, mas não o contrário: dipirona não
 * exige receita e continua sendo remédio. Por isso a categoria também conta.
 */
export function ehMedicamento(produto: Pick<Produto, "categoria" | "exigeReceita">) {
  return produto.exigeReceita || CATEGORIAS_DE_MEDICAMENTO.includes(produto.categoria);
}

/** O preço que vale agora, com a promoção quando ela é válida. */
export function precoAtual(produto: Pick<Produto, "preco" | "promocao" | "exigeReceita">) {
  return !produto.exigeReceita && produto.promocao > 0 && produto.promocao < produto.preco
    ? produto.promocao
    : produto.preco;
}

export type StatusCampanha = "rascunho" | "agendada" | "enviada";

/** Para quem a campanha vai. Sempre só quem deu consentimento. */
export type PublicoCampanha = {
  modo: "todos" | "etiquetas" | "situacao";
  etiquetas: string[];
  situacoes: SituacaoCliente[];
};

export type Campanha = {
  id: string;
  nome: string;
  mensagem: string;
  status: StatusCampanha;
  /** Data e hora no formato AAAA-MM-DDTHH:MM, no horário da loja. */
  agendadaPara: string;
  criadoEm: number;
  imagem: Midia | null;
  publico: PublicoCampanha;
};

/* ------------------------------------------------------------------
   Situação do cliente
   ------------------------------------------------------------------ */

/**
 * Em que pé está a relação com a pessoa. Calculado, nunca digitado: se a
 * loja pudesse escrever "comprou" à mão, o filtro deixaria de dizer a
 * verdade.
 */
export type SituacaoCliente =
  | "comprou"
  | "nao_fechou"
  | "orcou"
  | "so_conversou"
  | "cancelou"
  | "sem_contato";

export const SITUACAO_LABEL: Record<SituacaoCliente, string> = {
  comprou: "Comprou",
  nao_fechou: "Não fechou o pedido",
  orcou: "Pediu preço",
  so_conversou: "Só conversou",
  cancelou: "Cancelou",
  sem_contato: "Sem conversa",
};

/* ------------------------------------------------------------------
   Mídia
   ------------------------------------------------------------------ */

export type TipoMidia = "imagem" | "audio" | "video" | "documento";

/** Um arquivo guardado no Storage. O caminho só abre com sessão válida. */
export type Midia = {
  caminho: string;
  tipo: TipoMidia;
  mime: string;
  nome: string;
  tamanho: number;
  /** Segundos, para áudio e vídeo. */
  duracao?: number;
};

export function tipoDaMidia(mime: string): TipoMidia {
  if (mime.startsWith("image/")) return "imagem";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  return "documento";
}

/* ------------------------------------------------------------------
   Atendimento
   ------------------------------------------------------------------ */

export type OrigemMensagem = "cliente" | "agente" | "atendente";

/** Onde está a mensagem que a loja mandou pelo WhatsApp. */
export type EnvioMensagem = "pendente" | "enviado" | "falhou";

export type Mensagem = {
  id: string;
  origem: OrigemMensagem;
  texto: string;
  em: number;
  /** Quem da loja escreveu, quando a origem é `atendente`. */
  autor: string;
  midia: Midia | null;
  /** A mensagem que esta responde, como no "responder" do WhatsApp. */
  citada: { id: string; texto: string; origem: OrigemMensagem } | null;
  /** Marcada pela equipe para achar depois. */
  marcada: boolean;
  /**
   * Só para mensagem da equipe em conversa de WhatsApp. O bot manda e muda
   * para `enviado`; se não conseguir, `falhou`, e a tela mostra.
   */
  envio: EnvioMensagem | null;
  /** Identificação da mensagem no WhatsApp, para citar e ser citada. */
  wa: { id: string; jid: string; deMim: boolean } | null;
};

export const MENSAGEM_PADRAO: Omit<Mensagem, "id" | "origem" | "texto" | "em"> = {
  autor: "",
  midia: null,
  citada: null,
  marcada: false,
  envio: null,
  wa: null,
};

/**
 * Em que pé está a conversa.
 *
 * `aberta` significa que o agente está no comando. `com_atendente` significa
 * que alguém da loja assumiu e responde no lugar dele. `resolvida` sai da
 * fila e passa a viver só no histórico do cliente.
 */
export type StatusConversa = "aberta" | "com_atendente" | "resolvida";

/** Por que a conversa precisa de uma pessoa agora. */
export type TipoAlerta = "farmaceutico" | "atendente" | "reclamacao";

export const ALERTA_LABEL: Record<TipoAlerta, string> = {
  farmaceutico: "Precisa do farmacêutico",
  atendente: "Pediu um atendente",
  reclamacao: "Reclamação",
};

/** Até onde a conversa chegou no caminho da venda. */
export type EtapaConversa = "conversa" | "orcamento" | "carrinho" | "pedido";

export type Conversa = {
  id: string;
  cliente: string;
  telefone: string;
  status: StatusConversa;
  /** WhatsApp: o que a equipe escreve chega no celular do cliente. */
  canal: "whatsapp" | "interno";
  alerta: { tipo: TipoAlerta; resumo: string; em: number } | null;
  etapa: EtapaConversa;
  mensagens: Mensagem[];
  atualizadaEm: number;
  /**
   * Quem da loja assumiu a conversa. Vazio significa que o agente responde.
   *
   * Guardar o nome, e não só um sim ou não, existe pelo mesmo motivo do
   * `receitaConferidaPor` do pedido: quando der problema, a loja precisa
   * saber quem estava atendendo.
   */
  assumidaPor: string;
  assumidaEm: number;
  criadaEm: number;
};

/** A conversa ainda está na fila de quem atende. */
export function conversaAtiva(conversa: Conversa) {
  return conversa.status !== "resolvida";
}

/**
 * A chave que junta as conversas de uma mesma pessoa.
 *
 * É o telefone sem pontuação, e não o nome: nome a pessoa digita diferente a
 * cada vez ("Ana Paula" e "ana paula ribeiro"), telefone não. Sem telefone,
 * cai no nome normalizado para pelo menos não espalhar o histórico.
 */
export function chaveDoCliente(conversa: {
  telefone: string;
  cliente: string;
}) {
  const digitos = conversa.telefone.replace(/\D/g, "");
  if (digitos.length >= 8) return digitos;
  return `nome:${conversa.cliente.trim().toLowerCase()}`;
}

/* ------------------------------------------------------------------
   Pedidos
   ------------------------------------------------------------------ */

/**
 * Um item já dentro do pedido.
 *
 * O preço e a exigência de receita são copiados do catálogo no momento em
 * que o pedido nasce. Se o produto mudar de preço amanhã, o pedido de hoje
 * continua valendo o que foi combinado com o cliente.
 */
export type ItemPedido = {
  produtoId: string;
  nome: string;
  precoUnitario: number;
  quantidade: number;
  exigeReceita: boolean;
};

/**
 * Etapas de um pedido.
 *
 * `aguardando_receita` existe por exigência regulatória: pedido com item de
 * tarja não anda sozinho, o farmacêutico precisa conferir a receita antes.
 * `aguardando_pagamento` só aparece quando a cobrança é por Pix; quem paga
 * no balcão paga na hora de receber. `saiu_entrega` só existe quando o
 * pedido vai de motoboy.
 */
export type StatusPedido =
  | "aguardando_receita"
  | "aguardando_pagamento"
  | "em_preparo"
  | "pronto"
  | "saiu_entrega"
  | "entregue"
  | "cancelado";

export type FormaPagamento = "balcao" | "pix";

export type OrigemPedido = "whatsapp" | "balcao";

/** Retirada no balcão ou entrega por motoboy. */
export type FormaEntrega = "retirada" | "entrega";

export type Pedido = {
  id: string;
  /** Número curto e sequencial, para a equipe chamar em voz alta. */
  numero: number;
  cliente: string;
  telefone: string;
  origem: OrigemPedido;
  itens: ItemPedido[];
  /** Soma dos itens, sem a taxa de entrega. */
  subtotal: number;
  taxaEntrega: number;
  /** Subtotal mais a taxa. É o que o cliente paga. */
  total: number;
  status: StatusPedido;
  formaPagamento: FormaPagamento;
  formaEntrega: FormaEntrega;
  /** Para onde levar, quando for entrega. */
  enderecoEntrega: string;
  pago: boolean;
  /** Quem conferiu a receita, quando havia item de tarja. */
  receitaConferidaPor: string;
  observacao: string;
  criadoEm: number;
  atualizadoEm: number;
};

export const STATUS_PEDIDO_LABEL: Record<StatusPedido, string> = {
  aguardando_receita: "Aguardando receita",
  aguardando_pagamento: "Aguardando pagamento",
  em_preparo: "Em preparo",
  pronto: "Pronto",
  saiu_entrega: "Saiu para entrega",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

/** Ordem em que as etapas aparecem na fila. */
export const FILA_PEDIDOS: StatusPedido[] = [
  "aguardando_receita",
  "aguardando_pagamento",
  "em_preparo",
  "pronto",
  "saiu_entrega",
];

export function pedidoExigeReceita(pedido: Pedido) {
  return pedido.itens.some((i) => i.exigeReceita);
}

export function pedidoEmAberto(pedido: Pedido) {
  return pedido.status !== "entregue" && pedido.status !== "cancelado";
}

/* ------------------------------------------------------------------
   Agente e cobrança
   ------------------------------------------------------------------ */

/** Registro do que o agente fez. Só entra aqui o que aconteceu de verdade. */
export type EventoAgente = {
  id: string;
  tipo: "pergunta" | "resposta" | "erro" | "sistema";
  titulo: string;
  detalhe: string;
  em: number;
};

/** Configuração de cobrança. Sem chave Pix, só resta receber no balcão. */
export type Pagamentos = {
  chavePix: string;
  /** Nome do recebedor como sai no app do banco do cliente. */
  beneficiario: string;
  cidade: string;
};

export const PAGAMENTOS_VAZIO: Pagamentos = {
  chavePix: "",
  beneficiario: "",
  cidade: "",
};

/* ------------------------------------------------------------------
   O que o agente sabe da loja
   ------------------------------------------------------------------ */

export type DiaSemana = "dom" | "seg" | "ter" | "qua" | "qui" | "sex" | "sab";

export const DIAS_SEMANA: { id: DiaSemana; nome: string; curto: string }[] = [
  { id: "seg", nome: "Segunda", curto: "Seg" },
  { id: "ter", nome: "Terça", curto: "Ter" },
  { id: "qua", nome: "Quarta", curto: "Qua" },
  { id: "qui", nome: "Quinta", curto: "Qui" },
  { id: "sex", nome: "Sexta", curto: "Sex" },
  { id: "sab", nome: "Sábado", curto: "Sáb" },
  { id: "dom", nome: "Domingo", curto: "Dom" },
];

/** Horário de um dia, em "HH:MM". */
export type HorarioDia = { aberto: boolean; abre: string; fecha: string };

/**
 * Como a taxa de entrega é calculada.
 *
 * `fixa` cobra o mesmo valor de todo mundo. `bairro` usa uma tabela. Em
 * `distancia` a taxa é a base até alguns quilômetros e cresce por quilômetro
 * depois disso, calculada pela distância em linha reta corrigida para a rua.
 */
export type ModoEntrega = "fixa" | "bairro" | "distancia";

export type AjustesEntrega = {
  modo: ModoEntrega;
  taxaFixa: number;
  bairros: { nome: string; taxa: number }[];
  /** Bairro fora da tabela: não entrega, ou cobra uma taxa padrão. */
  foraDaTabela: "nao_entrega" | "taxa_padrao";
  taxaPadrao: number;
  taxaBase: number;
  kmInclusos: number;
  porKm: number;
  raioMaximoKm: number;
  pedidoMinimo: number;
  /** Zero desliga. */
  freteGratisAcima: number;
  tempoMinutos: number;
  horario: string;
};

/**
 * Tudo que o agente usa para vender bem e não inventar nada.
 *
 * Fica na área protegida das Configurações: mudar uma taxa ou um horário
 * muda o que o agente promete para cliente real.
 */
export type AjustesAgente = {
  nomeAtendente: string;
  saudacao: string;
  tom: "proximo" | "equilibrado" | "formal";
  horarios: Record<DiaSemana, HorarioDia>;
  /** Feriados, horário especial, plantão. */
  observacaoHorario: string;
  entrega: AjustesEntrega;
  pagamento: {
    dinheiro: boolean;
    credito: boolean;
    debito: boolean;
    pix: boolean;
    maquininhaNaEntrega: boolean;
    trocoNaEntrega: boolean;
    observacao: string;
  };
  servicos: {
    pressao: boolean;
    glicemia: boolean;
    injetaveis: boolean;
    furoOrelha: boolean;
    outros: string;
  };
  convenios: string;
  politicaTroca: string;
  retiradaTerceiros: string;
  fidelidade: string;
  perguntas: { pergunta: string; resposta: string }[];
  observacoes: string;
  /** Onde a loja fica, para calcular entrega por distância. */
  localizacao: { lat: number; lon: number } | null;
};

function horarioPadrao(): Record<DiaSemana, HorarioDia> {
  const dia = (abre: string, fecha: string): HorarioDia => ({ aberto: true, abre, fecha });
  return {
    seg: dia("08:00", "22:00"),
    ter: dia("08:00", "22:00"),
    qua: dia("08:00", "22:00"),
    qui: dia("08:00", "22:00"),
    sex: dia("08:00", "22:00"),
    sab: dia("08:00", "22:00"),
    dom: dia("08:00", "20:00"),
  };
}

export function ajustesAgentePadrao(): AjustesAgente {
  return {
    nomeAtendente: "",
    saudacao: "",
    tom: "equilibrado",
    horarios: horarioPadrao(),
    observacaoHorario: "",
    entrega: {
      modo: "fixa",
      taxaFixa: 0,
      bairros: [],
      foraDaTabela: "nao_entrega",
      taxaPadrao: 0,
      taxaBase: 5,
      kmInclusos: 2,
      porKm: 1.5,
      raioMaximoKm: 8,
      pedidoMinimo: 0,
      freteGratisAcima: 0,
      tempoMinutos: 40,
      horario: "",
    },
    pagamento: {
      dinheiro: true,
      credito: true,
      debito: true,
      pix: true,
      maquininhaNaEntrega: true,
      trocoNaEntrega: true,
      observacao: "",
    },
    servicos: { pressao: false, glicemia: false, injetaveis: false, furoOrelha: false, outros: "" },
    convenios: "",
    politicaTroca: "",
    retiradaTerceiros: "",
    fidelidade: "",
    perguntas: [],
    observacoes: "",
    localizacao: null,
  };
}

/* ------------------------------------------------------------------
   O banco
   ------------------------------------------------------------------ */

/**
 * Uma mensagem que a loja pediu para o bot mandar fora de uma conversa,
 * como o teste de uma campanha. O bot só manda para quem já escreveu para a
 * loja; para os outros, recusa e diz por quê.
 */
export type Envio = {
  id: string;
  tipo: "teste_campanha";
  telefone: string;
  texto: string;
  midia: Midia | null;
  campanhaId: string;
  status: "pendente" | "enviado" | "falhou" | "recusado";
  motivo: string;
  criadoEm: number;
  enviadoEm: number;
};

/** O que o bot conta sobre a conexão. Ele grava isto a cada minuto. */
export type EstadoWhatsapp = {
  conectado: boolean;
  /** Última vez que o bot deu sinal de vida. */
  vistoEm: number;
  numero: string;
};

/** Se o agente responde sozinho. Desligado, as mensagens só chegam à equipe. */
export type EstadoAgente = {
  ativo: boolean;
  alteradoPor: string;
  em: number;
};

/** Tudo que pertence a uma loja. Nenhuma loja lê o bloco da outra. */
export type DadosLoja = {
  clientes: Cliente[];
  produtos: Produto[];
  campanhas: Campanha[];
  conversas: Conversa[];
  pedidos: Pedido[];
  eventos: EventoAgente[];
  envios: Envio[];
  /** Se o bot avisou que está conectado. Ver `whatsappNoAr` para o "agora". */
  whatsappConectado: boolean;
  whatsapp: EstadoWhatsapp;
  agenteLigado: EstadoAgente;
  pagamentos: Pagamentos;
  agente: AjustesAgente;
  contadores: { pedido: number };
};

/**
 * Se o WhatsApp está no ar agora. O bot avisa a cada minuto; três minutos
 * sem notícia é bot parado, mesmo que o último aviso tenha dito "conectado".
 */
export function whatsappNoAr(estado: EstadoWhatsapp, agora = Date.now()) {
  return estado.conectado && agora - estado.vistoEm < 3 * 60 * 1000;
}

export function dadosVazios(): DadosLoja {
  return {
    clientes: [],
    produtos: [],
    campanhas: [],
    conversas: [],
    pedidos: [],
    eventos: [],
    envios: [],
    whatsappConectado: false,
    whatsapp: { conectado: false, vistoEm: 0, numero: "" },
    agenteLigado: { ativo: true, alteradoPor: "", em: 0 },
    pagamentos: { ...PAGAMENTOS_VAZIO },
    agente: ajustesAgentePadrao(),
    contadores: { pedido: 0 },
  };
}

/* ------------------------------------------------------------------
   Completar registros antigos
   ------------------------------------------------------------------ */

/*
 * Cada registro gravado por uma versão anterior do sistema pode não ter um
 * campo que o código de hoje espera. Estas funções completam o que falta com
 * o valor neutro. Sem elas, a tela tentaria ler `undefined` e quebraria em
 * cima de um dado que já existia e estava correto.
 */

type Bruto = Record<string, unknown>;

function lista<T>(valor: unknown): T[] {
  return Array.isArray(valor) ? (valor as T[]) : [];
}

export function normalizarCliente(c: Bruto): Cliente {
  const x = c as Partial<Cliente>;
  return {
    ...CLIENTE_PADRAO,
    ...x,
    etiquetas: lista<string>(x.etiquetas),
    compras: { ...CLIENTE_PADRAO.compras, ...(x.compras ?? {}) },
  } as Cliente;
}

export function normalizarProduto(p: Bruto): Produto {
  const x = p as Partial<Produto>;
  return { ...x, promocao: x.promocao ?? 0 } as Produto;
}

export function normalizarMensagem(m: Bruto): Mensagem {
  return { ...MENSAGEM_PADRAO, ...(m as Partial<Mensagem>) } as Mensagem;
}

export function normalizarConversa(c: Bruto): Conversa {
  const x = c as Partial<Conversa>;
  const mensagens = lista<Bruto>(x.mensagens).map(normalizarMensagem);
  return {
    ...x,
    canal: x.canal ?? (String(x.id ?? "").startsWith("cnv-wa-") ? "whatsapp" : "interno"),
    alerta: x.alerta ?? null,
    etapa: x.etapa ?? "conversa",
    assumidaPor: x.assumidaPor ?? "",
    assumidaEm: x.assumidaEm ?? 0,
    criadaEm: x.criadaEm ?? mensagens[0]?.em ?? x.atualizadaEm ?? 0,
    mensagens,
  } as Conversa;
}

export function normalizarCampanha(c: Bruto): Campanha {
  const x = c as Partial<Campanha>;
  return {
    ...x,
    imagem: x.imagem ?? null,
    publico: {
      modo: x.publico?.modo ?? "todos",
      etiquetas: lista<string>(x.publico?.etiquetas),
      situacoes: lista<SituacaoCliente>(x.publico?.situacoes),
    },
  } as Campanha;
}

export function normalizarEnvio(e: Bruto): Envio {
  const x = e as Partial<Envio>;
  return { midia: null, motivo: "", enviadoEm: 0, campanhaId: "", ...x } as Envio;
}

/** Junta o que foi salvo com o padrão, campo a campo, sem perder nada. */
export function normalizarAjustesAgente(a: Bruto | null | undefined): AjustesAgente {
  const base = ajustesAgentePadrao();
  const x = (a ?? {}) as Partial<AjustesAgente>;
  return {
    ...base,
    ...x,
    horarios: { ...base.horarios, ...(x.horarios ?? {}) },
    entrega: { ...base.entrega, ...(x.entrega ?? {}), bairros: lista(x.entrega?.bairros) },
    pagamento: { ...base.pagamento, ...(x.pagamento ?? {}) },
    servicos: { ...base.servicos, ...(x.servicos ?? {}) },
    perguntas: lista(x.perguntas),
    localizacao: x.localizacao ?? null,
  };
}

/** Completa um bloco inteiro de dados. Usado pelos dados de exemplo. */
export function completarDados(salvo?: Partial<DadosLoja>): DadosLoja {
  const base = dadosVazios();
  if (!salvo) return base;
  return {
    ...base,
    ...salvo,
    pagamentos: { ...base.pagamentos, ...salvo.pagamentos },
    agente: normalizarAjustesAgente(salvo.agente as Bruto | undefined),
    clientes: (salvo.clientes ?? []).map((c) => normalizarCliente(c as Bruto)),
    produtos: (salvo.produtos ?? []).map((p) => normalizarProduto(p as Bruto)),
    campanhas: (salvo.campanhas ?? []).map((c) => normalizarCampanha(c as Bruto)),
    conversas: (salvo.conversas ?? []).map((c) => normalizarConversa(c as Bruto)),
    envios: (salvo.envios ?? []).map((e) => normalizarEnvio(e as Bruto)),
  };
}

export type Banco = {
  usuarios: Usuario[];
  lojas: Loja[];
  /** Os dados de cada loja, indexados pelo id dela. */
  dados: Record<string, DadosLoja>;
  sessao: Sessao | null;
};

export const LOJA_TESTE_ID = "loja-teste-1";

/**
 * O banco antes de qualquer coisa chegar do servidor.
 *
 * Vazio de verdade: usuários, lojas e cadastros vêm todos da nuvem depois
 * do login. O navegador não carrega nenhum dado próprio.
 */
export function bancoVazio(): Banco {
  return { usuarios: [], lojas: [], dados: {}, sessao: null };
}

/* ------------------------------------------------------------------
   Ajudas de leitura
   ------------------------------------------------------------------ */

export function usuarioDaSessao(banco: Banco): Usuario | null {
  if (!banco.sessao) return null;
  const id = banco.sessao.usuarioId;
  return banco.usuarios.find((u) => u.id === id) ?? null;
}

/**
 * Qual loja está sendo operada agora.
 *
 * Para quem opera uma loja, é sempre a dela, sem escolha. Para o
 * administrador, é a que ele selecionou.
 */
export function lojaAtiva(banco: Banco): Loja | null {
  const usuario = usuarioDaSessao(banco);
  if (!usuario) return null;

  const id =
    usuario.papel === "loja" ? usuario.lojaId : banco.sessao?.lojaSelecionada;
  if (!id) return null;

  return banco.lojas.find((l) => l.id === id) ?? null;
}

export function dadosDaLoja(banco: Banco, lojaId: string): DadosLoja {
  return banco.dados[lojaId] ?? dadosVazios();
}

/* ------------------------------------------------------------------
   A visão de uma loja
   ------------------------------------------------------------------ */

/**
 * O que uma tela de operação enxerga: os dados de uma loja mais o cadastro
 * dela. É deliberadamente o recorte de UMA unidade.
 *
 * Toda tela de operação consome isto, nunca o `Banco` inteiro. Assim, se um
 * dia alguém errar uma consulta, o erro não tem como vazar dado de outra
 * loja: a tela não recebe a rede, recebe a loja.
 */
export type VisaoLoja = DadosLoja & { loja: Loja };

/** Loja em branco, para começar um formulário sem esperar o banco carregar. */
export const LOJA_VAZIA: Loja = { ...novaLoja("", ""), criadaEm: 0 };

/** Visão em branco, usada na primeira renderização e no servidor. */
export function visaoVazia(): VisaoLoja {
  return { ...dadosVazios(), loja: { ...LOJA_VAZIA } };
}

export function visaoDaLoja(banco: Banco, lojaId: string): VisaoLoja {
  const loja = banco.lojas.find((l) => l.id === lojaId);
  return {
    ...dadosDaLoja(banco, lojaId),
    loja: loja ?? { ...LOJA_VAZIA },
  };
}

/** A visão da loja que a sessão está operando agora. */
export function visaoAtiva(banco: Banco): VisaoLoja {
  const loja = lojaAtiva(banco);
  return loja ? visaoDaLoja(banco, loja.id) : visaoVazia();
}
