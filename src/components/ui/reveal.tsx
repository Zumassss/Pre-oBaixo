"use client";

import { useCallback, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Elementos que a superfície pode assumir, conforme a semântica do lugar. */
type TagPermitida = "div" | "li" | "section" | "article" | "button";

type RevealProps = {
  as?: TagPermitida;
  className?: string;
  children?: ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
  "data-selected"?: boolean;
};

/**
 * Superfície com luz que segue o cursor, no espírito do Fluent do Windows.
 *
 * A posição do ponteiro vai direto para as custom properties --mx e --my no
 * style do elemento. Isso não passa pelo estado do React, então mover o mouse
 * não re-renderiza nada: o navegador só repinta o gradiente. A escrita é
 * agendada em requestAnimationFrame, no máximo uma por quadro.
 *
 * O elemento sai de `event.currentTarget`, não de uma ref, então nada é lido
 * durante a renderização.
 */
export function Reveal({ as = "div", className, children, ...rest }: RevealProps) {
  const pendente = useRef<{ el: HTMLElement; x: number; y: number } | null>(null);
  const quadro = useRef(0);

  const aplicar = useCallback(() => {
    quadro.current = 0;
    const alvo = pendente.current;
    if (!alvo) return;
    alvo.el.style.setProperty("--mx", `${alvo.x}px`);
    alvo.el.style.setProperty("--my", `${alvo.y}px`);
  }, []);

  const aoMover = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const el = event.currentTarget;
      const rect = el.getBoundingClientRect();
      pendente.current = {
        el,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      if (!quadro.current) quadro.current = requestAnimationFrame(aplicar);
    },
    [aplicar],
  );

  // Cada tag é escrita em JSX de propósito. Uma tag dinâmica exigiria unir as
  // props de todos os elementos possíveis, o que o TypeScript resolve como
  // `never`, e esconderia o manipulador do analisador de hooks.
  const props = {
    onPointerMove: aoMover,
    className: cn("reveal", className),
    ...rest,
  };

  switch (as) {
    case "li":
      return <li {...props}>{children}</li>;
    case "button":
      return (
        <button type="button" {...props}>
          {children}
        </button>
      );
    case "section":
      return <section {...props}>{children}</section>;
    case "article":
      return <article {...props}>{children}</article>;
    default:
      return <div {...props}>{children}</div>;
  }
}
