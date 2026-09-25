"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  ClipboardList,
  MessagesSquare,
  Plus,
  Settings2,
  ShieldAlert,
  Store,
  Wallet,
} from "lucide-react";
import { PageHeader, Panel, PanelHeader } from "@/components/ui/panel";
import { Table, Td, Thead, Tr } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Reveal } from "@/components/ui/reveal";
import { Modal } from "@/components/ui/modal";
import { PerfilDaLoja } from "@/components/rede/perfil-da-loja";
import { ExportButton } from "@/components/relatorios/export-button";
import { useAppState, periodoLabel } from "@/components/providers/app-state";
import { selecionarLoja, useSessao } from "@/lib/db/use-db";
import { LOJA_VAZIA, visaoDaLoja, type Loja } from "@/lib/db/types";
import { alertasDaRede, resumoDaRede, totaisDaRede } from "@/lib/rede";
import { cn, formatBRLCents, formatNumber } from "@/lib/utils";

export default function RedePage() {
  const { rede, usuario, carregado } = useSessao();
  const { desde, periodo } = useAppState();
  const router = useRouter();
  const [emEdicao, setEmEdicao] = useState<Loja | null>(null);
  const [criando, setCriando] = useState(false);

  const resumos = useMemo(() => resumoDaRede(rede, desde), [rede, desde]);
  const totais = useMemo(() => totaisDaRede(resumos), [resumos]);
  const alertas = useMemo(() => alertasDaRede(resumos), [resumos]);

  // A tela existe mas o menu não a oferece a quem opera loja. Se alguém
  // chegar por link direto, o aviso é melhor que uma tela vazia sem motivo.
  if (carregado && usuario?.papel !== "admin") {
    return (
      <div className="mx-auto max-w-[1560px]">
        <Panel>
          <EmptyState
            icon={ShieldAlert}
            title="Esta tela é do administrador"
            description="Quem opera uma loja enxerga apenas a própria unidade. Entre com o acesso de administrador para ver a rede."
          />
        </Panel>
      </div>
    );
  }

  // O maior faturamento vira a régua das barras do comparativo.
  const maior = Math.max(...resumos.map((r) => r.faturamento), 1);

  const indicadores = [
    {
      label: "Faturamento da rede",
      valor: formatBRLCents(totais.faturamento),
      hint: totais.ticketMedio
        ? `ticket médio ${formatBRLCents(totais.ticketMedio)}`
        : "só pedidos entregues e pagos",
      icon: Wallet,
    },
    {
      label: "Pedidos no período",
      valor: formatNumber(totais.pedidos),
      hint: `${totais.pedidosAbertos} em aberto agora`,
      icon: ClipboardList,
    },
    {
      label: "Conversas em aberto",
      valor: formatNumber(totais.conversasAbertas),
      hint: `${formatNumber(totais.clientes)} clientes na rede`,
      icon: MessagesSquare,
    },
    {
      label: "Lojas",
      valor: `${totais.lojasAtivas} de ${rede.lojas.length}`,
      hint: `${totais.lojasConfiguradas} com cadastro completo`,
      icon: Store,
    },
  ];

  function abrirLoja(lojaId: string) {
    selecionarLoja(lojaId);
    router.push("/");
  }

  function novaLoja() {
    setCriando(true);
    setEmEdicao({ ...LOJA_VAZIA });
  }

  function fecharPerfil() {
    setEmEdicao(null);
    setCriando(false);
  }

  return (
    <div className="mx-auto max-w-[1560px]">
      <PageHeader
        title="Visão da rede"
        description={`Resultado consolidado de todas as unidades. Período: ${periodoLabel[periodo].toLowerCase()}.`}
        action={
          <button onClick={novaLoja} className="btn-primary">
            <Plus className="h-4 w-4" strokeWidth={2} />
            Nova loja
          </button>
        }
      />

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {indicadores.map((item, i) => {
            const Icon = item.icon;
            return (
              <Reveal
                key={item.label}
                className="tile p-4"
                style={{
                  animation: `rise 0.5s cubic-bezier(0.16,1,0.3,1) ${i * 60}ms both`,
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11.5px] font-medium text-fg-muted">
                    {item.label}
                  </p>
                  <Icon className="h-3.5 w-3.5 text-fg-ghost" strokeWidth={2} />
                </div>
                <p className="tnum mt-2 text-[24px] font-semibold leading-none tracking-[-0.03em] text-fg">
                  {carregado ? item.valor : "0"}
                </p>
                <p className="mt-1.5 truncate text-[11px] text-fg-ghost">
                  {item.hint}
                </p>
              </Reveal>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          {/* Comparativo */}
          <Panel className="xl:col-span-8">
            <PanelHeader
              eyebrow="Comparativo"
              title="Como cada loja foi no período"
              action={
                <span className="chip">
                  {rede.lojas.length}{" "}
                  {rede.lojas.length === 1 ? "loja" : "lojas"}
                </span>
              }
            />
            <Table>
              <Thead
                columns={[
                  "Loja",
                  "Faturamento",
                  "Pedidos",
                  "Em aberto",
                  "Estoque",
                  "Ação",
                ]}
              />
              <tbody>
                {resumos.map((r, i) => (
                  <Tr key={r.loja.id} index={i}>
                    <Td>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-medium text-fg">
                            {r.loja.nome}
                          </p>
                          {!r.loja.ativa && (
                            <span className="chip !px-1.5 !py-0 !text-[9px]">
                              pausada
                            </span>
                          )}
                          {!r.loja.configurada && (
                            <span className="chip chip-warn !px-1.5 !py-0 !text-[9px]">
                              incompleta
                            </span>
                          )}
                        </div>
                        {/* A barra mostra o tamanho relativo da loja sem
                            precisar de eixo: a maior ocupa a linha toda. */}
                        <div className="mt-1.5 h-1 w-full max-w-[220px] overflow-hidden rounded-full bg-nivel-3">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-brand-700 to-brand-400 transition-[width] duration-500"
                            style={{
                              width: `${Math.round((r.faturamento / maior) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    </Td>
                    <Td className="tnum font-mono font-medium text-fg">
                      {formatBRLCents(r.faturamento)}
                    </Td>
                    <Td className="tnum font-mono text-fg-faint">{r.pedidos}</Td>
                    <Td className="tnum font-mono text-fg-faint">
                      {r.pedidosAbertos}
                    </Td>
                    <Td
                      className={cn(
                        "tnum font-mono",
                        r.estoqueCritico > 0 ? "text-caution" : "text-fg-faint",
                      )}
                    >
                      {r.estoqueCritico > 0 ? `${r.estoqueCritico} baixo` : "ok"}
                    </Td>
                    <Td align="right">
                      <div className="flex justify-end gap-1">
                        <ExportButton
                          somenteIcone
                          visao={visaoDaLoja(rede, r.loja.id)}
                          titulo={`Baixar Excel de ${r.loja.nome}`}
                        />
                        <button
                          onClick={() => setEmEdicao(r.loja)}
                          aria-label={`Configurar ${r.loja.nome}`}
                          title="Configurar a loja"
                          className="rounded-lg p-1.5 text-fg-ghost transition-colors hover:bg-nivel-3 hover:text-fg"
                        >
                          <Settings2 className="h-3.5 w-3.5" strokeWidth={2} />
                        </button>
                        <button
                          onClick={() => abrirLoja(r.loja.id)}
                          className="btn-ghost !px-3 !py-1 !text-[11.5px]"
                        >
                          Operar
                        </button>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </Panel>

          {/* Alertas */}
          <Panel className="xl:col-span-4">
            <PanelHeader
              eyebrow="Atenção"
              title="O que precisa de você"
              action={
                alertas.length > 0 ? (
                  <span className="chip chip-warn">{alertas.length}</span>
                ) : undefined
              }
            />
            {alertas.length === 0 ? (
              <EmptyState
                icon={Building2}
                title="Nada parado na rede"
                description="Nenhuma loja está com pedido travado, conversa sem resposta ou item abaixo do mínimo."
              />
            ) : (
              <ul
                data-lenis-prevent
                className="max-h-[420px] overflow-y-auto px-2 pb-2"
              >
                {alertas.map((alerta) => (
                  <Reveal
                    as="li"
                    key={alerta.id}
                    className="flex items-start gap-3 rounded-xl p-3"
                  >
                    <span
                      className={cn(
                        "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                        alerta.gravidade === "alta"
                          ? "bg-caution"
                          : "bg-fg-ghost",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] font-medium text-fg">
                        {alerta.titulo}
                      </p>
                      <p className="mt-0.5 text-[11.5px] leading-relaxed text-fg-faint">
                        {alerta.detalhe}
                      </p>
                      <button
                        onClick={() => abrirLoja(alerta.loja.id)}
                        className="mt-1 text-[11px] font-medium text-brand-400 transition-colors hover:text-brand-300"
                      >
                        Abrir {alerta.loja.nome}
                      </button>
                    </div>
                  </Reveal>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      <Modal
        aberto={Boolean(emEdicao)}
        titulo={
          criando ? "Nova loja na rede" : `Perfil de ${emEdicao?.nome ?? ""}`
        }
        descricao={
          criando
            ? "A loja passa a existir quando você enviar o formulário. Ela nasce vazia e separada das outras."
            : "O que esta unidade tem de diferente das outras. O agente responde a partir daqui."
        }
        onFechar={fecharPerfil}
        larguraMaxima="max-w-2xl"
      >
        {emEdicao && (
          <PerfilDaLoja
            key={criando ? "nova" : emEdicao.id}
            loja={emEdicao}
            criando={criando}
            temDados={
              !criando &&
              (visaoDaLoja(rede, emEdicao.id).pedidos.length > 0 ||
                visaoDaLoja(rede, emEdicao.id).clientes.length > 0)
            }
            onPronto={fecharPerfil}
          />
        )}
      </Modal>
    </div>
  );
}
