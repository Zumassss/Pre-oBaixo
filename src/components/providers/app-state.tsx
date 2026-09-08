"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Periodo = "hoje" | "7dias" | "30dias";

export const periodoLabel: Record<Periodo, string> = {
  hoje: "Hoje",
  "7dias": "Últimos 7 dias",
  "30dias": "Últimos 30 dias",
};

/** Quantos dias cada janela cobre, contando a partir de agora. */
export const periodoDias: Record<Periodo, number> = {
  hoje: 1,
  "7dias": 7,
  "30dias": 30,
};

const CHAVE_BARRA = "preco-baixo:barra-recolhida";

type AppState = {
  periodo: Periodo;
  setPeriodo: (p: Periodo) => void;
  busca: string;
  setBusca: (q: string) => void;
  barraRecolhida: boolean;
  alternarBarra: () => void;
  /** Início da janela do período, em milissegundos. */
  desde: number;
};

const Ctx = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [periodo, setPeriodo] = useState<Periodo>("hoje");
  const [busca, setBusca] = useState("");
  const [barraRecolhida, setBarraRecolhida] = useState(false);

  // A preferência da barra fica salva, mas só é lida depois da montagem para
  // o HTML do servidor e o do cliente começarem iguais.
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        setBarraRecolhida(window.localStorage.getItem(CHAVE_BARRA) === "1");
      } catch {
        // Sem acesso ao armazenamento, segue com a barra aberta.
      }
    }, 0);
    return () => clearTimeout(id);
  }, []);

  const alternarBarra = useCallback(() => {
    setBarraRecolhida((atual) => {
      const proximo = !atual;
      try {
        window.localStorage.setItem(CHAVE_BARRA, proximo ? "1" : "0");
      } catch {
        // Preferência não persiste, mas a sessão funciona.
      }
      return proximo;
    });
  }, []);

  // O relógio vem do estado, não de Date.now() durante a renderização: ler a
  // hora no meio do render é impuro e o React 19 barra. Zero significa "ainda
  // não montou", e nesse instante nada é filtrado.
  const [agora, setAgora] = useState(0);

  useEffect(() => {
    const marcar = () => setAgora(Date.now());
    const primeira = setTimeout(marcar, 0);
    const id = setInterval(marcar, 60_000);
    return () => {
      clearTimeout(primeira);
      clearInterval(id);
    };
  }, []);

  const desde = useMemo(() => {
    if (!agora) return 0;
    const dias = periodoDias[periodo];
    if (dias === 1) {
      const inicio = new Date(agora);
      inicio.setHours(0, 0, 0, 0);
      return inicio.getTime();
    }
    return agora - dias * 24 * 60 * 60 * 1000;
  }, [periodo, agora]);

  const value = useMemo(
    () => ({
      periodo,
      setPeriodo,
      busca,
      setBusca,
      barraRecolhida,
      alternarBarra,
      desde,
    }),
    [periodo, busca, barraRecolhida, alternarBarra, desde],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppState precisa estar dentro de AppStateProvider");
  return ctx;
}
