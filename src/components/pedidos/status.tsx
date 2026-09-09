"use client";

import {
  CircleCheck,
  CircleDollarSign,
  CircleX,
  PackageCheck,
  ShoppingBag,
  Stethoscope,
} from "lucide-react";
import { STATUS_PEDIDO_LABEL, type StatusPedido } from "@/lib/db/types";
import { cn } from "@/lib/utils";

/**
 * Aparência de cada etapa do pedido.
 *
 * A conferência de receita é a única em vermelho de alerta: ela não é uma
 * etapa qualquer da fila, é a que segura o pedido por exigência legal.
 */
const ESTILO: Record<StatusPedido, { chip: string; ponto: string }> = {
  aguardando_receita: { chip: "chip-warn", ponto: "bg-caution" },
  aguardando_pagamento: { chip: "chip-info", ponto: "bg-info" },
  em_preparo: { chip: "chip-hot", ponto: "bg-brand-500" },
  pronto: { chip: "chip-good", ponto: "bg-positive" },
  entregue: { chip: "", ponto: "bg-fg-ghost" },
  cancelado: { chip: "", ponto: "bg-fg-ghost" },
};

/**
 * Ícone da etapa.
 *
 * Ele é montado aqui com JSX explícito em vez de devolvido como referência
 * de componente: o ESLint do React trata "componente escolhido durante o
 * render" como erro, e com razão, porque trocar a referência remonta a
 * árvore inteira em vez de só atualizar.
 */
export function IconeStatus({
  status,
  className,
}: {
  status: StatusPedido;
  className?: string;
}) {
  const props = { className, strokeWidth: 2 };
  switch (status) {
    case "aguardando_receita":
      return <Stethoscope {...props} />;
    case "aguardando_pagamento":
      return <CircleDollarSign {...props} />;
    case "em_preparo":
      return <ShoppingBag {...props} />;
    case "pronto":
      return <PackageCheck {...props} />;
    case "cancelado":
      return <CircleX {...props} />;
    default:
      return <CircleCheck {...props} />;
  }
}

export function pontoDoStatus(status: StatusPedido) {
  return ESTILO[status].ponto;
}

export function ChipStatus({
  status,
  className,
}: {
  status: StatusPedido;
  className?: string;
}) {
  return (
    <span className={cn("chip", ESTILO[status].chip, className)}>
      {STATUS_PEDIDO_LABEL[status]}
    </span>
  );
}
