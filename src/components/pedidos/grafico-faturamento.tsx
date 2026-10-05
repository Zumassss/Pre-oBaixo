"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatBRLCents } from "@/lib/utils";

export type PontoFaturamento = { chave: string; rotulo: string; detalhe: string; total: number; pedidos: number };

/** Um número redondo para o topo do eixo: 1, 2, 2,5 ou 5 vezes uma potência de 10. */
function teto(valor: number) {
  if (valor <= 0) return 100;
  const base = 10 ** Math.floor(Math.log10(valor));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * base >= valor) return m * base;
  return 10 * base;
}

function curto(valor: number) {
  if (valor >= 1000) return `R$ ${(valor / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return `R$ ${Math.round(valor)}`;
}

/**
 * Faturamento por dia ou por mês, uma série só.
 *
 * Uma cor (a da marca), sem legenda: o título já diz o que é. Barra fina
 * com o topo arredondado, 2 px de respiro entre barras, grade discreta e
 * rótulo do eixo X só de tempos em tempos, para não amontoar. Passar o mouse
 * (ou focar com o teclado) mostra o valor exato.
 */
export function GraficoFaturamento({ pontos, titulo }: { pontos: PontoFaturamento[]; titulo: string }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [foco, setFoco] = useState<number | null>(null);

  const [largura, setLargura] = useState(900);
  // Mede a largura de verdade: esticar o desenho deformaria o texto do eixo.
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => setLargura(Math.max(280, Math.round(e.contentRect.width))));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const altura = 220;
  const margem = { topo: 12, base: 26, esquerda: 64, direita: 8 };
  const area = { l: largura - margem.esquerda - margem.direita, a: altura - margem.topo - margem.base };

  const maximo = useMemo(() => teto(Math.max(0, ...pontos.map((p) => p.total))), [pontos]);
  const passo = pontos.length ? area.l / pontos.length : 0;
  const barra = Math.max(2, Math.min(28, passo - 2));
  const pularRotulo = Math.ceil(pontos.length / Math.max(3, Math.floor(largura / 80)));
  const linhas = [0, 0.5, 1];
  const total = pontos.reduce((s, p) => s + p.total, 0);

  const atual = foco !== null ? pontos[foco] : null;

  return (
    <figure className="relative" ref={caixa}>
      <figcaption className="sr-only">
        {titulo}. Total de {formatBRLCents(total)} em {pontos.length} períodos. A tabela abaixo traz os mesmos números.
      </figcaption>
      <svg
        viewBox={`0 0 ${largura} ${altura}`}
        width={largura}
        height={altura}
        className="block"
        role="img"
        aria-label={titulo}
        onMouseLeave={() => setFoco(null)}
      >
        {linhas.map((f) => {
          const y = margem.topo + area.a * (1 - f);
          return (
            <g key={f}>
              <line
                x1={margem.esquerda}
                x2={largura - margem.direita}
                y1={y}
                y2={y}
                stroke="var(--color-hairline)"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
              <text x={margem.esquerda - 8} y={y + 3.5} textAnchor="end" className="fill-fg-ghost text-[11px]">
                {curto(maximo * f)}
              </text>
            </g>
          );
        })}
        {pontos.map((p, i) => {
          const h = maximo ? (p.total / maximo) * area.a : 0;
          const x = margem.esquerda + i * passo + (passo - barra) / 2;
          const y = margem.topo + area.a - h;
          const raio = Math.min(4, barra / 2, h);
          return (
            <g key={p.chave}>
              {/* Área de toque maior que a barra: a coluna inteira. */}
              <rect
                x={margem.esquerda + i * passo}
                y={margem.topo}
                width={passo}
                height={area.a}
                fill={foco === i ? "var(--color-nivel-3)" : "transparent"}
                onMouseEnter={() => setFoco(i)}
                tabIndex={0}
                onFocus={() => setFoco(i)}
                onBlur={() => setFoco(null)}
                aria-label={`${p.detalhe}: ${formatBRLCents(p.total)}, ${p.pedidos} pedidos`}
                className="outline-none"
              />
              {h > 0 && (
                <path
                  d={`M${x},${y + h} V${y + raio} Q${x},${y} ${x + raio},${y} H${x + barra - raio} Q${x + barra},${y} ${x + barra},${y + raio} V${y + h} Z`}
                  fill="var(--color-brand-500)"
                  opacity={foco === null || foco === i ? 1 : 0.45}
                  pointerEvents="none"
                />
              )}
              {i % pularRotulo === 0 && (
                <text
                  x={margem.esquerda + i * passo + passo / 2}
                  y={altura - 8}
                  textAnchor="middle"
                  className="fill-fg-ghost text-[11px]"
                >
                  {p.rotulo}
                </text>
              )}
            </g>
          );
        })}
        <line
          x1={margem.esquerda}
          x2={largura - margem.direita}
          y1={margem.topo + area.a}
          y2={margem.topo + area.a}
          stroke="var(--color-fg-ghost)"
          strokeOpacity={0.5}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {atual && foco !== null && (
        <div
          role="status"
          className="glass-solid sombra-flutuante pointer-events-none absolute top-1 z-10 -translate-x-1/2 rounded-xl px-3 py-2"
          style={{
            left: `${((margem.esquerda + foco * passo + passo / 2) / largura) * 100}%`,
          }}
        >
          <p className="whitespace-nowrap text-[11px] text-fg-faint">{atual.detalhe}</p>
          <p className="tnum whitespace-nowrap text-[13px] font-semibold text-fg">{formatBRLCents(atual.total)}</p>
          <p className="tnum whitespace-nowrap text-[11px] text-fg-muted">
            {atual.pedidos} {atual.pedidos === 1 ? "pedido" : "pedidos"}
          </p>
        </div>
      )}
    </figure>
  );
}
