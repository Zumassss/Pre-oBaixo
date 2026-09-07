import { ShieldCheck, UserPlus } from "lucide-react";
import { Panel, PageHeader, PanelHeader } from "@/components/ui/panel";
import { Table, Td, Thead, Tr } from "@/components/ui/table";
import { MeterRow } from "@/components/charts";
import { customers } from "@/lib/mock/crm";
import { cn, formatBRL } from "@/lib/utils";

export const metadata = { title: "Clientes · Preço Baixo" };

const segmentClass: Record<string, string> = {
  "Alta recorrência": "chip-hot",
  Recorrente: "chip-good",
  Novo: "chip",
  Inativo: "chip-warn",
};

export default function ClientesPage() {
  const total = customers.length;
  const comConsentimento = customers.filter((c) => c.consent).length;
  const ltvMedio =
    customers.reduce((sum, c) => sum + c.ltv, 0) / customers.length;

  return (
    <div className="mx-auto max-w-[1560px]">
      <PageHeader
        title="Clientes"
        description="A base que o agente consulta antes de cada resposta — histórico, segmento e consentimento, em um só lugar."
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
          { label: "Com opt-in WhatsApp", value: "9.412", hint: "73% da base" },
          { label: "LTV médio", value: formatBRL(ltvMedio), hint: "por cliente" },
          { label: "Recompra em 30 dias", value: "41%", hint: "meta: 35%" },
        ].map((stat, i) => (
          <div
            key={stat.label}
            className="tile tile-interactive p-4"
            style={{
              animation: `rise 0.6s cubic-bezier(0.16,1,0.3,1) ${i * 70}ms both`,
            }}
          >
            <p className="text-[12px] text-fg-muted">{stat.label}</p>
            <p className="tnum mt-2 text-[24px] font-semibold leading-none tracking-[-0.03em] text-fg">
              {stat.value}
            </p>
            <p className="mt-1.5 text-[11px] text-fg-ghost">{stat.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Panel className="xl:col-span-8">
          <PanelHeader
            eyebrow="Base"
            title="Clientes recentes"
            action={<span className="chip">{total} exibidos</span>}
          />
          <Table>
            <Thead
              columns={[
                "Cliente",
                "Segmento",
                "Unidade",
                "Pedidos",
                "Última compra",
                "LTV",
              ]}
            />
            <tbody>
              {customers.map((customer, i) => (
                <Tr key={customer.id} index={i}>
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
                    <span
                      className={cn("chip", segmentClass[customer.segment])}
                    >
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
        </Panel>

        <div className="flex flex-col gap-4 xl:col-span-4">
          <Panel>
            <PanelHeader eyebrow="Distribuição" title="Segmentos da base" />
            <div className="space-y-3.5 px-5 pb-5">
              <MeterRow label="Alta recorrência" value={28} tone="brand" />
              <MeterRow label="Recorrente" value={34} tone="good" />
              <MeterRow label="Novo" value={22} tone="info" />
              <MeterRow label="Inativo" value={16} tone="muted" />
            </div>
          </Panel>

          <Panel className="flex-1">
            <PanelHeader eyebrow="Conformidade" title="Consentimento e dados" />
            <div className="px-5 pb-5">
              <div className="tile flex items-start gap-3 p-3.5">
                <ShieldCheck
                  className="mt-0.5 h-4 w-4 shrink-0 text-positive"
                  strokeWidth={2}
                />
                <div>
                  <p className="text-[12.5px] font-medium text-fg">
                    {comConsentimento} de {total} com opt-in registrado
                  </p>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-fg-faint">
                    Campanhas só alcançam quem autorizou. Histórico de compra de
                    medicamento é dado sensível e nunca aparece em mensagem
                    automática.
                  </p>
                </div>
              </div>
              <button className="btn-ghost mt-3 w-full">
                Exportar registro de consentimento
              </button>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
