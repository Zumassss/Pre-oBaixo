import type { SituacaoCliente } from "@/lib/db/types";

/**
 * Cor do ponto de cada situação. Verde é quem comprou; âmbar é oportunidade
 * (pediu preço, largou o pedido); o resto é neutro. O nome vai sempre
 * escrito ao lado, então a cor nunca é a única pista.
 */
export const PONTO_SITUACAO: Record<SituacaoCliente, string> = {
  comprou: "[--ponto:var(--color-positive)]",
  nao_fechou: "[--ponto:var(--color-caution)]",
  orcou: "[--ponto:var(--color-caution)]",
  so_conversou: "[--ponto:var(--color-fg-ghost)]",
  cancelou: "[--ponto:var(--color-fg-ghost)]",
  sem_contato: "[--ponto:var(--color-fg-ghost)]",
};
