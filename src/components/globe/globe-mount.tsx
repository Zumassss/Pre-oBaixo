"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { PontoOperacao } from "./operations-globe";

/**
 * Enquanto o WebGL carrega, e onde ele não existe, a esfera é CSS puro.
 *
 * A cor do ponto vem da ficha da marca, que já muda com o tema: no claro,
 * um vermelho claro sobre fundo claro não apareceria.
 */
function GlobeFallback() {
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <div className="relative aspect-square w-[62%] max-w-[420px]">
        <div
          className="absolute inset-0 aura-brand"
          style={{ opacity: "calc(var(--aura-opacidade) * 1.6)" }}
        />
        <div
          className="absolute inset-0 rounded-full text-brand-500"
          style={{
            backgroundImage:
              "radial-gradient(currentColor 1px, transparent 1.4px)",
            backgroundSize: "9px 9px",
            opacity: 0.7,
            maskImage:
              "radial-gradient(circle, #000 38%, rgba(0,0,0,0.7) 62%, transparent 78%)",
          }}
        />
      </div>
    </div>
  );
}

const OperationsGlobe = dynamic(() => import("./operations-globe"), {
  ssr: false,
  loading: () => <GlobeFallback />,
});

/**
 * Monta o globo e o desliga quando ele sai da tela.
 *
 * Sem isso, a GPU continua desenhando 11 mil pontos enquanto a pessoa lê
 * outra parte da página, e é justamente aí que a rolagem engasga.
 */
export function GlobeMount({
  quality,
  pontos,
  claro,
}: {
  quality?: "alta" | "baixa";
  pontos?: PontoOperacao[];
  claro?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visivel, setVisivel] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => setVisivel(entry.isIntersecting),
      { rootMargin: "120px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="h-full w-full">
      {visivel ? (
        <OperationsGlobe quality={quality} pontos={pontos} claro={claro} />
      ) : (
        <GlobeFallback />
      )}
    </div>
  );
}
