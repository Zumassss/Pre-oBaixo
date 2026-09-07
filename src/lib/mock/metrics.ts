/**
 * Séries e indicadores da operação.
 *
 * Tudo aqui é determinístico de propósito: o servidor e o cliente precisam
 * renderizar exatamente os mesmos números, senão a hidratação quebra. Nada de
 * `Math.random()` neste arquivo.
 */

/**
 * Arredonda para 3 casas.
 *
 * `Math.sin`/`Math.cos` não são bit a bit iguais entre Node e navegador — a
 * especificação permite implementações diferentes. Sem este corte, o HTML do
 * servidor e o do cliente divergem nos últimos dígitos e o React acusa erro de
 * hidratação. Toda conta com trigonometria que chega ao DOM passa por aqui.
 */
const q = (n: number) => Math.round(n * 1000) / 1000;

/** Ruído reproduzível a partir de uma semente — sempre o mesmo resultado. */
function noise(seed: number) {
  const x = Math.sin(seed * 127.1) * 43758.5453;
  return q(x - Math.floor(x));
}

export function series(
  points: number,
  { base, amplitude, trend = 0, seed = 1 }: {
    base: number;
    amplitude: number;
    trend?: number;
    seed?: number;
  },
) {
  return Array.from({ length: points }, (_, i) => {
    const wave = q(Math.sin((i / points) * Math.PI * 2.4)) * amplitude * 0.55;
    const jitter = (noise(seed + i) - 0.5) * amplitude;
    return q(Math.max(0, base + wave + jitter + trend * i));
  });
}

export type Kpi = {
  id: string;
  label: string;
  value: string;
  raw: number;
  delta: number;
  hint: string;
  spark: number[];
};

export const kpis: Kpi[] = [
  {
    id: "conversas",
    label: "Conversas atendidas",
    value: "4.318",
    raw: 4318,
    delta: 18.4,
    hint: "últimos 7 dias",
    spark: series(24, { base: 140, amplitude: 60, trend: 1.8, seed: 3 }),
  },
  {
    id: "automacao",
    label: "Resolvido sem humano",
    value: "87,2%",
    raw: 87.2,
    delta: 6.1,
    hint: "meta: 80%",
    spark: series(24, { base: 82, amplitude: 8, trend: 0.2, seed: 11 }),
  },
  {
    id: "resposta",
    label: "Tempo de resposta",
    value: "8s",
    raw: 8,
    delta: -42.5,
    hint: "média do agente",
    spark: series(24, { base: 12, amplitude: 5, trend: -0.15, seed: 7 }),
  },
  {
    id: "receita",
    label: "Receita influenciada",
    value: "R$ 186 mil",
    raw: 186_400,
    delta: 24.7,
    hint: "pedidos via WhatsApp",
    spark: series(24, { base: 5800, amplitude: 2200, trend: 90, seed: 19 }),
  },
];

/** Volume de mensagens por hora — usado no gráfico de barras da operação. */
export const hourlyVolume = series(24, {
  base: 120,
  amplitude: 95,
  seed: 42,
}).map((v, i) => ({
  hour: `${String(i).padStart(2, "0")}h`,
  // Curva realista: madrugada baixa, picos às 10h e 19h.
  value: Math.round(
    v * (i < 6 ? 0.18 : i < 9 ? 0.6 : i < 12 ? 1.15 : i < 17 ? 0.95 : i < 21 ? 1.25 : 0.5),
  ),
}));

/** Distribuição do que o agente resolve. */
export const intentBreakdown = [
  { label: "Consulta de preço", value: 34, tone: "brand" as const },
  { label: "Disponibilidade", value: 23, tone: "brand" as const },
  { label: "Horário / endereço", value: 16, tone: "info" as const },
  { label: "Orientação de uso", value: 14, tone: "info" as const },
  { label: "Status de pedido", value: 9, tone: "good" as const },
  { label: "Outros", value: 4, tone: "muted" as const },
];

/** Confiança do modelo por tipo de tarefa. */
export const agentConfidence = [
  { label: "Classificação de intenção", value: 96 },
  { label: "Busca no catálogo", value: 93 },
  { label: "Conteúdo de orientação", value: 88 },
  { label: "Decisão de transferência", value: 91 },
];

/** Amplitude baixa de propósito: tempo de resposta é estável, não serrilhado. */
export const responseTimeline = series(48, {
  base: 9,
  amplitude: 1.6,
  seed: 77,
});

export const conversionTimeline = series(48, {
  base: 22,
  amplitude: 9,
  trend: 0.12,
  seed: 91,
});

export const revenueByDay = [
  { day: "Seg", value: 21400 },
  { day: "Ter", value: 24800 },
  { day: "Qua", value: 23100 },
  { day: "Qui", value: 28600 },
  { day: "Sex", value: 34200 },
  { day: "Sáb", value: 39800 },
  { day: "Dom", value: 14500 },
];
