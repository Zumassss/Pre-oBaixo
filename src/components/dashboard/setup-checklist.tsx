"use client";

import Link from "next/link";
import { ArrowRight, Check, Circle } from "lucide-react";
import { useBanco } from "@/lib/db/use-db";
import { cn } from "@/lib/utils";

/**
 * Primeiros passos da loja.
 *
 * Some sozinho quando tudo estiver pronto. Cada item olha o estado real do
 * sistema, então não dá para marcar como feito sem ter feito.
 */
export function SetupChecklist() {
  const { banco, carregado } = useBanco();

  const passos = [
    {
      id: "loja",
      titulo: "Cadastrar os dados da loja",
      detalhe: "Nome, endereço e farmacêutico responsável",
      pronto: banco.loja.configurada,
      href: "/configuracoes",
    },
    {
      id: "catalogo",
      titulo: "Cadastrar produtos",
      detalhe: "O agente responde preço e estoque a partir daqui",
      pronto: banco.produtos.length > 0,
      href: "/catalogo",
    },
    {
      id: "whatsapp",
      titulo: "Conectar o WhatsApp",
      detalhe: "É por onde as conversas chegam",
      pronto: banco.whatsappConectado,
      href: "/configuracoes",
    },
  ];

  const feitos = passos.filter((p) => p.pronto).length;
  if (!carregado || feitos === passos.length) return null;

  return (
    <div className="panel relative overflow-hidden p-5">
      <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 aura-brand opacity-40" />

      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow !text-brand-400">Primeiros passos</p>
          <h2 className="mt-1 text-[17px] font-semibold tracking-[-0.02em] text-fg">
            Deixe a loja pronta para atender
          </h2>
        </div>
        <span className="tnum chip">
          {feitos} de {passos.length}
        </span>
      </div>

      <ul className="relative mt-4 grid gap-2 sm:grid-cols-3">
        {passos.map((passo) => (
          <li key={passo.id}>
            <Link
              href={passo.href}
              className={cn(
                "group flex h-full items-start gap-2.5 rounded-xl border p-3 transition-colors",
                passo.pronto
                  ? "border-positive/25 bg-positive/[0.06]"
                  : "border-hairline bg-white/[0.028] hover:border-brand-500/35 hover:bg-white/[0.05]",
              )}
            >
              <span className="mt-0.5 shrink-0">
                {passo.pronto ? (
                  <Check className="h-4 w-4 text-positive" strokeWidth={2.5} />
                ) : (
                  <Circle className="h-4 w-4 text-fg-ghost" strokeWidth={2} />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block text-[12.5px] font-medium",
                    passo.pronto ? "text-fg-muted line-through" : "text-fg",
                  )}
                >
                  {passo.titulo}
                </span>
                <span className="mt-0.5 block text-[11.5px] leading-relaxed text-fg-ghost">
                  {passo.detalhe}
                </span>
              </span>
              {!passo.pronto && (
                <ArrowRight
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fg-ghost transition-transform group-hover:translate-x-0.5 group-hover:text-brand-400"
                  strokeWidth={2}
                />
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
