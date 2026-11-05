"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChartNoAxesCombined } from "lucide-react";
import { PageHeader } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/empty-state";
import { ExportButton } from "@/components/relatorios/export-button";
import { GraficoFaturamento } from "@/components/pedidos/grafico-faturamento";
import { ChipStatus } from "@/components/pedidos/status";
import { useBanco } from "@/lib/db/use-db";
import {
  type PeriodoRelatorio,
  RELATORIOS,
  relatorioAtendimento,
  relatorioClientes,
  relatorioEstoque,
  relatorioProdutos,
  relatorioVendas,
  type TipoRelatorio,
} from "@/lib/relatorios";
import type { VisaoLoja } from "@/lib/db/types";
import { cn, formatBRLCents, formatNumber } from "@/lib/utils";

type Atalho = "hoje" | "7dias" | "30dias" | "mes" | "mesPassado";

const ATALHOS: { id: Atalho; rotulo: string }[] = [
  { id: "hoje", rotulo: "Hoje" },
  { id: "7dias", rotulo: "7 dias" },
  { id: "30dias", rotulo: "30 dias" },
  { id: "mes", rotulo: "Este mês" },
  { id: "mesPassado", rotulo: "Mês passado" },
];

const NOME_ATALHO: Record<Atalho, string> = {
  hoje: "Hoje",
  "7dias": "Últimos 7 dias",
  "30dias": "Últimos 30 dias",
  mes: "Este mês",
  mesPassado: "Mês passado",
};

/** O intervalo de cada atalho, de 00:00 do primeiro dia até agora (ou o fim do mês). */
function periodoDe(atalho: Atalho, agora: number): PeriodoRelatorio {
  const hoje = new Date(agora);
  hoje.setHours(0, 0, 0, 0);
  const dia = 86_400_000;
  const rotulo = NOME_ATALHO[atalho];
  if (atalho === "hoje") return { de: hoje.getTime(), ate: agora, rotulo };
  if (atalho === "7dias") return { de: hoje.getTime() - 6 * dia, ate: agora, rotulo };
  if (atalho === "30dias") return { de: hoje.getTime() - 29 * dia, ate: agora, rotulo };
  if (atalho === "mes") return { de: new Date(hoje.getFullYear(), hoje.getMonth(), 1).getTime(), ate: agora, rotulo };
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1).getTime();
  const fim = new Date(hoje.getFullYear(), hoje.getMonth(), 1).getTime() - 1;
  return { de: inicio, ate: fim, rotulo };
}

function dataCurta(em: number) {
  return new Date(em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/**
 * Relatórios.
 *
 * Cada relatório responde uma pergunta, e a pergunta fica escrita ao lado do
 * nome. O período é escolhido aqui mesmo, e a prévia mostra exatamente o que
 * vai para a planilha. Antes a tela mostrava o período do topo e a planilha
 * saía com tudo desde sempre.
 */
export default function RelatoriosPage() {
  const { banco, carregado } = useBanco();
  const [tipo, setTipo] = useState<TipoRelatorio>("vendas");
  const [atalho, setAtalho] = useState<Atalho>("30dias");

  // O relógio entra pelo estado: ler a hora no render quebra a hidratação.
  const [agora, setAgora] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setAgora(Date.now()), 0);
    return () => clearTimeout(t);
  }, []);

  const periodo = useMemo(() => periodoDe(atalho, agora || 0), [atalho, agora]);
  const definicao = RELATORIOS.find((r) => r.id === tipo)!;

  const temAlgo =
    banco.clientes.length > 0 || banco.produtos.length > 0 || banco.conversas.length > 0 || banco.pedidos.length > 0;

  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader
        title="Relatórios"
        description="Escolha o assunto e o período. A prévia abaixo é exatamente o que vai na planilha."
      />

      {!temAlgo && carregado ? (
        <div className="panel">
          <EmptyState
            icon={ChartNoAxesCombined}
            title="Ainda não há o que relatar"
            description="Os relatórios se montam sozinhos conforme você cadastra clientes e produtos e os pedidos acontecem."
            action={
              <Link href="/configuracoes" className="btn-primary">
                Configurar a loja
              </Link>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[260px_1fr]">
          {/* Os assuntos, cada um com a pergunta que responde. */}
          <nav aria-label="Relatórios" className="space-y-0.5">
            {RELATORIOS.map((r) => (
              <button
                key={r.id}
                onClick={() => setTipo(r.id)}
                data-selected={tipo === r.id}
                className="selectable w-full rounded-xl px-3.5 py-3 text-left"
              >
                <span className={cn("block text-[13.5px] font-medium", tipo === r.id ? "text-fg" : "text-fg-muted")}>
                  {r.titulo}
                </span>
                <span className="mt-0.5 block text-[12px] leading-snug text-fg-faint">{r.pergunta}</span>
              </button>
            ))}
          </nav>

          <section className="panel min-w-0 overflow-hidden">
            <header className="flex flex-wrap items-center gap-3 border-b border-hairline px-5 py-4">
              <div className="min-w-0 flex-1">
                <h2 className="text-[16px] font-semibold text-fg">{definicao.titulo}</h2>
                <p className="mt-0.5 text-[12.5px] text-fg-faint">
                  {definicao.usaPeriodo
                    ? agora
                      ? `${periodo.rotulo}: ${new Date(periodo.de).toLocaleDateString("pt-BR")} a ${new Date(periodo.ate).toLocaleDateString("pt-BR")}`
                      : periodo.rotulo
                    : tipo === "estoque"
                      ? "Situação de agora. Estoque não depende de período."
                      : "Clientes, catálogo, conversas, pedidos e campanhas, sem filtro de data."}
                </p>
              </div>
              <ExportButton
                relatorio={tipo === "completo" ? undefined : tipo}
                periodo={periodo}
                rotulo={tipo === "completo" ? "Baixar planilha completa" : "Baixar este relatório"}
              />
            </header>

            {definicao.usaPeriodo && (
              <div className="flex flex-wrap gap-1 border-b border-hairline px-5 py-2.5" role="group" aria-label="Período">
                {ATALHOS.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setAtalho(a.id)}
                    aria-pressed={atalho === a.id}
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-[12.5px] font-medium transition-colors",
                      atalho === a.id ? "bg-nivel-4 text-fg" : "text-fg-muted hover:bg-nivel-2 hover:text-fg",
                    )}
                  >
                    {a.rotulo}
                  </button>
                ))}
                <Link
                  href="/pedidos/historico"
                  className="ml-auto self-center text-[12px] text-fg-faint underline-offset-2 hover:text-fg hover:underline"
                >
                  Pedidos de mais de 60 dias: Histórico de pedidos
                </Link>
              </div>
            )}

            <div className="p-5">
              {agora === 0 ? null : tipo === "vendas" ? (
                <Vendas banco={banco} periodo={periodo} />
              ) : tipo === "produtos" ? (
                <Produtos banco={banco} periodo={periodo} />
              ) : tipo === "atendimento" ? (
                <Atendimento banco={banco} periodo={periodo} />
              ) : tipo === "clientes" ? (
                <Clientes banco={banco} periodo={periodo} />
              ) : tipo === "estoque" ? (
                <Estoque banco={banco} />
              ) : (
                <Completo banco={banco} />
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------
   Peças da prévia
   ------------------------------------------------------------------ */

function Numeros({ itens }: { itens: { rotulo: string; valor: string; dica: string }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
      {itens.map((n) => (
        <div key={n.rotulo} className="min-w-0">
          <dt className="text-[12px] text-fg-faint">{n.rotulo}</dt>
          <dd className="tnum mt-1 truncate text-[22px] font-semibold tracking-[-0.03em] text-fg">{n.valor}</dd>
          <dd className="mt-0.5 text-[11.5px] leading-snug text-fg-ghost">{n.dica}</dd>
        </div>
      ))}
    </dl>
  );
}

function Titulo({ children, extra }: { children: React.ReactNode; extra?: string }) {
  return (
    <h3 className="mb-2 mt-8 flex items-baseline gap-2 text-[13px] font-medium text-fg-muted">
      {children}
      {extra && <span className="text-[12px] font-normal text-fg-ghost">{extra}</span>}
    </h3>
  );
}

function Tabela({
  colunas,
  linhas,
  vazio,
}: {
  colunas: { titulo: string; direita?: boolean }[];
  linhas: React.ReactNode[][];
  vazio: string;
}) {
  if (linhas.length === 0) {
    return <p className="rounded-xl bg-nivel-2 px-4 py-5 text-center text-[12.5px] text-fg-faint">{vazio}</p>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-hairline">
      <table className="w-full min-w-[560px] border-collapse text-left text-[13px]">
        <thead>
          <tr className="border-b border-hairline text-[12px] text-fg-faint">
            {colunas.map((c) => (
              <th key={c.titulo} className={cn("px-4 py-2.5 font-medium", c.direita && "text-right")}>
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha, i) => (
            <tr key={i} className="border-b border-hairline last:border-0">
              {linha.map((celula, j) => (
                <td key={j} className={cn("px-4 py-2.5 text-fg", colunas[j]?.direita && "tnum text-right")}>
                  {celula}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------
   Cada relatório
   ------------------------------------------------------------------ */

function Vendas({ banco, periodo }: { banco: VisaoLoja; periodo: PeriodoRelatorio }) {
  const r = useMemo(() => relatorioVendas(banco, periodo), [banco, periodo]);
  return (
    <>
      <Numeros
        itens={[
          { rotulo: "Vendido", valor: formatBRLCents(r.vendido), dica: `${r.validos} pedidos, sem os cancelados` },
          { rotulo: "Recebido", valor: formatBRLCents(r.recebido), dica: `${formatBRLCents(r.aReceber)} ainda a receber` },
          { rotulo: "Ticket médio", valor: r.validos ? formatBRLCents(r.ticket) : "—", dica: "vendido ÷ pedidos" },
          { rotulo: "Cancelados", valor: formatNumber(r.cancelados), dica: `${formatBRLCents(r.valorCancelado)} fora do vendido` },
        ]}
      />
      <p className="mt-4 text-[12.5px] text-fg-faint">
        Pelo WhatsApp: <span className="text-fg">{formatBRLCents(r.whatsapp)}</span> · No balcão:{" "}
        <span className="text-fg">{formatBRLCents(r.balcao)}</span> · Com entrega: {r.entregas} pedidos
      </p>

      {r.porDia.length > 1 && (
        <>
          <Titulo>Vendido por dia</Titulo>
          <GraficoFaturamento pontos={r.porDia} titulo="Vendido por dia" />
        </>
      )}

      <Titulo extra={`${r.pedidos.length} no período`}>Pedidos</Titulo>
      <Tabela
        vazio="Nenhum pedido neste período."
        colunas={[{ titulo: "Nº" }, { titulo: "Quando" }, { titulo: "Cliente" }, { titulo: "Situação" }, { titulo: "Total", direita: true }]}
        linhas={r.pedidos.slice(0, 50).map((p) => [
          `#${p.numero}`,
          <span key="q" className="text-fg-muted">
            {dataCurta(p.criadoEm)}
          </span>,
          p.cliente,
          <ChipStatus key="s" status={p.status} />,
          formatBRLCents(p.total),
        ])}
      />
      {r.pedidos.length > 50 && (
        <p className="mt-2 text-[12px] text-fg-faint">Mostrando 50 de {r.pedidos.length}. A planilha leva todos.</p>
      )}
    </>
  );
}

function Produtos({ banco, periodo }: { banco: VisaoLoja; periodo: PeriodoRelatorio }) {
  const r = useMemo(() => relatorioProdutos(banco, periodo), [banco, periodo]);
  const maior = r.ranking[0]?.quantidade ?? 0;
  return (
    <>
      <Numeros
        itens={[
          { rotulo: "Unidades vendidas", valor: formatNumber(r.unidades), dica: "somando todos os itens" },
          { rotulo: "Vendido em produtos", valor: formatBRLCents(r.faturamento), dica: "sem a taxa de entrega" },
          { rotulo: "Produtos diferentes", valor: formatNumber(r.ranking.length), dica: "que venderam ao menos 1" },
          { rotulo: "Sem nenhuma venda", valor: formatNumber(r.parados.length), dica: "estão no catálogo e não saíram" },
        ]}
      />
      <Titulo>Ranking</Titulo>
      {r.ranking.length === 0 ? (
        <p className="rounded-xl bg-nivel-2 px-4 py-5 text-center text-[12.5px] text-fg-faint">Nenhuma venda neste período.</p>
      ) : (
        <ol className="space-y-2.5">
          {r.ranking.slice(0, 15).map((x, i) => (
            <li key={x.nome} className="grid grid-cols-[24px_1fr_auto] items-center gap-3 text-[13px]">
              <span className="tnum text-right text-fg-ghost">{i + 1}</span>
              <div className="min-w-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-fg">{x.nome}</span>
                  <span className="tnum shrink-0 text-fg-muted">{x.quantidade} un.</span>
                </div>
                {/* Barra fina em tom neutro: compara sem gritar. */}
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-nivel-3">
                  <div className="h-full rounded-full bg-fg-faint" style={{ width: `${(x.quantidade / maior) * 100}%` }} />
                </div>
              </div>
              <span className="tnum w-[92px] text-right text-fg">{formatBRLCents(x.faturamento)}</span>
            </li>
          ))}
        </ol>
      )}
      {r.parados.length > 0 && (
        <>
          <Titulo extra="podem estar com preço alto ou fora de época">Sem venda no período</Titulo>
          <p className="text-[12.5px] leading-relaxed text-fg-muted">{r.parados.map((p) => p.nome).join(", ")}</p>
        </>
      )}
    </>
  );
}

function Atendimento({ banco, periodo }: { banco: VisaoLoja; periodo: PeriodoRelatorio }) {
  const r = useMemo(() => relatorioAtendimento(banco, periodo), [banco, periodo]);
  return (
    <>
      <Numeros
        itens={[
          { rotulo: "Conversas", valor: formatNumber(r.total), dica: `${formatNumber(r.mensagens)} mensagens` },
          {
            rotulo: "Viraram pedido",
            valor: formatNumber(r.viraramPedido),
            dica: r.total ? `${Math.round(r.conversao * 100)}% das conversas` : "—",
          },
          { rotulo: "Só com o agente", valor: formatNumber(r.soAgente), dica: "ninguém precisou assumir" },
          { rotulo: "Chamaram a equipe", valor: formatNumber(r.chamados), dica: "farmacêutico, atendente ou reclamação" },
        ]}
      />
      <Titulo extra={`${r.conversas.length} no período`}>Conversas</Titulo>
      <Tabela
        vazio="Nenhuma conversa neste período."
        colunas={[{ titulo: "Cliente" }, { titulo: "Última mensagem" }, { titulo: "Situação" }, { titulo: "Mensagens", direita: true }]}
        linhas={r.conversas.slice(0, 50).map((c) => [
          c.cliente,
          <span key="q" className="text-fg-muted">
            {dataCurta(c.atualizadaEm)}
          </span>,
          <span key="s" className="text-fg-muted">
            {c.status === "resolvida" ? "Resolvida" : c.status === "com_atendente" ? "Com a equipe" : "Com o agente"}
          </span>,
          c.mensagens.length,
        ])}
      />
    </>
  );
}

function Clientes({ banco, periodo }: { banco: VisaoLoja; periodo: PeriodoRelatorio }) {
  const r = useMemo(() => relatorioClientes(banco, periodo), [banco, periodo]);
  return (
    <>
      <Numeros
        itens={[
          { rotulo: "Clientes novos", valor: formatNumber(r.novos.length), dica: "cadastrados no período" },
          { rotulo: "Voltaram a comprar", valor: formatNumber(r.voltaram.length), dica: "já eram clientes" },
          { rotulo: "Autorizaram campanha", valor: formatNumber(r.autorizaram), dica: `de ${r.total} clientes` },
          { rotulo: "Aniversariantes", valor: formatNumber(r.aniversariantes.length), dica: "neste mês" },
        ]}
      />
      <Titulo extra={`${r.novos.length} no período`}>Clientes novos</Titulo>
      <Tabela
        vazio="Ninguém novo neste período."
        colunas={[{ titulo: "Nome" }, { titulo: "Telefone" }, { titulo: "Cadastro" }, { titulo: "Campanha" }]}
        linhas={r.novos.slice(0, 50).map((c) => [
          c.nome,
          <span key="t" className="tnum text-fg-muted">
            {c.telefone}
          </span>,
          <span key="d" className="text-fg-muted">
            {dataCurta(c.criadoEm)}
          </span>,
          <span key="c" className="text-fg-muted">
            {c.consentimento ? "Autorizou" : "Não"}
          </span>,
        ])}
      />
    </>
  );
}

function Estoque({ banco }: { banco: VisaoLoja }) {
  const r = useMemo(() => relatorioEstoque(banco), [banco]);
  return (
    <>
      <Numeros
        itens={[
          { rotulo: "Para repor", valor: formatNumber(r.repor.length), dica: "abaixo do mínimo" },
          { rotulo: "Sem estoque", valor: formatNumber(r.zerados.length), dica: "o agente avisa que está em falta" },
          { rotulo: "Unidades na loja", valor: formatNumber(r.unidades), dica: `${banco.produtos.length} produtos` },
          { rotulo: "Valor na prateleira", valor: formatBRLCents(r.valorDeVenda), dica: "pelo preço de venda" },
        ]}
      />
      <Titulo extra="os mais críticos primeiro">Produtos</Titulo>
      <Tabela
        vazio="Nenhum produto cadastrado."
        colunas={[{ titulo: "Produto" }, { titulo: "Estoque", direita: true }, { titulo: "Mínimo", direita: true }, { titulo: "Situação" }]}
        linhas={r.itens.slice(0, 50).map((p) => [
          p.nome,
          p.estoque,
          p.estoqueMinimo,
          <span
            key="s"
            className={cn(
              "estado",
              p.estoque <= 0
                ? "[--ponto:var(--color-negative)]"
                : p.estoque < p.estoqueMinimo
                  ? "[--ponto:var(--color-caution)]"
                  : "[--ponto:var(--color-positive)]",
            )}
          >
            {p.estoque <= 0 ? "Sem estoque" : p.estoque < p.estoqueMinimo ? "Repor" : "Ok"}
          </span>,
        ])}
      />
    </>
  );
}

function Completo({ banco }: { banco: VisaoLoja }) {
  const abas: [string, string][] = [
    ["Resumo", "Os números gerais da loja"],
    ["Clientes", `${banco.clientes.length} cadastros, com telefone, endereço e campanha`],
    ["Produtos", `${banco.produtos.length} itens do catálogo, com estoque e preço`],
    ["Conversas", `${banco.conversas.length} conversas carregadas`],
    ["Pedidos", `${banco.pedidos.length} pedidos carregados (os últimos 60 dias e os em aberto)`],
    ["Campanhas", `${banco.campanhas.length} campanhas`],
  ];
  return (
    <>
      <p className="max-w-[640px] text-[13px] leading-relaxed text-fg-muted">
        Uma cópia de tudo o que a loja tem cadastrado, para guardar ou abrir no Excel. Não tem filtro de data: para
        números de um período, use os relatórios acima.
      </p>
      <Titulo>O que vem na planilha</Titulo>
      <ul className="divide-y divide-hairline rounded-xl border border-hairline">
        {abas.map(([nome, desc]) => (
          <li key={nome} className="flex items-baseline justify-between gap-4 px-4 py-2.5 text-[13px]">
            <span className="text-fg">{nome}</span>
            <span className="text-right text-fg-faint">{desc}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
