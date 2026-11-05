"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  FileWarning,
  MessageCircleWarning,
  PackageMinus,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { GlobePanel } from "@/components/dashboard/globe-panel";
import { SetupChecklist } from "@/components/dashboard/setup-checklist";
import { FilaPedidos } from "@/components/dashboard/fila-pedidos";
import { useAppState } from "@/components/providers/app-state";
import { useBanco, useSessao, useWhatsappNoAr } from "@/lib/db/use-db";
import type { VisaoLoja } from "@/lib/db/types";
import { cn, formatBRLCents, formatNumber } from "@/lib/utils";

/**
 * O painel da loja.
 *
 * Responde três perguntas, nesta ordem: a loja está no ar e com movimento
 * (o globo), como foi o período (quatro números) e o que precisa de alguém
 * agora (as pendências). O resto mora na própria aba: o assistente virou
 * aba no pé do menu e a atividade do agente vive na tela do Agente.
 */
export default function Painel() {
  const { banco, carregado } = useBanco();
  const { usuario } = useSessao();
  const { desde, periodo } = useAppState();

  const conectado = useWhatsappNoAr(banco.whatsapp);
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
  const primeiroNome = (usuario?.nome ?? "").split(" ")[0];

  const pedidosPeriodo = banco.pedidos.filter(
    (p) => p.criadoEm >= desde && p.status !== "cancelado",
  );
  const faturamento = pedidosPeriodo.reduce((soma, p) => soma + p.total, 0);
  const conversasPeriodo = banco.conversas.filter((c) => c.atualizadaEm >= desde);
  const nomePeriodo =
    periodo === "hoje" ? "Hoje" : periodo === "7dias" ? "Últimos 7 dias" : "Últimos 30 dias";

  const numeros = [
    { label: "Vendido", valor: formatBRLCents(faturamento) },
    { label: "Pedidos", valor: formatNumber(pedidosPeriodo.length) },
    {
      label: "Ticket médio",
      valor: pedidosPeriodo.length ? formatBRLCents(faturamento / pedidosPeriodo.length) : "—",
    },
    { label: "Conversas", valor: formatNumber(conversasPeriodo.length) },
  ];

  const nomeLoja = banco.loja.nome || "Loja sem nome";
  const enderecoLoja = banco.loja.configurada
    ? [banco.loja.endereco, banco.loja.bairro, banco.loja.cidade].filter(Boolean).join(", ")
    : "Configure os dados da loja para começar";

  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-fg">
            {saudacao}
            {primeiroNome ? `, ${primeiroNome}` : ""}
          </h1>
          <p className="mt-1 text-[13px] text-fg-muted">
            {nomeLoja}
            <span className="text-fg-faint"> · {enderecoLoja}</span>
          </p>
        </div>
        <span className="flex items-center gap-2 rounded-full border border-hairline px-3 py-1.5 text-[12.5px] text-fg-muted">
          <span
            className={cn("h-2 w-2 rounded-full", conectado ? "bg-positive" : "bg-fg-ghost")}
            aria-hidden
          />
          {conectado ? "WhatsApp no ar" : "WhatsApp fora do ar"}
        </span>
      </header>

      <SetupChecklist />

      {/* O globo é a peça principal. Ao lado, só o que se lê de relance. */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <GlobePanel className="h-[380px] sm:h-[460px] xl:col-span-8 xl:h-[520px]" />

        <div className="flex flex-col gap-5 xl:col-span-4">
          <section className="panel p-5">
            <p className="text-[12px] font-medium text-fg-muted">{nomePeriodo}</p>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-5">
              {numeros.map((n) => (
                <div key={n.label} className="min-w-0">
                  <dt className="text-[12px] text-fg-faint">{n.label}</dt>
                  <dd className="tnum mt-1.5 truncate text-[21px] font-semibold leading-none tracking-[-0.03em] text-fg">
                    {carregado ? n.valor : "—"}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <PrecisaDeVoce banco={banco} className="flex-1" />
        </div>
      </div>

      <FilaPedidos banco={banco} className="max-h-[520px]" />
    </div>
  );
}

type Pendencia = {
  id: string;
  icone: LucideIcon;
  texto: string;
  detalhe: string;
  href: string;
  urgente?: boolean;
};

/**
 * O que está parado esperando alguém da loja.
 *
 * Só entra o que tem ação: chamado do farmacêutico, receita para conferir,
 * Pix sem confirmação, estoque abaixo do mínimo. Lista vazia é a melhor
 * notícia da tela, e ela diz isso.
 */
function PrecisaDeVoce({ banco, className }: { banco: VisaoLoja; className?: string }) {
  const chamados = banco.conversas.filter((c) => c.alerta && c.status !== "resolvida");
  const receitas = banco.pedidos.filter((p) => p.status === "aguardando_receita");
  const pagamentos = banco.pedidos.filter((p) => p.status === "aguardando_pagamento");
  const baixos = banco.produtos.filter((p) => p.estoque < p.estoqueMinimo);

  const itens: Pendencia[] = [];
  if (chamados.length)
    itens.push({
      id: "chamados",
      icone: MessageCircleWarning,
      texto:
        chamados.length === 1
          ? "1 cliente chamou a equipe"
          : `${chamados.length} clientes chamaram a equipe`,
      detalhe: chamados[0].alerta?.resumo || chamados[0].cliente,
      href: "/conversas",
      urgente: true,
    });
  if (receitas.length)
    itens.push({
      id: "receitas",
      icone: FileWarning,
      texto:
        receitas.length === 1 ? "1 receita para conferir" : `${receitas.length} receitas para conferir`,
      detalhe: "O pedido só anda depois da conferência.",
      href: "/pedidos",
    });
  if (pagamentos.length)
    itens.push({
      id: "pagamentos",
      icone: Wallet,
      texto:
        pagamentos.length === 1
          ? "1 Pix para confirmar"
          : `${pagamentos.length} Pix para confirmar`,
      detalhe: "Confira no app do banco e dê baixa no pedido.",
      href: "/pedidos",
    });
  if (baixos.length)
    itens.push({
      id: "estoque",
      icone: PackageMinus,
      texto:
        baixos.length === 1
          ? "1 produto abaixo do mínimo"
          : `${baixos.length} produtos abaixo do mínimo`,
      detalhe: baixos
        .slice(0, 2)
        .map((p) => p.nome)
        .join(", "),
      href: "/catalogo?filtro=repor",
    });

  return (
    <section className={cn("panel flex flex-col p-5", className)}>
      <p className="text-[12px] font-medium text-fg-muted">Precisa de você</p>
      {itens.length === 0 ? (
        <div className="flex flex-1 items-center gap-3 py-4">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-positive" strokeWidth={1.8} />
          <div>
            <p className="text-[13.5px] font-medium text-fg">Tudo em dia</p>
            <p className="text-[12px] text-fg-faint">
              Nenhum chamado, receita ou Pix esperando.
            </p>
          </div>
        </div>
      ) : (
        <ul className="-mx-2 mt-2 space-y-0.5">
          {itens.map((item) => {
            const Icone = item.icone;
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="selectable group flex items-start gap-3 rounded-xl px-2 py-2.5"
                >
                  <Icone
                    className={cn(
                      "mt-0.5 h-4 w-4 shrink-0",
                      item.urgente ? "text-brand-400" : "text-fg-faint",
                    )}
                    strokeWidth={1.9}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-fg">{item.texto}</p>
                    <p className="truncate text-[12px] text-fg-faint">{item.detalhe}</p>
                  </div>
                  <ArrowRight
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fg-ghost transition-transform group-hover:translate-x-0.5"
                    strokeWidth={2}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
