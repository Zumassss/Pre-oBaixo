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
  eventos: EventoAgente[];
  /** Conexão com a API do WhatsApp, ainda não ligada. */
  whatsappConectado: boolean;
};

export const BANCO_VAZIO: BancoLocal = {
  loja: LOJA_VAZIA,
  clientes: [],
  produtos: [],
  campanhas: [],
  conversas: [],
  eventos: [],
  whatsappConectado: false,
};
