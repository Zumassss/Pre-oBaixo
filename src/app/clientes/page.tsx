"use client";

import { useMemo, useState } from "react";
import { Search, ShieldCheck, UserPlus } from "lucide-react";
import { Panel, PageHeader, PanelHeader } from "@/components/ui/panel";
import { Table, Td, Thead, Tr } from "@/components/ui/table";
import { MeterRow } from "@/components/charts";
import { Reveal } from "@/components/ui/reveal";
import { Dropdown } from "@/components/ui/dropdown";
import { useAppState } from "@/components/providers/app-state";
import { customers } from "@/lib/mock/crm";
import { cn, formatBRL } from "@/lib/utils";

const segmentClass: Record<string, string> = {
  "Alta recorrência": "chip-hot",
  Recorrente: "chip-good",
  Novo: "chip",
  Inativo: "chip-warn",
};

const SEGMENTOS = [
  { value: "todos", label: "Todos os segmentos" },
  { value: "Alta recorrência", label: "Alta recorrência" },
  { value: "Recorrente", label: "Recorrente" },
  { value: "Novo", label: "Novo" },
  { value: "Inativo", label: "Inativo" },
];

export default function ClientesPage() {
  const { busca, unidade, unidadeAtual } = useAppState();
  const [buscaLocal, setBuscaLocal] = useState("");
  const [segmento, setSegmento] = useState("todos");
  const [selecionado, setSelecionado] = useState<string | null>(null);

  const termo = (buscaLocal || busca).toLowerCase().trim();

  const visiveis = useMemo(
    () =>
      customers.filter((c) => {
        const passaBusca =
          !termo ||
          c.name.toLowerCase().includes(termo) ||
          c.phone.includes(termo) ||
          c.store.toLowerCase().includes(termo);
        const passaSegmento = segmento === "todos" || c.segment === segmento;
        const passaUnidade = unidade === "todas" || c.store === unidadeAtual?.name;
        return passaBusca && passaSegmento && passaUnidade;
      }),
    [termo, segmento, unidade, unidadeAtual],
  );

  const comConsentimento = visiveis.filter((c) => c.consent).length;
  const ltvMedio = visiveis.length
    ? visiveis.reduce((s, c) => s + c.ltv, 0) / visiveis.length
    : 0;

  return (
    <div className="mx-auto max-w-[1560px]">
      <PageHeader
        title="Clientes"
        description="A base que o agente consulta antes de responder."
        action={
          <button className="btn-primary">
            <UserPlus className="h-4 w-4" strokeWidth={2} />
            Novo cliente
          </button>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Clientes na base", value: "12.847", hint: "+318 este mês" },
          { label: "Com opt-in", value: "9.412", hint: "73% da base" },
          { label: "LTV médio", value: formatBRL(ltvMedio), hint: "por cliente" },
          { label: "Recompra em 30 dias", value: "41%", hint: "meta de 35%" },
        ].map((stat, i) => (
          <Reveal
            key={stat.label}
            className="tile p-4"
            style={{ animation: `rise 0.5s cubic-bezier(0.16,1,0.3,1) ${i * 60}ms both` }}
          >
            <p className="text-[12px] text-fg-muted">{stat.label}</p>
            <p className="tnum mt-2 text-[23px] font-semibold leading-none tracking-[-0.03em] text-fg">
              {stat.value}
            </p>
            <p className="mt-1.5 text-[11px] text-fg-ghost">{stat.hint}</p>
          </Reveal>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Panel className="xl:col-span-8">
          <PanelHeader
            eyebrow="Base"
            title="Clientes"
            action={
              <div className="flex items-center gap-2">
                <div className="relative hidden sm:block">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-[14px] w-[14px] -translate-y-1/2 text-fg-ghost"
                    strokeWidth={2}
                  />
                  <input
                    value={buscaLocal}
                    onChange={(e) => setBuscaLocal(e.target.value)}
                    className="field !w-[160px] !py-1.5 !pl-8.5 !text-[12px]"
                    placeholder="Buscar"
                  />
                </div>
                <Dropdown
                  value={segmento}
                  options={SEGMENTOS}
                  onChange={setSegmento}
                  align="right"
                />
              </div>
            }
          />
          <Table>
            <Thead
              columns={["Cliente", "Segmento", "Unidade", "Pedidos", "Última compra", "LTV"]}
            />
            <tbody>
              {visiveis.map((customer, i) => (
                <Tr
                  key={customer.id}
                  index={i}
                  selected={selecionado === customer.id}
                  onClick={() =>
                    setSelecionado((atual) =>
                      atual === customer.id ? null : customer.id,
                    )
                  }
                >
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-surface-3 to-surface text-[10px] font-semibold text-fg-muted ring-1 ring-inset ring-white/10">
                        {customer.name
                          .split(" ")
                          .slice(0, 2)
                          .map((n) => n[0])
                          .join("")}
                      </div>
                      <div>
                        <p className="font-medium text-fg">{customer.name}</p>
                        <p className="tnum font-mono text-[10.5px] text-fg-ghost">
                          {customer.phone}
                        </p>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <span className={cn("chip", segmentClass[customer.segment])}>
                      {customer.segment}
                    </span>
                  </Td>
                  <Td className="text-fg-faint">{customer.store}</Td>
                  <Td className="tnum font-mono">{customer.orders}</Td>
                  <Td className="text-fg-faint">{customer.lastPurchase}</Td>
                  <Td align="right" className="tnum font-mono font-medium text-fg">
                    {formatBRL(customer.ltv)}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          {visiveis.length === 0 && (
            <p className="px-5 py-10 text-center text-[12.5px] text-fg-ghost">
              Nenhum cliente com esse filtro.
            </p>
          )}
        </Panel>

        <div className="flex flex-col gap-4 xl:col-span-4">
          <Panel>
            <PanelHeader eyebrow="Distribuição" title="Segmentos" />
            <div className="space-y-3.5 px-5 pb-5">
              <MeterRow label="Alta recorrência" value={28} tone="brand" />
              <MeterRow label="Recorrente" value={34} tone="good" />
              <MeterRow label="Novo" value={22} tone="info" />
              <MeterRow label="Inativo" value={16} tone="muted" />
            </div>
          </Panel>

          <Panel className="flex-1">
            <PanelHeader eyebrow="Conformidade" title="Consentimento" />
            <div className="px-5 pb-5">
              <Reveal className="tile flex items-start gap-3 p-3.5">
                <ShieldCheck
                  className="mt-0.5 h-4 w-4 shrink-0 text-positive"
                  strokeWidth={2}
                />
                <div>
                  <p className="text-[12.5px] font-medium text-fg">
                    {comConsentimento} de {visiveis.length} com opt-in
                  </p>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-fg-faint">
                    Campanha só alcança quem autorizou. Compra de medicamento é
                    dado sensível e não entra em disparo automático.
                  </p>
                </div>
              </Reveal>
              <button className="btn-ghost mt-3 w-full">Exportar consentimentos</button>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
