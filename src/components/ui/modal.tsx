"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Janela de formulário.
 *
 * Fecha no Esc e no clique fora, e trava a rolagem do fundo enquanto está
 * aberta. Não usa portal: o painel já fica em posição fixa acima de tudo, e
 * um portal traria problema de hidratação sem ganho aqui.
 */
export function Modal({
  aberto,
  titulo,
  descricao,
  onFechar,
  children,
  larguraMaxima = "max-w-lg",
}: {
  aberto: boolean;
  titulo: string;
  descricao?: string;
  onFechar: () => void;
  children: React.ReactNode;
  larguraMaxima?: string;
}) {
  useEffect(() => {
    if (!aberto) return;

    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
    };
    document.addEventListener("keydown", aoTeclar);

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = overflowAnterior;
    };
  }, [aberto, onFechar]);

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      <button
        aria-label="Fechar"
        onClick={onFechar}
        className="fixed inset-0 cursor-default bg-black/70 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        data-lenis-prevent
        className={cn(
          "relative z-10 w-full rounded-2xl border border-hairline-strong bg-surface shadow-[0_30px_80px_-20px_rgba(0,0,0,0.95)]",
          larguraMaxima,
        )}
        style={{ animation: "rise 0.25s cubic-bezier(0.16,1,0.3,1) both" }}
      >
        <header className="flex items-start justify-between gap-4 border-b border-hairline px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-fg">{titulo}</h2>
            {descricao && (
              <p className="mt-1 text-[12.5px] leading-relaxed text-fg-faint">
                {descricao}
              </p>
            )}
          </div>
          <button
            onClick={onFechar}
            aria-label="Fechar"
            className="shrink-0 rounded-lg p-1.5 text-fg-faint transition-colors hover:bg-white/[0.07] hover:text-fg"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </header>

        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

/** Campo de formulário com rótulo. */
export function Campo({
  label,
  children,
  hint,
  className,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-[11.5px] font-medium text-fg-muted">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-fg-ghost">{hint}</span>}
    </label>
  );
}

/** Entrada de texto retangular, para formulário. */
export function Entrada(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-xl border border-hairline bg-white/[0.035] px-3 py-2.5 text-[13px] text-fg outline-none transition-colors placeholder:text-fg-ghost focus:border-brand-500/50 focus:bg-white/[0.055]",
        props.className,
      )}
    />
  );
}

export function AreaTexto(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full resize-y rounded-xl border border-hairline bg-white/[0.035] px-3 py-2.5 text-[13px] leading-relaxed text-fg outline-none transition-colors placeholder:text-fg-ghost focus:border-brand-500/50 focus:bg-white/[0.055]",
        props.className,
      )}
    />
  );
}
