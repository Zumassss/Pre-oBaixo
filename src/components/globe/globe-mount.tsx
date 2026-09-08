"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

/** Enquanto o WebGL carrega, e onde ele não existe, a esfera é CSS puro. */
function GlobeFallback() {
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <div className="relative aspect-square w-[62%] max-w-[420px]">
        <div className="absolute inset-0 aura-brand opacity-50" />
        <div
          className="absolute inset-0 rounded-full"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,60,90,0.7) 1px, transparent 1.4px)",
            backgroundSize: "9px 9px",
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
export function GlobeMount({ quality }: { quality?: "alta" | "baixa" }) {
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
      {visivel ? <OperationsGlobe quality={quality} /> : <GlobeFallback />}
    </div>
  );
}
