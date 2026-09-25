import { cn } from "@/lib/utils";

/**
 * O traço do monitor cardíaco.
 *
 * É a assinatura da tela de entrada. A escolha não é enfeite: farmácia é o
 * lugar onde se mede pressão, glicemia e batimento, e a marca da rede já é
 * uma cruz. O traço amarra as duas coisas sem precisar explicar.
 *
 * São duas cópias do mesmo caminho: uma apagada, que mostra a linha inteira,
 * e uma acesa e curta, que corre por cima. O movimento é só
 * `stroke-dashoffset`, que o navegador anima sem recalcular layout nenhum.
 */

/** Um ciclo do traço, com onda P, complexo QRS e onda T. */
const CICLO = [
  "l 46 0",
  "q 9 -9 18 0", // onda P
  "l 12 0",
  "l 7 7", // Q
  "l 7 -34", // R
  "l 7 44", // S
  "l 7 -17",
  "l 16 0",
  "q 14 -15 28 0", // onda T
  "l 72 0",
].join(" ");

const CAMINHO = `M 0 60 ${CICLO} ${CICLO} ${CICLO} ${CICLO}`;

export function Monitor({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 960 120"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={cn("h-full w-full", className)}
    >
      {/* A linha inteira, quase apagada: dá a forma antes de o ponto chegar. */}
      <path
        d={CAMINHO}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ opacity: "var(--traco-apagado)" }}
      />
      {/* O trecho aceso que corre. Largura e brilho vêm de ficha: no tema
          claro o brilho não existe, porque luz sobre branco não aparece. */}
      <path
        d={CAMINHO}
        fill="none"
        stroke="currentColor"
        strokeWidth="var(--traco-largura)"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="traco-vivo"
        style={{ filter: "var(--traco-brilho)" }}
      />
    </svg>
  );
}
