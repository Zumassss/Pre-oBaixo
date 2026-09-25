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

/**
 * Tema claro e escuro.
 *
 * O tema mora num atributo do <html>, não em classe de componente: assim a
 * troca é uma linha no CSS e nenhum componente precisa saber em que pele
 * está. O escuro é o padrão e não tem atributo; o claro é `data-tema="claro"`.
 *
 * "Sistema" segue a preferência do aparelho, e é o padrão de fábrica: quem
 * trabalha no balcão de uma farmácia com luz forte não deveria precisar
 * descobrir um botão para conseguir ler a tela.
 */

export type Tema = "claro" | "escuro" | "sistema";

export const CHAVE_TEMA = "preco-baixo:tema";

export const temaLabel: Record<Tema, string> = {
  claro: "Claro",
  escuro: "Escuro",
  sistema: "Sistema",
};

/** O nome por extenso, para leitor de tela e para o título do botão. */
export const temaDescricao: Record<Tema, string> = {
  claro: "Tema claro",
  escuro: "Tema escuro",
  sistema: "Acompanhar o tema do aparelho",
};

/**
 * O script que roda antes da primeira pintura.
 *
 * Sem isto a página nasce escura e vira clara depois que o React monta, e o
 * usuário leva um flash branco na cara a cada carregamento. Por isso é
 * script embutido no <head>, e não efeito de componente.
 *
 * O `try` existe porque em navegação privada o acesso ao armazenamento pode
 * lançar. Falhar aqui significa abrir no escuro, que é aceitável; deixar a
 * exceção subir travaria a página inteira.
 */
export const SCRIPT_TEMA = `(function(){try{
var e=localStorage.getItem(${JSON.stringify(CHAVE_TEMA)})||"sistema";
var c=e==="claro"||(e==="sistema"&&window.matchMedia("(prefers-color-scheme: light)").matches);
if(c)document.documentElement.setAttribute("data-tema","claro");
}catch(_){}})();`;

function preferenciaDoSistema() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: light)").matches;
}

function aplicar(claro: boolean) {
  const raiz = document.documentElement;
  if (claro) raiz.setAttribute("data-tema", "claro");
  else raiz.removeAttribute("data-tema");
}

type Estado = {
  tema: Tema;
  /** Qual pele está no ar de verdade, já resolvido o "sistema". */
  claro: boolean;
  definirTema: (t: Tema) => void;
  /** Vira para a pele oposta e fixa a escolha. */
  alternarTema: () => void;
};

const Ctx = createContext<Estado | null>(null);

export function TemaProvider({ children }: { children: ReactNode }) {
  // Nasce igual ao HTML do servidor. O valor de verdade entra na montagem,
  // e é por isso que não há divergência de hidratação.
  const [tema, setTema] = useState<Tema>("sistema");
  const [claro, setClaro] = useState(false);

  // A leitura sai do corpo do efeito para um callback: o ESLint do React 19
  // barra estado atualizado de forma síncrona dentro de efeito, com razão.
  useEffect(() => {
    const id = setTimeout(() => {
      let salvo: Tema = "sistema";
      try {
        const bruto = localStorage.getItem(CHAVE_TEMA);
        if (bruto === "claro" || bruto === "escuro") salvo = bruto;
      } catch {
        // Sem armazenamento, segue no padrão.
      }
      setTema(salvo);
      setClaro(
        salvo === "claro" || (salvo === "sistema" && preferenciaDoSistema()),
      );
    }, 0);
    return () => clearTimeout(id);
  }, []);

  // Enquanto a escolha for "sistema", mudar o tema do aparelho muda o da tela
  // na hora, sem recarregar.
  useEffect(() => {
    if (tema !== "sistema") return;
    const consulta = window.matchMedia("(prefers-color-scheme: light)");
    const aoMudar = (e: MediaQueryListEvent) => {
      setClaro(e.matches);
      aplicar(e.matches);
    };
    consulta.addEventListener("change", aoMudar);
    return () => consulta.removeEventListener("change", aoMudar);
  }, [tema]);

  const definirTema = useCallback((novo: Tema) => {
    const resolvido = novo === "claro" || (novo === "sistema" && preferenciaDoSistema());
    setTema(novo);
    setClaro(resolvido);
    aplicar(resolvido);
    try {
      localStorage.setItem(CHAVE_TEMA, novo);
    } catch {
      // A escolha vale para esta sessão, só não persiste.
    }
  }, []);

  const alternarTema = useCallback(() => {
    definirTema(claro ? "escuro" : "claro");
  }, [claro, definirTema]);

  const valor = useMemo(
    () => ({ tema, claro, definirTema, alternarTema }),
    [tema, claro, definirTema, alternarTema],
  );

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useTema() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTema precisa estar dentro de TemaProvider");
  return ctx;
}
