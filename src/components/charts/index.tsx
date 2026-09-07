"use client";

import { useId } from "react";
import { cn, formatBRL, formatCompact } from "@/lib/utils";

/* ==================================================================
   Gráficos em SVG puro.
   Sem biblioteca: controle total do traço, peso zero no pacote e
   nenhuma re-renderização cara — só transform e opacity animam.
   ================================================================== */

/**
 * Corta a precisão de valores que vão para o DOM.
 * `Math.sin`/`Math.cos` podem diferir nos últimos dígitos entre Node e
 * navegador, o que quebraria a hidratação do React.
 */
export const quantize = (n: number) => Math.round(n * 1000) / 1000;

function buildPath(values: number[], width: number, height: number, pad = 2) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const stepX = (width - pad * 2) / (values.length - 1);

  return values.map((value, i) => {
    const x = pad + i * stepX;
    const y = pad + (height - pad * 2) * (1 - (value - min) / span);
    return { x, y };
  });
}

/** Curva suave (Catmull-Rom convertida em Bézier) para o traço não ficar duro. */
function smoothPath(points: { x: number; y: number }[]) {
  if (points.length < 2) return "";
  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  return d;
}

/* ------------------------------------------------------------------
   Sparkline — a linha miúda dentro dos indicadores
   ------------------------------------------------------------------ */

export function Sparkline({
  values,
  tone = "brand",
  className,
}: {
  values: number[];
  tone?: "brand" | "positive" | "negative";
  className?: string;
}) {
  const id = useId();
  const width = 120;
  const height = 36;
  const points = buildPath(values, width, height, 3);
  const line = smoothPath(points);
  const area = `${line} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

  const color =
    tone === "positive"
      ? "var(--color-positive)"
      : tone === "negative"
        ? "var(--color-negative)"
        : "var(--color-brand-500)";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn("h-9 w-full", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.38" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#spark-${id})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------
   Gráfico de área — a série principal do painel
   ------------------------------------------------------------------ */

export function AreaChart({
  values,
  labels,
  height = 190,
  suffix = "",
}: {
  values: number[];
  labels?: string[];
  height?: number;
  suffix?: string;
}) {
  const id = useId();
  const width = 700;
  const points = buildPath(values, width, height, 8);
  const line = smoothPath(points);
  const area = `${line} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

  const max = Math.max(...values);
  const min = Math.min(...values);
  const gridLines = 4;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`area-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-brand-500)" stopOpacity="0.42" />
            <stop offset="60%" stopColor="var(--color-brand-600)" stopOpacity="0.10" />
            <stop offset="100%" stopColor="var(--color-brand-700)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`stroke-${id}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--color-brand-600)" />
            <stop offset="50%" stopColor="var(--color-brand-400)" />
            <stop offset="100%" stopColor="var(--color-brand-500)" />
          </linearGradient>
        </defs>

        {Array.from({ length: gridLines + 1 }, (_, i) => (
          <line
            key={i}
            x1="0"
            x2={width}
            y1={(height / gridLines) * i}
            y2={(height / gridLines) * i}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        <path d={area} fill={`url(#area-${id})`} />
        <path
          d={line}
          fill="none"
          stroke={`url(#stroke-${id})`}
          strokeWidth="2"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* Ponto final destacado — "onde estamos agora" */}
        <circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r="3.5"
          fill="var(--color-brand-400)"
        />
        <circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r="8"
          fill="var(--color-brand-500)"
          opacity="0.22"
        />
      </svg>

      {/* Escala vertical */}
      <div className="pointer-events-none absolute inset-y-0 right-1 flex flex-col justify-between py-1 text-[10px] text-fg-ghost">
        <span className="tnum font-mono">
          {Math.round(max)}
          {suffix}
        </span>
        <span className="tnum font-mono">
          {Math.round(min)}
          {suffix}
        </span>
      </div>

      {labels && (
        <div className="mt-2 flex justify-between px-1 text-[10px] text-fg-ghost">
          {labels.map((label) => (
            <span key={label} className="font-mono">
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------
   Barras — volume por hora
   ------------------------------------------------------------------ */

export function BarSeries({
  data,
  height = 132,
  highlightFrom,
}: {
  data: { hour: string; value: number }[];
  height?: number;
  highlightFrom?: number;
}) {
  const max = Math.max(...data.map((d) => d.value));

  return (
    <div>
      <div className="flex items-end gap-[3px]" style={{ height }}>
        {data.map((point, i) => {
          const ratio = point.value / max;
          const hot = highlightFrom !== undefined && i >= highlightFrom;
          return (
            <div
              key={point.hour}
              className="group relative flex-1"
              style={{ height: "100%" }}
            >
              <div
                className={cn(
                  "absolute bottom-0 w-full rounded-[2px] transition-all duration-300",
                  hot
                    ? "bg-gradient-to-t from-brand-700 to-brand-400"
                    : "bg-white/[0.10] group-hover:bg-white/20",
                )}
                style={{
                  height: `${Math.max(3, ratio * 100)}%`,
                  boxShadow: hot
                    ? "0 0 12px -2px rgba(255,23,65,0.6)"
                    : undefined,
                }}
              />
              <div className="pointer-events-none absolute -top-8 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-hairline bg-surface px-2 py-1 text-[10px] text-fg group-hover:block">
                <span className="tnum font-mono">{point.value}</span>
                <span className="text-fg-faint"> · {point.hour}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] font-mono text-fg-ghost">
        <span>00h</span>
        <span>06h</span>
        <span>12h</span>
        <span>18h</span>
        <span>23h</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   Medidor em arco — saúde da operação
   ------------------------------------------------------------------ */

export function ArcGauge({
  value,
  max = 100,
  label,
  caption,
  size = 168,
}: {
  value: number;
  max?: number;
  label: string;
  caption?: string;
  size?: number;
}) {
  const id = useId();
  const ratio = Math.min(1, value / max);
  const radius = size / 2 - 14;
  const circumference = Math.PI * radius; // meio círculo
  const dash = circumference * ratio;

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox={`0 0 ${size} ${size / 2 + 16}`}
        className="w-full"
        style={{ maxWidth: size }}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`gauge-${id}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--color-brand-700)" />
            <stop offset="60%" stopColor="var(--color-brand-500)" />
            <stop offset="100%" stopColor="var(--color-brand-300)" />
          </linearGradient>
        </defs>

        <path
          d={`M 14 ${size / 2} A ${radius} ${radius} 0 0 1 ${size - 14} ${size / 2}`}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d={`M 14 ${size / 2} A ${radius} ${radius} 0 0 1 ${size - 14} ${size / 2}`}
          fill="none"
          stroke={`url(#gauge-${id})`}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          style={{
            filter: "drop-shadow(0 0 6px rgba(255,23,65,0.55))",
            transition: "stroke-dasharray 900ms cubic-bezier(0.16,1,0.3,1)",
          }}
        />

        {/* Marcações finas ao longo do arco */}
        {Array.from({ length: 21 }, (_, i) => {
          const angle = Math.PI * (i / 20);
          const inner = radius - 12;
          const outer = radius - 8;
          const cx = size / 2;
          const cy = size / 2;
          const cos = quantize(Math.cos(angle));
          const sin = quantize(Math.sin(angle));
          return (
            <line
              key={i}
              x1={quantize(cx - cos * inner)}
              y1={quantize(cy - sin * inner)}
              x2={quantize(cx - cos * outer)}
              y2={quantize(cy - sin * outer)}
              stroke="rgba(255,255,255,0.14)"
              strokeWidth="1"
            />
          );
        })}
      </svg>

      <div className="-mt-8 text-center">
        <p className="tnum font-mono text-[30px] font-semibold leading-none text-fg">
          {value.toLocaleString("pt-BR")}
        </p>
        <p className="mt-1.5 text-[12px] font-medium text-fg-muted">{label}</p>
        {caption && <p className="mt-0.5 text-[11px] text-fg-ghost">{caption}</p>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   Barra de proporção — intenções e confiança
   ------------------------------------------------------------------ */

export function MeterRow({
  label,
  value,
  suffix = "%",
  tone = "brand",
}: {
  label: string;
  value: number;
  suffix?: string;
  tone?: "brand" | "good" | "info" | "muted";
}) {
  const fill =
    tone === "good"
      ? "linear-gradient(90deg, #0f8a54, var(--color-positive))"
      : tone === "info"
        ? "linear-gradient(90deg, #1e4f8f, var(--color-info))"
        : tone === "muted"
          ? "linear-gradient(90deg, rgba(255,255,255,0.14), rgba(255,255,255,0.3))"
          : "linear-gradient(90deg, var(--color-brand-700), var(--color-brand-400))";

  return (
    <div className="group">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="truncate text-[12px] text-fg-muted">{label}</span>
        <span className="tnum shrink-0 font-mono text-[12px] font-medium text-fg">
          {value}
          {suffix}
        </span>
      </div>
      <div className="h-[5px] overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{
            width: `${value}%`,
            background: fill,
            boxShadow:
              tone === "brand" ? "0 0 10px -1px rgba(255,23,65,0.7)" : undefined,
          }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   Colunas verticais — receita por dia
   ------------------------------------------------------------------ */

export function ColumnChart({
  data,
  height = 150,
  formatAs = "raw",
}: {
  data: { day: string; value: number }[];
  height?: number;
  /** Server Components não podem passar funções — a formatação é escolhida por nome. */
  formatAs?: "raw" | "compact" | "currency";
}) {
  const max = Math.max(...data.map((d) => d.value));
  const format = (value: number) =>
    formatAs === "compact"
      ? formatCompact(value)
      : formatAs === "currency"
        ? formatBRL(value)
        : value.toLocaleString("pt-BR");

  return (
    <div>
      <div className="flex items-end justify-between gap-2" style={{ height }}>
        {data.map((point, i) => {
          const isPeak = point.value === max;
          return (
            <div key={point.day} className="group flex flex-1 flex-col items-center justify-end gap-2" style={{ height: "100%" }}>
              <span
                className={cn(
                  "tnum font-mono text-[10px] transition-colors",
                  isPeak ? "text-brand-300" : "text-fg-ghost",
                )}
              >
                {format(point.value)}
              </span>
              <div
                className={cn(
                  "w-full rounded-t-[4px] transition-all duration-500",
                  isPeak
                    ? "bg-gradient-to-t from-brand-700 via-brand-600 to-brand-400"
                    : "bg-gradient-to-t from-white/[0.06] to-white/[0.16] group-hover:to-white/25",
                )}
                style={{
                  height: `${(point.value / max) * 78}%`,
                  boxShadow: isPeak
                    ? "0 0 20px -4px rgba(255,23,65,0.75)"
                    : undefined,
                  animation: `rise 0.7s cubic-bezier(0.16,1,0.3,1) ${i * 60}ms both`,
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between gap-2">
        {data.map((point) => (
          <span
            key={point.day}
            className="flex-1 text-center text-[10.5px] text-fg-faint"
          >
            {point.day}
          </span>
        ))}
      </div>
    </div>
  );
}
