"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Bike,
  ChevronDown,
  Download,
  Loader2,
  MessageCircle,
  Search,
  Store,
  X,
} from "lucide-react";
import { PageHeader, Panel } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/empty-state";
import { Reveal } from "@/components/ui/reveal";
import { type Atalho, deIso, diaIso, SeletorPeriodo } from "@/components/ui/calendario";
import { ChipStatus } from "@/components/pedidos/status";
import { GraficoFaturamento, type PontoFaturamento } from "@/components/pedidos/grafico-faturamento";
import { buscarNoServidor } from "@/lib/db/local-db";
import { type Pedido, STATUS_PEDIDO_LABEL, type StatusPedido } from "@/lib/db/types";
import { useBanco } from "@/lib/db/use-db";
import { cn, formatBRLCents } from "@/lib/utils";

type Visao = "lista" | "dia" | "mes";
type Ordem = "recentes" | "antigos" | "maior" | "menor" | "cliente";

const STATUS: StatusPedido[] = [
  "aguardando_receita",
  "aguardando_pagamento",
  "em_preparo",
  "pronto",
  "saiu_entrega",
  "entregue",
  "cancelado",
];

const POR_PAGINA = 100;

function atalhos(hoje: Date): Atalho[] {
  const d = (dias: number) => diaIso(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - dias));
  const h = diaIso(hoje);
  return [
    { rotulo: "Hoje", de: h, ate: h },
    { rotulo: "Ontem", de: d(1), ate: d(1) },
    { rotulo: "Últimos 7 dias", de: d(6), ate: h },
    { rotulo: "Últimos 30 dias", de: d(29), ate: h },
    { rotulo: "Este mês", de: diaIso(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), ate: h },
    {
      rotulo: "Mês passado",
      de: diaIso(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)),
      ate: diaIso(new Date(hoje.getFullYear(), hoje.getMonth(), 0)),
    },
    { rotulo: "Este ano", de: diaIso(new Date(hoje.getFullYear(), 0, 1)), ate: h },
  ];
}

function inicio(iso: string) {
  return deIso(iso).getTime();
}
function fim(iso: string) {
  const d = deIso(iso);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}
function dataHora(em: number) {
  return new Date(em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function semAcento(t: string) {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export default function HistoricoPedidosPage() {
  const { banco, carregado } = useBanco();
  const [hoje, setHoje] = useState<Date | null>(null);
  const [periodo, setPeriodo] = useState({ de: "", ate: "" });
  const [servidor, setServidor] = useState<{ chave: string; pedidos: Pedido[] } | null>(null);
  const [falhou, setFalhou] = useState(false);

  const [busca, setBusca] = useState("");
  const [produto, setProduto] = useState("");
  const [status, setStatus] = useState<Set<StatusPedido>>(new Set());
  const [origem, setOrigem] = useState<"todas" | "whatsapp" | "balcao">("todas");
  const [entrega, setEntrega] = useState<"todas" | "retirada" | "entrega">("todas");
  const [valorMin, setValorMin] = useState("");
  const [valorMax, setValorMax] = useState("");
  const [ordem, setOrdem] = useState<Ordem>("recentes");
  const [visao, setVisao] = useState<Visao>("lista");
  const [limite, setLimite] = useState(POR_PAGINA);
  const [aberto, setAberto] = useState<string | null>(null);
  const [baixando, setBaixando] = useState(false);

  // A data de hoje só existe no navegador: no servidor, o "hoje" seria outro.
  useEffect(() => {
    const t = setTimeout(() => {
      const agora = new Date();
      setHoje(agora);
      const trinta = atalhos(agora)[3];
      setPeriodo({ de: trinta.de, ate: trinta.ate });
    }, 0);
    return () => clearTimeout(t);
  }, []);

  // Busca o período no servidor. A tela só carrega os pedidos recentes; o
  // histórico de meses atrás vive no banco e vem sob demanda.
  const chave = `${banco.loja.id}|${periodo.de}|${periodo.ate}`;
  useEffect(() => {
    if (!carregado || !banco.loja.id || !periodo.de) return;
    let vivo = true;
    void buscarNoServidor(banco.loja.id, "pedidos", inicio(periodo.de), fim(periodo.ate), 20000).then((r) => {
      if (!vivo) return;
      setFalhou(!r.ok);
      setServidor({ chave, pedidos: r.registros.filter((x) => x.d).map((x) => x.d as unknown as Pedido) });
    });
    return () => {
      vivo = false;
    };
  }, [carregado, banco.loja.id, periodo.de, periodo.ate, chave]);

  const carregando = !servidor || servidor.chave !== chave;

  // O que está na tela é mais novo que o que veio do servidor: vence.
  const doPeriodo = useMemo(() => {
    if (!periodo.de) return [];
    const de = inicio(periodo.de);
    const ate = fim(periodo.ate);
    const mapa = new Map<string, Pedido>();
    for (const p of servidor?.chave === chave ? servidor.pedidos : []) mapa.set(p.id, p);
    for (const p of banco.pedidos) if (p.criadoEm >= de && p.criadoEm <= ate) mapa.set(p.id, p);
    return [...mapa.values()];
  }, [servidor, chave, banco.pedidos, periodo]);

  const produtos = useMemo(
    () => [...new Set([...banco.produtos.map((p) => p.nome), ...doPeriodo.flatMap((p) => p.itens.map((i) => i.nome))])].sort((a, b) => a.localeCompare(b)),
    [banco.produtos, doPeriodo],
  );

  const filtrados = useMemo(() => {
    const termo = semAcento(busca.trim());
    const digitos = busca.replace(/\D/g, "");
    const min = Number(valorMin.replace(",", ".")) || 0;
    const max = Number(valorMax.replace(",", ".")) || Infinity;
    const lista = doPeriodo.filter((p) => {
      if (status.size && !status.has(p.status)) return false;
      if (origem !== "todas" && p.origem !== origem) return false;
      if (entrega !== "todas" && p.formaEntrega !== entrega) return false;
      if (p.total < min || p.total > max) return false;
      if (produto && !p.itens.some((i) => i.nome === produto)) return false;
      if (termo) {
        const casa =
          semAcento(p.cliente).includes(termo) ||
          (digitos.length >= 3 && p.telefone.replace(/\D/g, "").includes(digitos)) ||
          String(p.numero) === termo.replace("#", "");
        if (!casa) return false;
      }
      return true;
    });
    const ordenar: Record<Ordem, (a: Pedido, b: Pedido) => number> = {
      recentes: (a, b) => b.criadoEm - a.criadoEm,
      antigos: (a, b) => a.criadoEm - b.criadoEm,
      maior: (a, b) => b.total - a.total,
      menor: (a, b) => a.total - b.total,
      cliente: (a, b) => a.cliente.localeCompare(b.cliente),
    };
    return lista.sort(ordenar[ordem]);
  }, [doPeriodo, busca, status, origem, entrega, valorMin, valorMax, produto, ordem]);

  const validos = filtrados.filter((p) => p.status !== "cancelado");
  const faturamento = validos.reduce((s, p) => s + p.total, 0);
  const itensVendidos = validos.reduce((s, p) => s + p.itens.reduce((n, i) => n + i.quantidade, 0), 0);

  // Até 62 dias o gráfico vai por dia; acima disso, por mês.
  const dias = periodo.de ? Math.round((inicio(periodo.ate) - inicio(periodo.de)) / 86400000) + 1 : 0;
  const porMes = dias > 62;

  const grupos = useMemo(() => {
    const mapa = new Map<string, { pedidos: number; total: number; cancelados: number }>();
    if (!periodo.de) return [];
    // Todos os dias (ou meses) do período aparecem, mesmo os sem venda: um
    // buraco no gráfico é informação, não falta de dado.
    const cursor = deIso(periodo.de);
    const ultimo = deIso(periodo.ate);
    while (cursor <= ultimo) {
      const k = porMes || visao === "mes" ? diaIso(cursor).slice(0, 7) : diaIso(cursor);
      mapa.set(k, { pedidos: 0, total: 0, cancelados: 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    for (const p of filtrados) {
      const k = porMes || visao === "mes" ? diaIso(new Date(p.criadoEm)).slice(0, 7) : diaIso(new Date(p.criadoEm));
      const g = mapa.get(k) ?? { pedidos: 0, total: 0, cancelados: 0 };
      if (p.status === "cancelado") g.cancelados++;
      else {
        g.pedidos++;
        g.total += p.total;
      }
      mapa.set(k, g);
    }
    return [...mapa.entries()].map(([k, g]) => ({ chave: k, ...g }));
  }, [filtrados, periodo, porMes, visao]);

  const pontos: PontoFaturamento[] = grupos.map((g) => {
    const d = deIso(g.chave.length === 7 ? `${g.chave}-01` : g.chave);
    return {
      chave: g.chave,
      rotulo:
        g.chave.length === 7
          ? d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")
          : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      detalhe:
        g.chave.length === 7
          ? d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
          : d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "long" }),
      total: g.total,
      pedidos: g.pedidos,
    };
  });

  const filtrosAtivos =
    Boolean(busca) || Boolean(produto) || status.size > 0 || origem !== "todas" || entrega !== "todas" || Boolean(valorMin) || Boolean(valorMax);

  function limpar() {
    setBusca("");
    setProduto("");
    setStatus(new Set());
    setOrigem("todas");
    setEntrega("todas");
    setValorMin("");
    setValorMax("");
  }

  function descricaoFiltros() {
    const partes = [`Período: ${deIso(periodo.de).toLocaleDateString("pt-BR")} a ${deIso(periodo.ate).toLocaleDateString("pt-BR")}`];
    if (busca) partes.push(`busca "${busca}"`);
    if (produto) partes.push(`produto ${produto}`);
    if (status.size) partes.push(`situação ${[...status].map((s) => STATUS_PEDIDO_LABEL[s]).join(", ")}`);
    if (origem !== "todas") partes.push(origem === "whatsapp" ? "só WhatsApp" : "só balcão");
    if (entrega !== "todas") partes.push(entrega === "entrega" ? "só entregas" : "só retiradas");
    if (valorMin) partes.push(`a partir de R$ ${valorMin}`);
    if (valorMax) partes.push(`até R$ ${valorMax}`);
    return `${partes.join(" · ")}. ${filtrados.length} ${filtrados.length === 1 ? "pedido" : "pedidos"}.`;
  }

  async function baixar() {
    setBaixando(true);
    try {
      const res = await fetch("/api/pedidos/historico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loja: banco.loja.nome, filtros: descricaoFiltros(), pedidos: filtrados }),
      });
      if (!res.ok) throw new Error();
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = res.headers.get("Content-Disposition")?.match(/filename="?([^"]+)"?/)?.[1] ?? "historico.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setBaixando(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1560px]">
      <Link href="/pedidos" className="mb-2 inline-flex items-center gap-1.5 text-[12.5px] text-fg-faint transition-colors hover:text-fg">
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
        Pedidos em andamento
      </Link>
      <PageHeader
        title="Histórico de pedidos"
        description="Todos os pedidos da loja, de qualquer período. A planilha sai com os mesmos filtros da tela."
        action={
          <button onClick={() => void baixar()} disabled={baixando || carregando || filtrados.length === 0} className="btn-primary">
            {baixando ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> : <Download className="h-4 w-4" strokeWidth={2} />}
            {baixando ? "Gerando" : "Baixar Excel"}
          </button>
        }
      />

      {/* Filtros, numa faixa acima de tudo */}
      <Panel className="mb-4 space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {hoje && (
            <SeletorPeriodo
              de={periodo.de}
              ate={periodo.ate}
              atalhos={atalhos(hoje)}
              maximo={diaIso(hoje)}
              onMudar={(de, ate) => {
                setPeriodo({ de, ate });
                setLimite(POR_PAGINA);
              }}
            />
          )}
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-fg-ghost" strokeWidth={2} />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Cliente, telefone ou nº do pedido"
              aria-label="Buscar pedido"
              className="field !py-2 !pl-9.5 !text-[12.5px]"
            />
          </div>
          <select value={produto} onChange={(e) => setProduto(e.target.value)} aria-label="Filtrar por produto" className="field !w-auto max-w-[240px] !py-2 !text-[12.5px]">
            <option value="">Todos os produtos</option>
            {produtos.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)} aria-label="Ordenar" className="field !w-auto !py-2 !text-[12.5px]">
            <option value="recentes">Mais recentes</option>
            <option value="antigos">Mais antigos</option>
            <option value="maior">Maior valor</option>
            <option value="menor">Menor valor</option>
            <option value="cliente">Cliente (A a Z)</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto" role="group" aria-label="Situação">
            {STATUS.map((s) => (
              <button
                key={s}
                onClick={() =>
                  setStatus((atual) => {
                    const novo = new Set(atual);
                    if (novo.has(s)) novo.delete(s);
                    else novo.add(s);
                    return novo;
                  })
                }
                aria-pressed={status.has(s)}
                className={cn("chip shrink-0 transition-colors", status.has(s) && "chip-hot")}
              >
                {STATUS_PEDIDO_LABEL[s]}
              </button>
            ))}
          </div>
          <span className="hidden h-5 w-px bg-hairline sm:block" aria-hidden />
          <select value={origem} onChange={(e) => setOrigem(e.target.value as typeof origem)} aria-label="Origem" className="field !w-auto !py-1.5 !text-[12px]">
            <option value="todas">WhatsApp e balcão</option>
            <option value="whatsapp">Só WhatsApp</option>
            <option value="balcao">Só balcão</option>
          </select>
          <select value={entrega} onChange={(e) => setEntrega(e.target.value as typeof entrega)} aria-label="Entrega" className="field !w-auto !py-1.5 !text-[12px]">
            <option value="todas">Retirada e entrega</option>
            <option value="retirada">Só retirada</option>
            <option value="entrega">Só entrega</option>
          </select>
          <div className="flex items-center gap-1.5">
            <input value={valorMin} onChange={(e) => setValorMin(e.target.value)} inputMode="decimal" placeholder="R$ mín." aria-label="Valor mínimo" className="field tnum !w-[92px] !px-3 !py-1.5 !text-[12px]" />
            <span className="text-[11px] text-fg-ghost">a</span>
            <input value={valorMax} onChange={(e) => setValorMax(e.target.value)} inputMode="decimal" placeholder="R$ máx." aria-label="Valor máximo" className="field tnum !w-[92px] !px-3 !py-1.5 !text-[12px]" />
          </div>
          {filtrosAtivos && (
            <button onClick={limpar} className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium text-brand-400 transition-colors hover:bg-brand-500/10">
              <X className="h-3.5 w-3.5" strokeWidth={2} />
              Limpar filtros
            </button>
          )}
        </div>
      </Panel>

      {/* Números do recorte */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { rotulo: "Pedidos", valor: String(validos.length), dica: "sem contar cancelados" },
          { rotulo: "Faturamento", valor: formatBRLCents(faturamento), dica: "soma dos pedidos válidos" },
          { rotulo: "Ticket médio", valor: formatBRLCents(validos.length ? faturamento / validos.length : 0), dica: "por pedido" },
          { rotulo: "Itens vendidos", valor: String(itensVendidos), dica: "unidades" },
          { rotulo: "Cancelados", valor: String(filtrados.length - validos.length), dica: "no mesmo recorte" },
        ].map((t, i) => (
          <Reveal key={t.rotulo} className="tile p-4" style={{ animation: `rise 0.5s cubic-bezier(0.16,1,0.3,1) ${i * 50}ms both` }}>
            <p className="text-[12px] text-fg-muted">{t.rotulo}</p>
            <p className="tnum mt-2 truncate text-[21px] font-semibold leading-none tracking-[-0.03em] text-fg">
              {carregando ? <span className="inline-block h-5 w-16 animate-pulse rounded bg-nivel-3" /> : t.valor}
            </p>
            <p className="mt-1.5 truncate text-[11px] text-fg-ghost">{t.dica}</p>
          </Reveal>
        ))}
      </div>

      <Panel className="mb-4 p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[14px] font-semibold text-fg">Faturamento por {porMes ? "mês" : "dia"}</h2>
          <p className="text-[11.5px] text-fg-ghost">Sem cancelados. Passe o mouse sobre a barra para ver o valor.</p>
        </div>
        {carregando ? (
          <div className="h-[220px] animate-pulse rounded-xl bg-nivel-2" aria-label="Carregando gráfico" />
        ) : faturamento === 0 ? (
          <div className="flex h-[220px] items-center justify-center rounded-xl bg-nivel-1 text-[12.5px] text-fg-faint">
            Nenhuma venda neste recorte.
          </div>
        ) : (
          <GraficoFaturamento pontos={pontos} titulo={`Faturamento por ${porMes ? "mês" : "dia"}`} />
        )}
      </Panel>

      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-4 py-3">
          <div role="tablist" aria-label="Como ver" className="inline-flex gap-1 rounded-xl border border-hairline bg-nivel-1 p-1">
            {(
              [
                ["lista", "Pedido a pedido"],
                ["dia", "Por dia"],
                ["mes", "Por mês"],
              ] as const
            ).map(([id, rotulo]) => (
              <button
                key={id}
                role="tab"
                aria-selected={visao === id}
                onClick={() => setVisao(id)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                  visao === id ? "bg-brand-500/[0.14] text-fg" : "text-fg-muted hover:bg-nivel-3 hover:text-fg",
                )}
              >
                {rotulo}
              </button>
            ))}
          </div>
          <p className="text-[12px] text-fg-faint">
            {carregando ? "Buscando no servidor..." : `${filtrados.length} ${filtrados.length === 1 ? "pedido" : "pedidos"}`}
            {falhou && " · sem conexão: mostrando só os recentes"}
          </p>
        </div>

        {carregando ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="h-11 animate-pulse rounded-xl bg-nivel-2" />
            ))}
          </div>
        ) : filtrados.length === 0 ? (
          <EmptyState
            icon={Search}
            title="Nenhum pedido neste recorte"
            description={filtrosAtivos ? "Tire um dos filtros ou aumente o período." : "Escolha outro período no calendário."}
            action={filtrosAtivos ? <button onClick={limpar} className="btn-ghost">Limpar filtros</button> : undefined}
          />
        ) : visao === "lista" ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-[12.5px]">
              <thead>
                <tr className="border-b border-hairline text-left text-[10.5px] font-semibold uppercase tracking-[0.12em] text-fg-ghost">
                  <th className="px-4 py-2.5 font-semibold">Nº</th>
                  <th className="px-3 py-2.5 font-semibold">Quando</th>
                  <th className="px-3 py-2.5 font-semibold">Cliente</th>
                  <th className="px-3 py-2.5 font-semibold">Itens</th>
                  <th className="px-3 py-2.5 font-semibold">Situação</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.slice(0, limite).map((p) => {
                  const expandido = aberto === p.id;
                  return (
                    <Fragment key={p.id}>
                      <tr
                        onClick={() => setAberto(expandido ? null : p.id)}
                        className={cn("cursor-pointer border-b border-hairline transition-colors hover:bg-nivel-2", expandido && "bg-nivel-2")}
                      >
                        <td className="tnum px-4 py-2.5 font-mono text-fg-faint">#{p.numero}</td>
                        <td className="tnum whitespace-nowrap px-3 py-2.5 text-fg-muted">{dataHora(p.criadoEm)}</td>
                        <td className="px-3 py-2.5">
                          <span className="flex items-center gap-1.5 font-medium text-fg">
                            {p.cliente}
                            {p.origem === "whatsapp" ? (
                              <MessageCircle className="h-3 w-3 text-fg-ghost" strokeWidth={2} aria-label="WhatsApp" />
                            ) : (
                              <Store className="h-3 w-3 text-fg-ghost" strokeWidth={2} aria-label="Balcão" />
                            )}
                            {p.formaEntrega === "entrega" && <Bike className="h-3 w-3 text-info" strokeWidth={2} aria-label="Entrega" />}
                          </span>
                        </td>
                        <td className="max-w-[320px] truncate px-3 py-2.5 text-fg-muted">
                          {p.itens.map((i) => `${i.quantidade}x ${i.nome}`).join(", ")}
                        </td>
                        <td className="px-3 py-2.5">
                          <ChipStatus status={p.status} className="!px-2 !py-[2px] !text-[9.5px]" />
                        </td>
                        <td className="tnum px-4 py-2.5 text-right font-medium text-fg">
                          <span className="inline-flex items-center gap-1.5">
                            {formatBRLCents(p.total)}
                            <ChevronDown className={cn("h-3.5 w-3.5 text-fg-ghost transition-transform", expandido && "rotate-180")} strokeWidth={2} />
                          </span>
                        </td>
                      </tr>
                      {expandido && (
                        <tr className="border-b border-hairline bg-nivel-1">
                          <td colSpan={6} className="px-4 py-3">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_260px]">
                              <ul className="space-y-1">
                                {p.itens.map((i) => (
                                  <li key={i.produtoId + i.nome} className="flex justify-between gap-3 text-[12.5px]">
                                    <span className="text-fg">
                                      {i.quantidade}x {i.nome}
                                      {i.exigeReceita && <span className="chip chip-warn ml-2 !px-1.5 !py-0 !text-[9px]">receita</span>}
                                    </span>
                                    <span className="tnum text-fg-muted">{formatBRLCents(i.quantidade * i.precoUnitario)}</span>
                                  </li>
                                ))}
                                {p.taxaEntrega > 0 && (
                                  <li className="flex justify-between gap-3 text-[12.5px]">
                                    <span className="text-fg-muted">Entrega</span>
                                    <span className="tnum text-fg-muted">{formatBRLCents(p.taxaEntrega)}</span>
                                  </li>
                                )}
                              </ul>
                              <div className="space-y-1 text-[12px] text-fg-muted">
                                <p>
                                  <span className="text-fg-ghost">Telefone:</span> <span className="tnum">{p.telefone || "—"}</span>
                                </p>
                                {p.enderecoEntrega && (
                                  <p>
                                    <span className="text-fg-ghost">Endereço:</span> {p.enderecoEntrega}
                                  </p>
                                )}
                                <p>
                                  <span className="text-fg-ghost">Pagamento:</span> {p.formaPagamento === "pix" ? "Pix" : "na retirada ou entrega"}
                                  {p.pago ? " · pago" : ""}
                                </p>
                                {p.receitaConferidaPor && (
                                  <p>
                                    <span className="text-fg-ghost">Receita conferida por:</span> {p.receitaConferidaPor}
                                  </p>
                                )}
                                {p.observacao && (
                                  <p>
                                    <span className="text-fg-ghost">Observação:</span> {p.observacao}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            {filtrados.length > limite && (
              <div className="flex justify-center p-4">
                <button onClick={() => setLimite((l) => l + POR_PAGINA)} className="btn-ghost">
                  Mostrar mais {Math.min(POR_PAGINA, filtrados.length - limite)} de {filtrados.length - limite}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-[12.5px]">
              <thead>
                <tr className="border-b border-hairline text-left text-[10.5px] font-semibold uppercase tracking-[0.12em] text-fg-ghost">
                  <th className="px-4 py-2.5 font-semibold">{visao === "mes" || porMes ? "Mês" : "Dia"}</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Pedidos</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Faturamento</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Ticket médio</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Cancelados</th>
                </tr>
              </thead>
              <tbody>
                {[...grupos].reverse().filter((g) => g.pedidos || g.cancelados).map((g) => {
                  const d = deIso(g.chave.length === 7 ? `${g.chave}-01` : g.chave);
                  return (
                    <tr key={g.chave} className="border-b border-hairline">
                      <td className="px-4 py-2.5 font-medium capitalize text-fg">
                        {g.chave.length === 7
                          ? d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
                          : d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", year: "2-digit" })}
                      </td>
                      <td className="tnum px-3 py-2.5 text-right text-fg-muted">{g.pedidos}</td>
                      <td className="tnum px-3 py-2.5 text-right font-medium text-fg">{formatBRLCents(g.total)}</td>
                      <td className="tnum px-3 py-2.5 text-right text-fg-muted">{formatBRLCents(g.pedidos ? g.total / g.pedidos : 0)}</td>
                      <td className="tnum px-4 py-2.5 text-right text-fg-faint">{g.cancelados || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="text-[12.5px] font-semibold text-fg">
                  <td className="px-4 py-3">Total</td>
                  <td className="tnum px-3 py-3 text-right">{validos.length}</td>
                  <td className="tnum px-3 py-3 text-right">{formatBRLCents(faturamento)}</td>
                  <td className="tnum px-3 py-3 text-right">{formatBRLCents(validos.length ? faturamento / validos.length : 0)}</td>
                  <td className="tnum px-4 py-3 text-right">{filtrados.length - validos.length || "—"}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
