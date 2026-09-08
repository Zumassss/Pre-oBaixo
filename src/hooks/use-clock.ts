"use client";

import { useEffect, useState } from "react";

/** Relógio da barra superior, atualizado a cada segundo. */
export function useClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    // A primeira leitura vai para um callback: atualizar estado direto no
    // corpo do efeito dispara renders em cascata.
    const primeira = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(primeira);
      clearInterval(id);
    };
  }, []);

  return now;
}
