/**
 * Tipos do sistema.
 *
 * Este sistema pertence a UMA unidade da rede. Ele não conhece as outras
 * lojas e não deve exibir dado de nenhuma delas. A visão consolidada da rede
 * é outro produto, para o administrador geral, e virá depois.
 */

/** A unidade que usa este sistema. */
export type Loja = {
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
};

export const LOJA_VAZIA: Loja = {
  nome: "",
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
};

export type Cliente = {
  id: string;
  nome: string;
  telefone: string;
  /** Consentimento para receber campanha, exigido pela LGPD. */
  consentimento: boolean;
  observacao: string;
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

export type OrigemMensagem = "cliente" | "agente" | "atendente";

export type Mensagem = {
  id: string;
  origem: OrigemMensagem;
  texto: string;
  em: number;
};

export type StatusConversa = "aberta" | "com_atendente" | "resolvida";

export type Conversa = {
  id: string;
  cliente: string;
  telefone: string;
  status: StatusConversa;
  mensagens: Mensagem[];
  atualizadaEm: number;
};

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
 * no balcão paga na hora de retirar.
 */
export type StatusPedido =
  | "aguardando_receita"
  | "aguardando_pagamento"
  | "em_preparo"
  | "pronto"
  | "entregue"
  | "cancelado";

export type FormaPagamento = "balcao" | "pix";

export type OrigemPedido = "whatsapp" | "balcao";

export type Pedido = {
  id: string;
  /** Número curto e sequencial, para a equipe chamar em voz alta. */
  numero: number;
  cliente: string;
  telefone: string;
  origem: OrigemPedido;
  itens: ItemPedido[];
  total: number;
  status: StatusPedido;
  formaPagamento: FormaPagamento;
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
  pronto: "Pronto para retirada",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

/** Ordem em que as etapas aparecem na fila. */
export const FILA_PEDIDOS: StatusPedido[] = [
  "aguardando_receita",
  "aguardando_pagamento",
  "em_preparo",
  "pronto",
];

export function pedidoExigeReceita(pedido: Pedido) {
  return pedido.itens.some((i) => i.exigeReceita);
}

export function pedidoEmAberto(pedido: Pedido) {
  return pedido.status !== "entregue" && pedido.status !== "cancelado";
}

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

/** Registro do que o agente fez. Só entra aqui o que aconteceu de verdade. */
export type EventoAgente = {
  id: string;
  tipo: "pergunta" | "resposta" | "erro" | "sistema";
  titulo: string;
  detalhe: string;
  em: number;
};

/** Tudo que o sistema guarda hoje. */
export type BancoLocal = {
  loja: Loja;
  clientes: Cliente[];
  produtos: Produto[];
  campanhas: Campanha[];
  conversas: Conversa[];
  pedidos: Pedido[];
  eventos: EventoAgente[];
  /** Conexão com a API do WhatsApp, ainda não ligada. */
  whatsappConectado: boolean;
  pagamentos: Pagamentos;
};

export const BANCO_VAZIO: BancoLocal = {
  loja: LOJA_VAZIA,
  clientes: [],
  produtos: [],
  campanhas: [],
  conversas: [],
  pedidos: [],
  eventos: [],
  whatsappConectado: false,
  pagamentos: PAGAMENTOS_VAZIO,
};
