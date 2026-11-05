"use client";

import {
  CircleCheck,
  CircleDollarSign,
  CircleX,
  PackageCheck,
  Bike,
  ShoppingBag,
  Stethoscope,
} from "lucide-react";
import { STATUS_PEDIDO_LABEL, type StatusPedido } from "@/lib/db/types";
import { cn } from "@/lib/utils";

/**
 * Aparência de cada etapa do pedido.
 *
 * A etapa se lê pelo nome; a cor fica num ponto ao lado. Com etiqueta
 * colorida em cada pedido, a fila virava um semáforo e nada se destacava.
 * Âmbar só para o que segura o pedido (a receita, por exigência legal).
 */
const ESTILO: Record<StatusPedido, { cor: string; ponto: string }> = {
  aguardando_receita: { cor: "[--ponto:var(--color-caution)]", ponto: "bg-caution" },
  aguardando_pagamento: { cor: "[--ponto:var(--color-info)]", ponto: "bg-info" },
  em_preparo: { cor: "[--ponto:var(--color-fg-muted)]", ponto: "bg-fg-muted" },
  pronto: { cor: "[--ponto:var(--color-positive)]", ponto: "bg-positive" },
  saiu_entrega: { cor: "[--ponto:var(--color-info)]", ponto: "bg-info" },
  entregue: { cor: "[--ponto:var(--color-fg-ghost)]", ponto: "bg-fg-ghost" },
  cancelado: { cor: "[--ponto:var(--color-fg-ghost)]", ponto: "bg-fg-ghost" },
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
    case "saiu_entrega":
      return <Bike {...props} />;
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
    <span className={cn("estado", ESTILO[status].cor, className)}>
      {STATUS_PEDIDO_LABEL[status]}
    </span>
  );
}
