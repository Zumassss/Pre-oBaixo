"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";

/**
 * Rolagem com inércia.
 *
 * A rolagem nativa para no instante em que a roda para, o que dá a sensação
 * de corte seco. O Lenis interpola a posição a cada quadro, então o
 * movimento desacelera sozinho. Quem prefere menos movimento continua com a
 * rolagem nativa.
 *
 * Cuidado importante: o Lenis guarda a altura da página em cache e só
 * recalcula sozinho quando a janela muda de tamanho. Neste app a altura muda
 * o tempo todo sem nenhum resize acontecer: a navegação do App Router troca
 * o conteúdo sem recarregar, os dados chegam do armazenamento local depois
 * da montagem e a barra lateral recolhe. Sem avisar o Lenis, ele continua
 * achando que a página é do tamanho antigo e trava a rolagem antes do fim.
 * Por isso o observador de tamanho abaixo.
 */
export function SmoothScroll() {
  const pathname = usePathname();
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReduced) return;

    const lenis = new Lenis({
      duration: 1.05,
      // Curva de desaceleração: rápido no começo, assenta no fim.
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      wheelMultiplier: 1,
      touchMultiplier: 1.6,
      // No toque o próprio sistema já tem inércia; duplicar atrapalha.
      syncTouch: false,
    });

    lenisRef.current = lenis;

    let frame = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);

    // Remede a página sempre que o conteúdo mudar de altura. O agrupamento
    // por quadro evita recalcular várias vezes durante uma mesma animação.
    let pendente = 0;
    const remedir = () => {
      if (pendente) return;
      pendente = requestAnimationFrame(() => {
        pendente = 0;
        lenis.resize();
      });
    };

    const observador = new ResizeObserver(remedir);
    observador.observe(document.body);

    // Imagens e fontes entram depois e empurram o conteúdo para baixo.
    window.addEventListener("load", remedir);

    return () => {
      cancelAnimationFrame(frame);
      if (pendente) cancelAnimationFrame(pendente);
      observador.disconnect();
      window.removeEventListener("load", remedir);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  // Troca de página: o Next zera a rolagem do navegador, mas o Lenis mantém
  // a posição interpolada dele. Remedir e voltar ao topo pelo próprio Lenis
  // mantém os dois em acordo.
  useEffect(() => {
    const lenis = lenisRef.current;
    if (!lenis) return;
    lenis.resize();
    lenis.scrollTo(0, { immediate: true, force: true });
  }, [pathname]);

  return null;
}
