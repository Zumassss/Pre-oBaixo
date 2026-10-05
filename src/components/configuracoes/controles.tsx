"use client";

import { Check, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Liga e desliga. É um botão com papel de interruptor, para leitor de tela. */
export function Interruptor({
  ligado,
  onAlternar,
  rotulo,
  descricao,
  icone: Icone,
}: {
  ligado: boolean;
  onAlternar: (v: boolean) => void;
  rotulo: string;
  descricao?: string;
  icone?: LucideIcon;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      onClick={() => onAlternar(!ligado)}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors",
        ligado ? "border-brand-500/35 bg-brand-500/[0.06]" : "border-hairline bg-nivel-1 hover:bg-nivel-2",
      )}
    >
      {Icone && (
        <Icone className={cn("mt-0.5 h-4 w-4 shrink-0", ligado ? "text-brand-400" : "text-fg-ghost")} strokeWidth={2} />
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-medium text-fg">{rotulo}</span>
        {descricao && <span className="mt-0.5 block text-[11.5px] leading-relaxed text-fg-faint">{descricao}</span>}
      </span>
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors",
          ligado ? "bg-brand-500" : "bg-nivel-4",
        )}
      >
        <span
          className={cn(
            "h-4 w-4 rounded-full bg-white shadow transition-transform duration-200",
            ligado ? "translate-x-4" : "translate-x-0",
          )}
        />
      </span>
    </button>
  );
}

/** Uma opção marcável, em formato de etiqueta. */
export function Opcao({
  marcada,
  onAlternar,
  rotulo,
}: {
  marcada: boolean;
  onAlternar: (v: boolean) => void;
  rotulo: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={marcada}
      onClick={() => onAlternar(!marcada)}
      className={cn(
        "flex items-center gap-2 rounded-full border px-3.5 py-2 text-[12.5px] transition-colors",
        marcada
          ? "border-brand-500/45 bg-brand-500/[0.1] font-medium text-fg"
          : "border-hairline bg-nivel-1 text-fg-muted hover:bg-nivel-3",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex h-4 w-4 items-center justify-center rounded-[5px] border",
          marcada ? "border-brand-500 bg-brand-500 text-white" : "border-fg-ghost/60",
        )}
      >
        {marcada && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      {rotulo}
    </button>
  );
}

/** Escolha de uma entre poucas opções, lado a lado. */
export function Segmentado<T extends string>({
  valor,
  opcoes,
  onEscolher,
  rotulo,
}: {
  valor: T;
  opcoes: { valor: T; titulo: string; descricao?: string; icone?: LucideIcon }[];
  onEscolher: (v: T) => void;
  rotulo: string;
}) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {opcoes.map(({ valor: v, titulo, descricao, icone: Icone }) => {
        const ativo = v === valor;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={ativo}
            onClick={() => onEscolher(v)}
            className={cn(
              "flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors",
              ativo ? "border-brand-500/50 bg-brand-500/[0.1]" : "border-hairline bg-nivel-1 hover:bg-nivel-3",
            )}
          >
            {Icone && (
              <Icone className={cn("mt-0.5 h-4 w-4 shrink-0", ativo ? "text-brand-400" : "text-fg-ghost")} strokeWidth={2} />
            )}
            <span className="min-w-0">
              <span className="block text-[12.5px] font-semibold text-fg">{titulo}</span>
              {descricao && <span className="mt-0.5 block text-[11px] leading-snug text-fg-faint">{descricao}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Valor em reais. Guarda número; mostra com vírgula. */
export function EntradaReais({
  valor,
  onMudar,
  id,
  placeholder = "0,00",
}: {
  valor: number;
  onMudar: (v: number) => void;
  id?: string;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[12.5px] text-fg-ghost">R$</span>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={0}
        step="0.5"
        value={Number.isFinite(valor) && valor !== 0 ? String(valor) : ""}
        placeholder={placeholder}
        onChange={(e) => onMudar(Math.max(0, Number(e.target.value.replace(",", ".")) || 0))}
        className="field tnum !pl-10"
      />
    </div>
  );
}

/** Título de uma seção da área de ajustes. */
export function Secao({
  id,
  icone: Icone,
  titulo,
  descricao,
  children,
}: {
  id: string;
  icone: LucideIcon;
  titulo: string;
  descricao: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="panel scroll-mt-24 p-5">
      <header className="mb-4 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/12 text-brand-400 ring-1 ring-inset ring-brand-500/25">
          <Icone className="h-4 w-4" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-fg">{titulo}</h2>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-fg-faint">{descricao}</p>
        </div>
      </header>
      {children}
    </section>
  );
}
