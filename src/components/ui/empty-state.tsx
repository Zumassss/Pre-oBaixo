import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Estado vazio.
 *
 * O sistema começa sem dado nenhum, então esta tela aparece bastante. Ela
 * precisa dizer o que falta e qual é o próximo passo, nunca só "sem
 * resultados".
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-12 text-center",
        className,
      )}
    >
      <div className="relative mb-4">
        <div className="pointer-events-none absolute inset-0 aura-brand opacity-40" />
        <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-hairline bg-white/[0.03]">
          <Icon className="h-5 w-5 text-fg-faint" strokeWidth={1.7} />
        </div>
      </div>
      <p className="text-[14px] font-semibold text-fg">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-fg-faint">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
