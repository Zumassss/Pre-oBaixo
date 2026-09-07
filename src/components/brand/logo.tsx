import { cn } from "@/lib/utils";

/**
 * Cruz da marca — reconstruída em vetor a partir do logotipo original.
 * Dois retângulos arredondados sobrepostos formam a cruz farmacêutica.
 */
export function LogoMark({
  className,
  glow = false,
}: {
  className?: string;
  glow?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="pb-cross" x1="12" y1="6" x2="88" y2="94">
          <stop offset="0%" stopColor="#ff4363" />
          <stop offset="55%" stopColor="#ff1741" />
          <stop offset="100%" stopColor="#d1052b" />
        </linearGradient>
        {glow && (
          <filter id="pb-cross-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}
      </defs>
      <g filter={glow ? "url(#pb-cross-glow)" : undefined}>
        <rect x="6" y="33" width="88" height="34" rx="13" fill="url(#pb-cross)" />
        <rect x="33" y="6" width="34" height="88" rx="13" fill="url(#pb-cross)" />
      </g>
      {/* Brilho especular sutil no topo da cruz */}
      <rect
        x="37"
        y="10"
        width="26"
        height="10"
        rx="5"
        fill="#fff"
        opacity="0.22"
      />
    </svg>
  );
}

/**
 * Logotipo completo: cruz + marca nominal.
 * O texto é vetorial vivo (Inter 900) para manter nitidez em qualquer escala.
 */
export function LogoFull({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className="h-7 w-7" />
      <div className="flex flex-col leading-none">
        <span
          className="text-[17px] font-black tracking-[-0.035em] text-fg"
          style={{ fontStretch: "condensed" }}
        >
          PREÇO<span className="text-brand-500">BAIXO</span>
        </span>
        <span className="mt-[3px] text-[8.5px] font-semibold tracking-[0.34em] text-fg-faint">
          FARMÁCIAS
        </span>
      </div>
    </div>
  );
}
