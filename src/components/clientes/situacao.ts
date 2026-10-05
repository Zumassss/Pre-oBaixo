import type { SituacaoCliente } from "@/lib/db/types";

/**
 * Cor de cada situação. Verde é quem comprou; âmbar é oportunidade (pediu
 * preço, largou o pedido); o resto é neutro. A etiqueta sempre leva o nome,
 * então a cor nunca é a única pista.
 */
export const CORES_SITUACAO: Record<SituacaoCliente, string> = {
  comprou: "chip-good",
  nao_fechou: "chip-warn",
  orcou: "chip-warn",
  so_conversou: "",
  cancelou: "",
  sem_contato: "",
};
