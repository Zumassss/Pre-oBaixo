"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { stores } from "@/lib/mock/stores";

export type Periodo = "hoje" | "7dias" | "30dias";

export const periodoLabel: Record<Periodo, string> = {
  hoje: "Hoje",
  "7dias": "7 dias",
  "30dias": "30 dias",
};

/** Multiplicador aplicado aos números conforme a janela escolhida. */
export const periodoFator: Record<Periodo, number> = {
  hoje: 1,
  "7dias": 6.4,
  "30dias": 25.8,
};

type AppState = {
  unidade: string;
  periodo: Periodo;
  busca: string;
  setUnidade: (id: string) => void;
  setPeriodo: (p: Periodo) => void;
  setBusca: (q: string) => void;
  /** Unidades visíveis conforme o filtro atual. */
  unidadesFiltradas: typeof stores;
  unidadeAtual: (typeof stores)[number] | null;
  fator: number;
  /** Ajusta um número do período base (dia) para a janela escolhida. */
  escala: (valorDiario: number) => number;
};

const Ctx = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [unidade, setUnidade] = useState("todas");
  const [periodo, setPeriodo] = useState<Periodo>("hoje");
  const [busca, setBusca] = useState("");

  const unidadesFiltradas = useMemo(
    () => (unidade === "todas" ? stores : stores.filter((s) => s.id === unidade)),
    [unidade],
  );

  const unidadeAtual = useMemo(
    () => stores.find((s) => s.id === unidade) ?? null,
    [unidade],
  );

  const fator = periodoFator[periodo];

  // Ao filtrar por uma unidade, os números caem para a fatia dela.
  const parcela = useMemo(() => {
    if (unidade === "todas") return 1;
    const total = stores.reduce((soma, s) => soma + s.conversas, 0);
    return (unidadeAtual?.conversas ?? 0) / (total || 1);
  }, [unidade, unidadeAtual]);

  const escala = useCallback(
    (valorDiario: number) => Math.round(valorDiario * fator * parcela),
    [fator, parcela],
  );

  const value = useMemo(
    () => ({
      unidade,
      periodo,
      busca,
      setUnidade,
      setPeriodo,
      setBusca,
      unidadesFiltradas,
      unidadeAtual,
      fator,
      escala,
    }),
    [unidade, periodo, busca, unidadesFiltradas, unidadeAtual, fator, escala],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppState precisa estar dentro de AppStateProvider");
  return ctx;
}
