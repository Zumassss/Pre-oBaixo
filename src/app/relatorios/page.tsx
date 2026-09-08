"use client";

import { useMemo } from "react";
import { ChartNoAxesCombined, MessagesSquare, Package, Users } from "lucide-react";
import Link from "next/link";
import { PageHeader, Panel, PanelHeader } from "@/components/ui/panel";
import { Table, Td, Thead, Tr } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Reveal } from "@/components/ui/reveal";
import { ExportButton } from "@/components/relatorios/export-button";
import { useAppState, periodoLabel } from "@/components/providers/app-state";
import { useBanco } from "@/lib/db/use-db";
import { formatBRLCents, formatNumber } from "@/lib/utils";

export default function RelatoriosPage() {
  const { banco, carregado } = useBanco();
  const { desde, periodo } = useAppState();

  const conversas = useMemo(
    () => banco.conversas.filter((c) => c.atualizadaEm >= desde),
    [banco.conversas, desde],
  );
  const eventos = useMemo(
    () => banco.eventos.filter((e) => e.em >= desde),
    [banco.eventos, desde],
  );
  const clientesNovos = useMemo(
    () => banco.clientes.filter((c) => c.criadoEm >= desde),
    [banco.clientes, desde],
  );

  const temAlgo =
    banco.clientes.length > 0 ||
    banco.produtos.length > 0 ||
    banco.conversas.length > 0;

  const criticos = banco.produtos.filter((p) => p.estoque < p.estoqueMinimo);

  const indicadores = [
    {
      label: "Conversas no período",
      valor: formatNumber(conversas.length),
      hint: periodoLabel[periodo].toLowerCase(),
      icon: MessagesSquare,
    },
    {
      label: "Clientes novos",
      valor: formatNumber(clientesNovos.length),
      hint: `${banco.clientes.length} no total`,
      icon: Users,
    },
    {
      label: "Produtos cadastrados",
      valor: formatNumber(banco.produtos.length),
      hint: `${criticos.length} abaixo do mínimo`,
      icon: Package,
    },
    {
      label: "Interações com o agente",
      valor: formatNumber(eventos.length),
      hint: periodoLabel[periodo].toLowerCase(),
      icon: ChartNoAxesCombined,
    },
  ];

  return (
    <div className="mx-auto max-w-[1560px]">
      <PageHeader
        title="Relatórios"
        description="O que aconteceu nesta loja no período escolhido."
        action={<ExportButton />}
      />

      {!temAlgo && carregado ? (
        <Panel>
          <EmptyState
            icon={ChartNoAxesCombined}
            title="Ainda não há o que relatar"
            description="Os relatórios se montam sozinhos conforme você cadastra clientes e produtos e as conversas acontecem. A planilha pode ser baixada mesmo assim, já com a estrutura pronta."
            action={
              <Link href="/configuracoes" className="btn-primary">
                Configurar a loja
              </Link>
            }
          />
        </Panel>
      ) : (
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
            <Panel className="xl:col-span-7">
              <PanelHeader eyebrow="Atendimento" title="Conversas do período" />
              {conversas.length === 0 ? (
                <EmptyState
                  icon={MessagesSquare}
                  title="Nenhuma conversa no período"
                  description="Troque o período na barra de cima ou registre um atendimento."
                />
              ) : (
                <Table>
                  <Thead
                    columns={["Cliente", "Telefone", "Status", "Mensagens"]}
                  />
                  <tbody>
                    {conversas.map((conversa, i) => (
                      <Tr key={conversa.id} index={i}>
                        <Td className="font-medium text-fg">{conversa.cliente}</Td>
                        <Td className="tnum font-mono">{conversa.telefone}</Td>
                        <Td className="text-fg-faint">
                          {conversa.status === "com_atendente"
                            ? "com atendente"
                            : conversa.status}
                        </Td>
                        <Td align="right" className="tnum font-mono">
                          {conversa.mensagens.length}
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Panel>

            <Panel className="xl:col-span-5">
              <PanelHeader eyebrow="Estoque" title="Abaixo do mínimo" />
              {criticos.length === 0 ? (
                <EmptyState
                  icon={Package}
                  title="Nenhum produto em falta"
                  description="Todo item cadastrado está acima do estoque mínimo."
                />
              ) : (
                <Table>
                  <Thead columns={["Produto", "Estoque", "Preço"]} />
                  <tbody>
                    {criticos.map((produto, i) => (
                      <Tr key={produto.id} index={i}>
                        <Td className="font-medium text-fg">{produto.nome}</Td>
                        <Td className="tnum font-mono text-caution">
                          {produto.estoque} de {produto.estoqueMinimo}
                        </Td>
                        <Td align="right" className="tnum font-mono">
                          {formatBRLCents(produto.preco)}
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}
