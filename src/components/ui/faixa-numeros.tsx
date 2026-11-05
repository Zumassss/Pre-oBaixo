import { cn } from "@/lib/utils";

export type Numero = { rotulo: string; valor: React.ReactNode; dica?: string };

/**
 * Os números de uma tela, numa faixa só.
 *
 * Substitui a fileira de caixinhas (uma por número) que cada tela tinha no
 * topo. Uma superfície com divisórias finas lê como um resumo; quatro caixas
 * iguais liam como quatro coisas disputando atenção.
 */
export function FaixaNumeros({ itens, className }: { itens: Numero[]; className?: string }) {
  const colunas =
    itens.length >= 5 ? "lg:grid-cols-5" : itens.length === 4 ? "lg:grid-cols-4" : itens.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2";
  return (
    <dl className={cn("panel grid grid-cols-2 gap-px overflow-hidden bg-hairline", colunas, className)}>
      {itens.map((n) => (
        <div key={n.rotulo} className="min-w-0 bg-[var(--painel-fundo)] px-5 py-4">
          <dt className="text-[12px] text-fg-muted">{n.rotulo}</dt>
          <dd className="tnum mt-1.5 truncate text-[22px] font-semibold leading-none tracking-[-0.03em] text-fg">{n.valor}</dd>
          {n.dica && <dd className="mt-1.5 truncate text-[11.5px] text-fg-ghost">{n.dica}</dd>}
        </div>
      ))}
    </dl>
  );
}
