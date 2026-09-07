/** Conversas do WhatsApp e base de clientes. */

export type ConversationStatus = "agente" | "humano" | "aguardando" | "resolvida";

export type Message = {
  id: string;
  from: "cliente" | "agente" | "humano";
  text: string;
  at: string;
};

export type Conversation = {
  id: string;
  name: string;
  phone: string;
  store: string;
  status: ConversationStatus;
  lastMessage: string;
  at: string;
  unread: number;
  tags: string[];
  messages: Message[];
};

export const conversations: Conversation[] = [
  {
    id: "c-1",
    name: "Ana Paula Ribeiro",
    phone: "+55 11 9•••• 4821",
    store: "Filial Jardim América",
    status: "agente",
    lastMessage: "Perfeito, pode separar 2 caixas então",
    at: "14:38",
    unread: 0,
    tags: ["recompra", "genéricos"],
    messages: [
      {
        id: "m1",
        from: "cliente",
        text: "Boa tarde! Vocês têm Losartana 50mg?",
        at: "14:31",
      },
      {
        id: "m2",
        from: "agente",
        text: "Boa tarde, Ana! Temos sim — Losartana Potássica 50mg, caixa com 30 comprimidos, por R$ 12,90. Temos 46 unidades na Filial Jardim América.",
        at: "14:31",
      },
      {
        id: "m3",
        from: "cliente",
        text: "E quanto fica se eu levar 2 caixas?",
        at: "14:36",
      },
      {
        id: "m4",
        from: "agente",
        text: "Levando 2 caixas o total fica R$ 25,80. Como você já comprou esse item em julho, posso aplicar o cupom de recompra de 10%: R$ 23,22. Quer que eu reserve?",
        at: "14:36",
      },
      {
        id: "m5",
        from: "cliente",
        text: "Perfeito, pode separar 2 caixas então",
        at: "14:38",
      },
    ],
  },
  {
    id: "c-2",
    name: "Carlos Eduardo Lima",
    phone: "+55 11 9•••• 1177",
    store: "Matriz Centro",
    status: "humano",
    lastMessage: "Vou transferir para nosso farmacêutico responsável",
    at: "14:34",
    unread: 2,
    tags: ["farmacêutico", "interação"],
    messages: [
      {
        id: "m1",
        from: "cliente",
        text: "Posso tomar esse antibiótico junto com o remédio de pressão?",
        at: "14:32",
      },
      {
        id: "m2",
        from: "agente",
        text: "Essa é uma dúvida que precisa de avaliação profissional, Carlos. Vou transferir você agora para o farmacêutico responsável da unidade.",
        at: "14:34",
      },
      {
        id: "m3",
        from: "humano",
        text: "Olá Carlos, aqui é a Dra. Renata, farmacêutica da Matriz Centro. Pode me dizer o nome dos dois medicamentos?",
        at: "14:35",
      },
    ],
  },
  {
    id: "c-3",
    name: "Marta Souza",
    phone: "+55 11 9•••• 7734",
    store: "Filial Boa Vista",
    status: "aguardando",
    lastMessage: "Bom dia, chegou a insulina que eu pedi?",
    at: "14:29",
    unread: 1,
    tags: ["reserva", "refrigerado"],
    messages: [
      {
        id: "m1",
        from: "cliente",
        text: "Bom dia, chegou a insulina que eu pedi?",
        at: "14:29",
      },
    ],
  },
  {
    id: "c-4",
    name: "José Antônio Farias",
    phone: "+55 11 9•••• 3390",
    store: "Filial Nova Esperança",
    status: "resolvida",
    lastMessage: "Obrigado! Já retirei aqui na loja",
    at: "13:58",
    unread: 0,
    tags: ["retirada"],
    messages: [
      {
        id: "m1",
        from: "cliente",
        text: "Obrigado! Já retirei aqui na loja",
        at: "13:58",
      },
    ],
  },
  {
    id: "c-5",
    name: "Fernanda Alves",
    phone: "+55 11 9•••• 5512",
    store: "Filial Vila Nova",
    status: "agente",
    lastMessage: "Enviei o passo a passo de uso no seu WhatsApp",
    at: "13:47",
    unread: 0,
    tags: ["orientação"],
    messages: [
      {
        id: "m1",
        from: "cliente",
        text: "Como eu uso esse spray nasal certinho?",
        at: "13:45",
      },
      {
        id: "m2",
        from: "agente",
        text: "Enviei o passo a passo de uso no seu WhatsApp — é o material aprovado pela nossa farmacêutica. Qualquer sintoma diferente, procure a unidade.",
        at: "13:47",
      },
    ],
  },
  {
    id: "c-6",
    name: "Roberto Nogueira",
    phone: "+55 11 9•••• 8846",
    store: "Filial Parque Industrial",
    status: "agente",
    lastMessage: "Seu pedido #4471 sai para entrega em 20 min",
    at: "13:40",
    unread: 0,
    tags: ["entrega"],
    messages: [
      {
        id: "m1",
        from: "cliente",
        text: "Meu pedido já saiu?",
        at: "13:39",
      },
      {
        id: "m2",
        from: "agente",
        text: "Seu pedido #4471 sai para entrega em 20 min",
        at: "13:40",
      },
    ],
  },
];

export type Customer = {
  id: string;
  name: string;
  phone: string;
  segment: "Alta recorrência" | "Recorrente" | "Novo" | "Inativo";
  lastPurchase: string;
  ltv: number;
  orders: number;
  consent: boolean;
  store: string;
};

export const customers: Customer[] = [
  {
    id: "cli-1",
    name: "Ana Paula Ribeiro",
    phone: "+55 11 9•••• 4821",
    segment: "Alta recorrência",
    lastPurchase: "hoje",
    ltv: 2840,
    orders: 34,
    consent: true,
    store: "Filial Jardim América",
  },
  {
    id: "cli-2",
    name: "Carlos Eduardo Lima",
    phone: "+55 11 9•••• 1177",
    segment: "Recorrente",
    lastPurchase: "3 dias",
    ltv: 1290,
    orders: 18,
    consent: true,
    store: "Matriz Centro",
  },
  {
    id: "cli-3",
    name: "Marta Souza",
    phone: "+55 11 9•••• 7734",
    segment: "Alta recorrência",
    lastPurchase: "1 dia",
    ltv: 4120,
    orders: 52,
    consent: true,
    store: "Filial Boa Vista",
  },
  {
    id: "cli-4",
    name: "José Antônio Farias",
    phone: "+55 11 9•••• 3390",
    segment: "Recorrente",
    lastPurchase: "hoje",
    ltv: 960,
    orders: 12,
    consent: true,
    store: "Filial Nova Esperança",
  },
  {
    id: "cli-5",
    name: "Fernanda Alves",
    phone: "+55 11 9•••• 5512",
    segment: "Novo",
    lastPurchase: "hoje",
    ltv: 78,
    orders: 1,
    consent: true,
    store: "Filial Vila Nova",
  },
  {
    id: "cli-6",
    name: "Roberto Nogueira",
    phone: "+55 11 9•••• 8846",
    segment: "Recorrente",
    lastPurchase: "hoje",
    ltv: 1740,
    orders: 21,
    consent: true,
    store: "Filial Parque Industrial",
  },
  {
    id: "cli-7",
    name: "Luciana Prado",
    phone: "+55 11 9•••• 2204",
    segment: "Inativo",
    lastPurchase: "94 dias",
    ltv: 620,
    orders: 8,
    consent: false,
    store: "Matriz Centro",
  },
  {
    id: "cli-8",
    name: "Paulo Henrique Dias",
    phone: "+55 11 9•••• 6690",
    segment: "Alta recorrência",
    lastPurchase: "2 dias",
    ltv: 3380,
    orders: 41,
    consent: true,
    store: "Filial Jardim América",
  },
];

export type Campaign = {
  id: string;
  name: string;
  status: "ativa" | "agendada" | "encerrada" | "rascunho";
  audience: number;
  sent: number;
  opened: number;
  converted: number;
  revenue: number;
  channel: "WhatsApp";
  scheduledFor: string;
};

export const campaigns: Campaign[] = [
  {
    id: "cmp-1",
    name: "Genéricos -30% · Setembro",
    status: "ativa",
    audience: 1284,
    sent: 1284,
    opened: 1041,
    converted: 218,
    revenue: 28640,
    channel: "WhatsApp",
    scheduledFor: "hoje, 09:00",
  },
  {
    id: "cmp-2",
    name: "Recompra · Anti-hipertensivos",
    status: "ativa",
    audience: 642,
    sent: 642,
    opened: 574,
    converted: 187,
    revenue: 19420,
    channel: "WhatsApp",
    scheduledFor: "recorrente",
  },
  {
    id: "cmp-3",
    name: "Dermocosméticos · Lançamento",
    status: "agendada",
    audience: 2140,
    sent: 0,
    opened: 0,
    converted: 0,
    revenue: 0,
    channel: "WhatsApp",
    scheduledFor: "hoje, 18:00",
  },
  {
    id: "cmp-4",
    name: "Reativação · Inativos 60 dias",
    status: "encerrada",
    audience: 890,
    sent: 890,
    opened: 512,
    converted: 96,
    revenue: 8740,
    channel: "WhatsApp",
    scheduledFor: "02/09",
  },
  {
    id: "cmp-5",
    name: "Dia do Cliente · Cupom exclusivo",
    status: "rascunho",
    audience: 3420,
    sent: 0,
    opened: 0,
    converted: 0,
    revenue: 0,
    channel: "WhatsApp",
    scheduledFor: "—",
  },
];
