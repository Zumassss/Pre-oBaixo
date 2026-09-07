"use client";

import { useEffect, useState } from "react";
import {
  seedAgentEvents,
  subscribeAgentEvents,
  type AgentEvent,
} from "@/lib/mock/agent";

/**
 * Fluxo de eventos do agente.
 *
 * A geração acontece só depois da montagem — o HTML do servidor não pode
 * conter valores aleatórios, senão a hidratação diverge.
 */
export function useAgentStream(limit = 24) {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // O preenchimento inicial vai para um callback, não para o corpo do efeito:
    // atualizar estado de forma síncrona aqui dispara renders em cascata.
    const seed = setTimeout(() => {
      setEvents(seedAgentEvents());
      setMounted(true);
    }, 0);

    const unsubscribe = subscribeAgentEvents((event) => {
      setEvents((current) => [event, ...current].slice(0, limit));
    });

    return () => {
      clearTimeout(seed);
      unsubscribe();
    };
  }, [limit]);

  return { events, mounted, latest: events[0] };
}

/** Relógio da operação, atualizado a cada segundo. */
export function useClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  return now;
}

/** Contador que sobe suavemente até o valor final. */
export function useCountUp(target: number, durationMs = 1100) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let frame: number;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      // easeOutExpo — chega rápido e assenta com suavidade
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setValue(target * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return value;
}
