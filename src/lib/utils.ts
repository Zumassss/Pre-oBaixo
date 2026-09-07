import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const brlCents = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const compact = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export const formatBRL = (value: number) => brl.format(value);
export const formatBRLCents = (value: number) => brlCents.format(value);
export const formatCompact = (value: number) => compact.format(value);
export const formatNumber = (value: number) =>
  new Intl.NumberFormat("pt-BR").format(value);

/** "há 3 min" a partir de um timestamp. */
export function timeAgo(date: Date, now: Date = new Date()) {
  const seconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (seconds < 60) return `há ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  return `há ${Math.floor(hours / 24)}d`;
}

export function formatClock(date: Date) {
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
