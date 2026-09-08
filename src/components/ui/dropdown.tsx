"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type Opcao = { value: string; label: string; hint?: string };

/**
 * Seletor simples de verdade: abre, escolhe, fecha.
 * Fecha ao clicar fora e no Esc, e devolve o foco ao gatilho.
 */
export function Dropdown({
  label,
  value,
  options,
  onChange,
  align = "left",
  className,
}: {
  label?: string;
  value: string;
  options: Opcao[];
  onChange: (value: string) => void;
  align?: "left" | "right";
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const gatilho = useRef<HTMLButtonElement>(null);
  const id = useId();

  const atual = options.find((o) => o.value === value);

  useEffect(() => {
    if (!aberto) return;

    const aoClicarFora = (event: MouseEvent) => {
      if (!raiz.current?.contains(event.target as Node)) setAberto(false);
    };
    const aoTeclar = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAberto(false);
        gatilho.current?.focus();
      }
    };

    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  return (
    <div ref={raiz} className={cn("relative", className)}>
      <button
        ref={gatilho}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-controls={id}
        data-active={aberto}
        onClick={() => setAberto((v) => !v)}
        className="btn-ghost !px-3.5 !py-2 !text-[12.5px]"
      >
        {label && <span className="text-fg-ghost">{label}:</span>}
        <span className="max-w-[120px] truncate font-semibold text-fg-muted">
          {atual?.label ?? "Selecionar"}
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-fg-ghost transition-transform duration-200",
            aberto && "rotate-180",
          )}
          strokeWidth={2}
        />
      </button>

      {aberto && (
        <div
          id={id}
          role="listbox"
          className={cn(
            "glass absolute top-[calc(100%+6px)] z-50 max-h-[320px] min-w-[190px] overflow-y-auto rounded-xl p-1 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9)]",
            align === "right" ? "right-0" : "left-0",
          )}
          style={{ animation: "rise 0.18s cubic-bezier(0.16,1,0.3,1) both" }}
        >
          {options.map((opcao) => {
            const selecionado = opcao.value === value;
            return (
              <button
                key={opcao.value}
                role="option"
                aria-selected={selecionado}
                onClick={() => {
                  onChange(opcao.value);
                  setAberto(false);
                }}
                className={cn(
                  "selectable flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px]",
                  selecionado ? "text-fg" : "text-fg-muted",
                )}
              >
                <span className="min-w-0 flex-1 truncate">{opcao.label}</span>
                {opcao.hint && (
                  <span className="tnum shrink-0 font-mono text-[10.5px] text-fg-ghost">
                    {opcao.hint}
                  </span>
                )}
                {selecionado && (
                  <Check className="h-3.5 w-3.5 shrink-0 text-brand-400" strokeWidth={2.5} />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
