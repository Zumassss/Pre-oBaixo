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
  /**
   * Senha de demonstração, guardada em texto puro no navegador.
   *
   * Isto NÃO é autenticação de verdade e não protege nada: qualquer pessoa
   * com o navegador aberto lê o valor. Serve para separar os perfis durante
   * a demonstração. Antes de existir dado real de cliente, isto tem que
   * virar autenticação de servidor (o Supabase do projeto já resolve).
   */
  senha: string;
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
};

export type Produto = {
  id: string;
  nome: string;
  categoria: string;
  preco: number;
  estoque: number;
  estoqueMinimo: number;
  exigeReceita: boolean;
  criadoEm: number;
};

export type StatusCampanha = "rascunho" | "agendada" | "enviada";

export type Campanha = {
  id: string;
  nome: string;
  mensagem: string;
  status: StatusCampanha;
  agendadaPara: string;
  criadoEm: number;
};

/* ------------------------------------------------------------------
   Atendimento
   ------------------------------------------------------------------ */

export type OrigemMensagem = "cliente" | "agente" | "atendente";

export type Mensagem = {
  id: string;
  origem: OrigemMensagem;
  texto: string;
  em: number;
  /** Quem da loja escreveu, quando a origem é `atendente`. */
  autor: string;
};

/**
 * Em que pé está a conversa.
 *
 * `aberta` significa que o agente está no comando. `com_atendente` significa
 * que alguém da loja assumiu e responde no lugar dele. `resolvida` sai da
 * fila e passa a viver só no histórico do cliente.
 */
export type StatusConversa = "aberta" | "com_atendente" | "resolvida";

export type Conversa = {
  id: string;
  cliente: string;
  telefone: string;
  status: StatusConversa;
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
   O banco
   ------------------------------------------------------------------ */

/** Tudo que pertence a uma loja. Nenhuma loja lê o bloco da outra. */
export type DadosLoja = {
  clientes: Cliente[];
  produtos: Produto[];
  campanhas: Campanha[];
  conversas: Conversa[];
  pedidos: Pedido[];
  eventos: EventoAgente[];
  /** Conexão com a API do WhatsApp daquela unidade. */
  whatsappConectado: boolean;
  pagamentos: Pagamentos;
};

export function dadosVazios(): DadosLoja {
  return {
    clientes: [],
    produtos: [],
    campanhas: [],
    conversas: [],
    pedidos: [],
    eventos: [],
    whatsappConectado: false,
    pagamentos: { ...PAGAMENTOS_VAZIO },
  };
}

/**
 * Completa um bloco lido do armazenamento com os campos que faltarem.
 *
 * Uma base gravada por uma versão anterior pode não ter uma coleção que o
 * código de hoje espera. Sem isto, a tela quebraria ao percorrer `undefined`.
 */
export function completarDados(salvo?: Partial<DadosLoja>): DadosLoja {
  const base = dadosVazios();
  if (!salvo) return base;
  return {
    ...base,
    ...salvo,
    pagamentos: { ...base.pagamentos, ...salvo.pagamentos },
    // Conversa gravada por uma versão anterior não tem os campos de quem
    // assumiu. Sem este preenchimento, a tela tentaria ler `undefined` e
    // quebraria em cima de um dado que já existia e estava correto.
    conversas: (salvo.conversas ?? []).map((c) => ({
      ...c,
      assumidaPor: c.assumidaPor ?? "",
      assumidaEm: c.assumidaEm ?? 0,
      criadaEm: c.criadaEm ?? c.mensagens?.[0]?.em ?? c.atualizadaEm ?? 0,
      mensagens: (c.mensagens ?? []).map((m) => ({ ...m, autor: m.autor ?? "" })),
    })),
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
 * O estado inicial do sistema.
 *
 * Nasce com os dois acessos da demonstração e uma loja vazia. Os cadastros
 * ficam em branco de propósito: o sistema nunca inventa cliente, produto ou
 * número. O que aparecer na tela foi alguém que cadastrou.
 */
export function bancoInicial(): Banco {
  return {
    usuarios: [
      {
        id: "u-admin",
        usuario: "administrador",
        nome: "Administrador",
        papel: "admin",
        senha: "1234",
      },
      {
        id: "u-loja-teste-1",
        usuario: "loja teste 1",
        nome: "Loja Teste 1",
        papel: "loja",
        senha: "1234",
        lojaId: LOJA_TESTE_ID,
      },
    ],
    lojas: [novaLoja(LOJA_TESTE_ID, "Loja Teste 1")],
    dados: { [LOJA_TESTE_ID]: dadosVazios() },
    sessao: null,
  };
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
