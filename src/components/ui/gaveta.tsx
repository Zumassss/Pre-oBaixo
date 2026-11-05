"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Gaveta lateral para editar um registro.
 *
 * Edição fica fora da lista de propósito: campo editável dentro da linha da
 * tabela era fácil de mudar sem querer (um scroll em cima do número do
 * estoque já alterava o valor). Aqui a pessoa abre, vê tudo do item, muda e
 * confirma. Fecha no Esc e no clique fora.
 */
export function Gaveta({
  aberta,
  titulo,
  descricao,
  onFechar,
  rodape,
  children,
  largura = "sm:max-w-[460px]",
}: {
  aberta: boolean;
  titulo: string;
  descricao?: string;
  onFechar: () => void;
  rodape?: React.ReactNode;
  children: React.ReactNode;
  largura?: string;
}) {
  useEffect(() => {
    if (!aberta) return;
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
  }, [aberta, onFechar]);

  if (!aberta) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <button
        aria-label="Fechar"
        onClick={onFechar}
        className="absolute inset-0 cursor-default bg-veu"
        style={{ animation: "aparecer 0.2s ease-out both" }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        data-lenis-prevent
        className={cn(
          "absolute inset-y-0 right-0 flex w-full flex-col border-l border-hairline-strong bg-surface sombra-flutuante",
          largura,
        )}
        style={{ animation: "entrar-direita 0.28s cubic-bezier(0.16,1,0.3,1) both" }}
      >
        <header className="flex items-start justify-between gap-4 border-b border-hairline px-6 py-5">
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold text-fg">{titulo}</h2>
            {descricao && (
              <p className="mt-1 text-[12.5px] leading-relaxed text-fg-faint">{descricao}</p>
            )}
          </div>
          <button
            onClick={onFechar}
            aria-label="Fechar"
            className="shrink-0 rounded-lg p-1.5 text-fg-faint transition-colors hover:bg-nivel-4 hover:text-fg"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {rodape && (
          <footer className="flex flex-wrap items-center gap-2 border-t border-hairline px-6 py-4">
            {rodape}
          </footer>
        )}
      </div>
    </div>
  );
}

/** Um bloco da gaveta, com título curto. */
export function SecaoGaveta({
  titulo,
  children,
  className,
}: {
  titulo: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border-b border-hairline pb-5 pt-1 last:border-0", className)}>
      <h3 className="mb-3 text-[12px] font-medium text-fg-muted">{titulo}</h3>
      <div className="space-y-3.5">{children}</div>
    </section>
  );
}
