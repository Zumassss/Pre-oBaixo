"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Bell,
  CircleCheck,
  ClipboardList,
  PackageCheck,
  Stethoscope,
  MessageSquareWarning,
  PackageX,
  Settings,
  Store,
  type LucideIcon,
} from "lucide-react";
import { useBanco } from "@/lib/db/use-db";
import { cn } from "@/lib/utils";

type Aviso = {
  id: string;
  icon: LucideIcon;
  titulo: string;
  detalhe: string;
  href: string;
  tom: "alerta" | "info";
};

/**
 * Avisos do sistema.
 *
 * São derivados do estado real: o que está faltando configurar, o que está
 * sem estoque, o que precisa de atendente. Nenhum aviso é inventado, então a
 * lista fica vazia quando está tudo em ordem.
 */
function calcularAvisos(banco: ReturnType<typeof useBanco>["banco"]): Aviso[] {
  const avisos: Aviso[] = [];

  if (!banco.loja.configurada) {
    avisos.push({
      id: "loja",
      icon: Store,
      titulo: "Loja ainda não configurada",
      detalhe: "Informe nome, endereço e responsável para o agente atender.",
      href: "/configuracoes",
      tom: "alerta",
    });
  }

  if (!banco.whatsappConectado) {
    avisos.push({
      id: "whatsapp",
      icon: MessageSquareWarning,
      titulo: "WhatsApp não conectado",
      detalhe: "Sem a conexão, nenhuma conversa chega ao sistema.",
      href: "/configuracoes",
      tom: "alerta",
    });
  }

  // Receita pendente vem antes de tudo: é o que impede a loja de entregar.
  const naReceita = banco.pedidos.filter(
    (p) => p.status === "aguardando_receita",
  );
  if (naReceita.length > 0) {
    avisos.push({
      id: "receita",
      icon: Stethoscope,
      titulo: `${naReceita.length} ${naReceita.length === 1 ? "pedido aguardando" : "pedidos aguardando"} receita`,
      detalhe: "O farmacêutico precisa conferir antes de separar.",
      href: "/pedidos",
      tom: "alerta",
    });
  }

  const prontos = banco.pedidos.filter((p) => p.status === "pronto");
  if (prontos.length > 0) {
    avisos.push({
      id: "prontos",
      icon: PackageCheck,
      titulo: `${prontos.length} ${prontos.length === 1 ? "pedido pronto" : "pedidos prontos"} para retirada`,
      detalhe: prontos
        .slice(0, 3)
        .map((p) => p.cliente)
        .join(", "),
      href: "/pedidos",
      tom: "info",
    });
  }

  const aguardandoPagamento = banco.pedidos.filter(
    (p) => p.status === "aguardando_pagamento",
  );
  if (aguardandoPagamento.length > 0) {
    avisos.push({
      id: "pagamento",
      icon: ClipboardList,
      titulo: `${aguardandoPagamento.length} ${aguardandoPagamento.length === 1 ? "pedido aguardando" : "pedidos aguardando"} pagamento`,
      detalhe: "Confira se o Pix caiu na conta da loja.",
      href: "/pedidos",
      tom: "info",
    });
  }

  const semEstoque = banco.produtos.filter((p) => p.estoque < p.estoqueMinimo);
  if (semEstoque.length > 0) {
    avisos.push({
      id: "estoque",
      icon: PackageX,
      titulo: `${semEstoque.length} ${semEstoque.length === 1 ? "produto abaixo" : "produtos abaixo"} do mínimo`,
      detalhe: semEstoque
        .slice(0, 3)
        .map((p) => p.nome)
        .join(", "),
      href: "/catalogo",
      tom: "alerta",
    });
  }

  const aguardando = banco.conversas.filter((c) => c.status === "aberta");
  if (aguardando.length > 0) {
    avisos.push({
      id: "conversas",
      icon: MessageSquareWarning,
      titulo: `${aguardando.length} ${aguardando.length === 1 ? "conversa aguardando" : "conversas aguardando"}`,
      detalhe: "Ninguém respondeu ainda. Confira se precisa de atendente.",
      href: "/conversas",
      tom: "info",
    });
  }

  return avisos;
}

export function NotificationBell() {
  const { banco } = useBanco();
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);

  const avisos = useMemo(() => calcularAvisos(banco), [banco]);
  const alertas = avisos.filter((a) => a.tom === "alerta").length;

  useEffect(() => {
    if (!aberto) return;
    const aoClicarFora = (e: MouseEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false);
    };
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  return (
    <div ref={raiz} className="relative">
      <button
        onClick={() => setAberto((v) => !v)}
        aria-label="Notificações"
        aria-expanded={aberto}
        className={cn(
          "relative flex h-9 w-9 items-center justify-center rounded-full border transition-colors",
          aberto
            ? "border-brand-500/40 bg-brand-500/12 text-brand-300"
            : "border-hairline bg-white/[0.035] text-fg-muted hover:bg-white/[0.08] hover:text-fg",
        )}
      >
        <Bell className="h-4 w-4" strokeWidth={1.9} />
        {avisos.length > 0 && (
          <span
            className={cn(
              "absolute right-1.5 top-1.5 flex h-2 w-2 items-center justify-center rounded-full",
              alertas > 0 ? "bg-brand-500" : "bg-info",
            )}
          >
            {alertas > 0 && (
              <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-brand-500" />
            )}
          </span>
        )}
      </button>

      {aberto && (
        <div
          data-lenis-prevent
          className="glass-solid absolute right-0 top-[calc(100%+8px)] z-50 max-h-[400px] w-[320px] overflow-y-auto rounded-xl p-1.5 shadow-[0_24px_60px_-16px_rgba(0,0,0,0.95)]"
          style={{ animation: "rise 0.18s cubic-bezier(0.16,1,0.3,1) both" }}
        >
          <div className="flex items-center justify-between px-2.5 py-2">
            <p className="text-[12.5px] font-semibold text-fg">Notificações</p>
            {avisos.length > 0 && (
              <span className="chip !px-2 !py-[2px] !text-[10px]">
                {avisos.length}
              </span>
            )}
          </div>

          {avisos.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <CircleCheck className="h-5 w-5 text-positive" strokeWidth={1.8} />
              <p className="text-[12.5px] text-fg-muted">Tudo em ordem</p>
              <p className="text-[11.5px] text-fg-ghost">
                Nada pendente na loja agora.
              </p>
            </div>
          ) : (
            <ul className="space-y-0.5">
              {avisos.map((aviso) => {
                const Icon = aviso.icon;
                return (
                  <li key={aviso.id}>
                    <Link
                      href={aviso.href}
                      onClick={() => setAberto(false)}
                      className="selectable flex items-start gap-2.5 rounded-lg px-2.5 py-2.5"
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ring-1 ring-inset",
                          aviso.tom === "alerta"
                            ? "bg-brand-500/12 text-brand-400 ring-brand-500/25"
                            : "bg-info/12 text-info ring-info/25",
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] font-medium text-fg">
                          {aviso.titulo}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-relaxed text-fg-faint">
                          {aviso.detalhe}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          <Link
            href="/configuracoes"
            onClick={() => setAberto(false)}
            className="selectable mt-1 flex items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] text-fg-faint"
          >
            <Settings className="h-3.5 w-3.5" strokeWidth={2} />
            Abrir configurações
          </Link>
        </div>
      )}
    </div>
  );
}
