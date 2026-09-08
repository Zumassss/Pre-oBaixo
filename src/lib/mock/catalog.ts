/** Catálogo consultado pelo agente durante o atendimento. */

export type Product = {
  id: string;
  name: string;
  category: "Genérico" | "Referência" | "Similar" | "Dermocosmético" | "Higiene";
  price: number;
  stock: number;
  minStock: number;
  prescription: boolean;
  askedTimes: number;
};

export const products: Product[] = [
  {
    id: "sku-1",
    name: "Dipirona Sódica 500mg · 20cp",
    category: "Genérico",
    price: 8.9,
    stock: 312,
    minStock: 60,
    prescription: false,
    askedTimes: 486,
  },
  {
    id: "sku-2",
    name: "Losartana Potássica 50mg · 30cp",
    category: "Genérico",
    price: 12.9,
    stock: 146,
    minStock: 50,
    prescription: true,
    askedTimes: 431,
  },
  {
    id: "sku-3",
    name: "Amoxicilina 500mg · 21cp",
    category: "Genérico",
    price: 24.5,
    stock: 18,
    minStock: 40,
    prescription: true,
    askedTimes: 298,
  },
  {
    id: "sku-4",
    name: "Omeprazol 20mg · 28cp",
    category: "Genérico",
    price: 14.2,
    stock: 204,
    minStock: 50,
    prescription: false,
    askedTimes: 274,
  },
  {
    id: "sku-5",
    name: "Metformina 850mg · 30cp",
    category: "Genérico",
    price: 11.4,
    stock: 168,
    minStock: 45,
    prescription: true,
    askedTimes: 251,
  },
  {
    id: "sku-6",
    name: "Protetor Solar FPS 50 · 120ml",
    category: "Dermocosmético",
    price: 62.9,
    stock: 74,
    minStock: 20,
    prescription: false,
    askedTimes: 187,
  },
  {
    id: "sku-7",
    name: "Vitamina D 2000UI · 60cáps",
    category: "Similar",
    price: 39.9,
    stock: 8,
    minStock: 25,
    prescription: false,
    askedTimes: 164,
  },
  {
    id: "sku-8",
    name: "Fralda Geriátrica G · 8un",
    category: "Higiene",
    price: 34.9,
    stock: 96,
    minStock: 30,
    prescription: false,
    askedTimes: 142,
  },
];

/** Base de conhecimento que alimenta o cérebro do agente. */
export type KnowledgeSource = {
  id: string;
  name: string;
  type: "Catálogo" | "Política" | "Conteúdo clínico" | "Operacional";
  items: number;
  updatedAt: string;
  status: "sincronizado" | "sincronizando" | "pendente";
  reviewedBy?: string;
};

export const knowledgeSources: KnowledgeSource[] = [
  {
    id: "kb-1",
    name: "Catálogo de produtos e preços",
    type: "Catálogo",
    items: 4820,
    updatedAt: "há 6 min",
    status: "sincronizado",
  },
  {
    id: "kb-2",
    name: "Estoque por unidade",
    type: "Catálogo",
    items: 8,
    updatedAt: "há 1 min",
    status: "sincronizando",
  },
  {
    id: "kb-3",
    name: "Conteúdo de orientação ao paciente",
    type: "Conteúdo clínico",
    items: 214,
    updatedAt: "ontem",
    status: "sincronizado",
    reviewedBy: "Dra. Renata Lopes · CRF 00000",
  },
  {
    id: "kb-4",
    name: "Políticas de troca, entrega e pagamento",
    type: "Política",
    items: 36,
    updatedAt: "há 3 dias",
    status: "sincronizado",
  },
  {
    id: "kb-5",
    name: "Horários e endereços das unidades",
    type: "Operacional",
    items: 8,
    updatedAt: "há 2 dias",
    status: "sincronizado",
  },
  {
    id: "kb-6",
    name: "Perguntas frequentes da rede",
    type: "Operacional",
    items: 128,
    updatedAt: "há 5 dias",
    status: "pendente",
  },
];

/** Regras de segurança do agente: o que ele nunca faz sozinho. */
export const guardrails = [
  {
    id: "g-1",
    title: "Nunca prescrever ou sugerir medicamento",
    detail:
      "Pedido de recomendação clínica vai ao farmacêutico da unidade.",
    active: true,
  },
  {
    id: "g-2",
    title: "Nunca opinar sobre interação medicamentosa",
    detail:
      "Pergunta sobre combinar medicamentos transfere na hora.",
    active: true,
  },
  {
    id: "g-3",
    title: "Conteúdo de orientação só se aprovado",
    detail:
      "Só envia material revisado e assinado pelo farmacêutico.",
    active: true,
  },
  {
    id: "g-4",
    title: "Consentimento antes de marketing",
    detail:
      "Campanha só alcança quem tem opt-in registrado.",
    active: true,
  },
  {
    id: "g-5",
    title: "Dado sensível não sai do sistema",
    detail:
      "Compra de medicamento nunca entra em disparo automático.",
    active: true,
  },
];
