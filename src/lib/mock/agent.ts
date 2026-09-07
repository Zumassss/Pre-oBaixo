/**
 * Fluxo de atividade do agente.
 *
 * Hoje as ações são simuladas no cliente para dar vida à Central de Operações.
 * A troca para dados reais acontece em um único ponto: `subscribeAgentEvents`
 * passa a abrir um WebSocket/SSE em vez de gerar eventos localmente — todo o
 * restante da interface consome exatamente o mesmo contrato.
 */

export type AgentEventKind =
  | "atendimento"
  | "estoque"
  | "promocao"
  | "followup"
  | "orientacao"
  | "crm"
  | "handoff"
  | "alerta";

export type AgentEvent = {
  id: string;
  kind: AgentEventKind;
  title: string;
  detail: string;
  store: string;
  at: number;
  latencyMs: number;
};

export const kindLabel: Record<AgentEventKind, string> = {
  atendimento: "Atendimento",
  estoque: "Estoque",
  promocao: "Campanha",
  followup: "Follow-up",
  orientacao: "Orientação",
  crm: "CRM",
  handoff: "Transferência",
  alerta: "Alerta",
};

/** Tom visual de cada tipo de evento. */
export const kindTone: Record<AgentEventKind, "brand" | "good" | "warn" | "info"> =
  {
    atendimento: "brand",
    estoque: "info",
    promocao: "brand",
    followup: "good",
    orientacao: "info",
    crm: "good",
    handoff: "warn",
    alerta: "warn",
  };

type EventTemplate = {
  kind: AgentEventKind;
  title: string;
  details: string[];
};

const templates: EventTemplate[] = [
  {
    kind: "atendimento",
    title: "Respondendo cliente no WhatsApp",
    details: [
      "Dúvida sobre horário de funcionamento — respondida em 1 turno",
      "Consulta de preço: Dipirona 500mg cx 20cp",
      "Cliente perguntou sobre entrega no bairro — rota confirmada",
      "Verificando disponibilidade de Losartana 50mg",
    ],
  },
  {
    kind: "estoque",
    title: "Consultando estoque da unidade",
    details: [
      "Amoxicilina 500mg — 42 unidades disponíveis",
      "Omeprazol 20mg — repondo a partir da Matriz",
      "Vitamina D 2000UI — 8 unidades, abaixo do mínimo",
      "Insulina NPH — reservada para retirada às 16h",
    ],
  },
  {
    kind: "promocao",
    title: "Disparando campanha segmentada",
    details: [
      "Genéricos -30% enviada para 1.284 clientes com opt-in",
      "Campanha de dermocosméticos agendada para 18h",
      "Reenvio para não abertos — 312 contatos",
      "Cupom de recompra enviado para clientes inativos há 60 dias",
    ],
  },
  {
    kind: "followup",
    title: "Follow-up de recompra",
    details: [
      "Losartana 50mg — ciclo de 30 dias encerrando amanhã",
      "Metformina 850mg — lembrete enviado, cliente confirmou",
      "Cliente respondeu ao lembrete e agendou retirada",
      "Reposição de fralda geriátrica — pedido gerado",
    ],
  },
  {
    kind: "orientacao",
    title: "Orientação de uso enviada",
    details: [
      "Resumo de bula validado pelo farmacêutico responsável",
      "Instrução de horário e posologia enviada com aviso legal",
      "Conteúdo de cuidado enviado — sem recomendação clínica",
      "Encaminhado material educativo aprovado sobre hipertensão",
    ],
  },
  {
    kind: "crm",
    title: "Atualizando ficha no CRM",
    details: [
      "Novo cliente cadastrado com consentimento LGPD registrado",
      "Histórico de compra sincronizado — 3 itens",
      "Preferência de contato atualizada para WhatsApp",
      "Segmento reclassificado para «alta recorrência»",
    ],
  },
  {
    kind: "handoff",
    title: "Transferindo para atendente humano",
    details: [
      "Dúvida sobre interação medicamentosa — farmacêutico acionado",
      "Cliente solicitou falar com pessoa — fila da unidade",
      "Reclamação de pedido — encaminhada à gerência",
      "Caso fora do escopo do agente — protocolo aberto",
    ],
  },
  {
    kind: "alerta",
    title: "Alerta operacional",
    details: [
      "Estoque crítico: Amoxicilina 500mg na Filial Santa Rita",
      "Tempo de resposta acima da meta na Filial Vila Nova",
      "Unidade Alto da Serra sem conexão há 12 min",
      "Pico de mensagens 3× acima da média — escalando capacidade",
    ],
  },
];

const storeNames = [
  "Matriz Centro",
  "Filial Boa Vista",
  "Filial Jardim América",
  "Filial Santa Rita",
  "Filial Nova Esperança",
  "Filial Parque Industrial",
  "Filial Vila Nova",
];

/** Distribuição de frequência — atendimento domina o fluxo real. */
const weightedKinds: AgentEventKind[] = [
  "atendimento",
  "atendimento",
  "atendimento",
  "atendimento",
  "estoque",
  "estoque",
  "followup",
  "followup",
  "crm",
  "orientacao",
  "promocao",
  "handoff",
  "alerta",
];

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

let counter = 0;

export function createAgentEvent(at: number = Date.now()): AgentEvent {
  const kind = pick(weightedKinds);
  const template = templates.find((t) => t.kind === kind)!;
  counter += 1;
  return {
    id: `evt-${at}-${counter}`,
    kind,
    title: template.title,
    detail: pick(template.details),
    store: pick(storeNames),
    at,
    latencyMs: Math.round(180 + Math.random() * 900),
  };
}

/** Histórico inicial, para a tela nunca abrir vazia. */
export function seedAgentEvents(count = 7, now = Date.now()): AgentEvent[] {
  return Array.from({ length: count }, (_, i) =>
    createAgentEvent(now - (count - i) * 9_000 - Math.floor(Math.random() * 4_000)),
  );
}

/**
 * Assina o fluxo de eventos. Retorna a função de cancelamento.
 * O intervalo varia para o ritmo não parecer mecânico.
 */
export function subscribeAgentEvents(
  onEvent: (event: AgentEvent) => void,
  { minDelay = 2200, maxDelay = 5200 } = {},
) {
  let timer: ReturnType<typeof setTimeout>;
  let cancelled = false;

  const schedule = () => {
    const delay = minDelay + Math.random() * (maxDelay - minDelay);
    timer = setTimeout(() => {
      if (cancelled) return;
      onEvent(createAgentEvent());
      schedule();
    }, delay);
  };

  schedule();

  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}
