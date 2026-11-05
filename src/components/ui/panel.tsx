import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Panel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={cn("panel", className)}>{children}</section>;
}

/**
 * Cabeçalho de painel.
 *
 * O `eyebrow` (a palavra em caixa alta acima do título) não aparece mais:
 * com um em cada painel, a tela tinha duas linhas de título por bloco. O
 * título sozinho já diz o que é. A prop fica para não quebrar quem passa.
 */
export function PanelHeader({
  title,
  action,
  live = false,
  className,
}: {
  eyebrow?: string;
  title: string;
  action?: React.ReactNode;
  live?: boolean;
  className?: string;
}) {
  return (
    <header
      className={cn("flex items-center justify-between gap-4 px-5 pb-3 pt-4", className)}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <h2 className="truncate text-[15px] font-semibold tracking-[-0.01em] text-fg">
          {title}
        </h2>
        {live && (
          <span className="relative flex h-1.5 w-1.5 shrink-0" title="Atualiza sozinho">
            <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-positive" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-positive" />
          </span>
        )}
      </div>
      {action}
    </header>
  );
}

export function PanelLink({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex shrink-0 items-center gap-1 text-[12px] font-medium text-fg-faint transition-colors hover:text-fg"
    >
      {children}
      <ArrowUpRight
        className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
        strokeWidth={2}
      />
    </button>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[24px] font-semibold tracking-[-0.025em] text-fg">
          {title}
        </h1>
        {description && (
          <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-fg-muted">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
