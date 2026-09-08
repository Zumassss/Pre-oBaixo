import { cn } from "@/lib/utils";

/*
 * O logotipo real da rede, vetorizado a partir da arte original.
 *
 * Os arquivos vivem em /public e entram por mask-image: o SVG é baixado uma
 * vez e fica em cache, sem pesar no JavaScript, e a cor vem do CSS
 * (currentColor), o que deixa a mesma arte servir tema claro e escuro.
 */

/** Só a cruz. Para espaços estreitos e favicon. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="Preço Baixo"
      className={cn("logo-mask logo-mask-cruz block", className)}
    />
  );
}

/** Logotipo completo com a marca nominal. */
export function LogoFull({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="Preço Baixo Farmácias"
      className={cn("logo-mask logo-mask-full block", className)}
    />
  );
}
