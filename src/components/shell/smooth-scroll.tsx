"use client";

import { useEffect } from "react";
import Lenis from "lenis";

/**
 * Rolagem com inércia.
 *
 * A rolagem nativa para no instante em que a roda para, o que dá a sensação
 * de corte seco. O Lenis interpola a posição a cada quadro, então o
 * movimento desacelera sozinho. Quem prefere menos movimento continua com a
 * rolagem nativa.
 */
export function SmoothScroll() {
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

    let frame = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, []);

  return null;
}
