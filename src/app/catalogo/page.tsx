import { AlertTriangle, Plus, Search } from "lucide-react";
import { PageHeader, Panel, PanelHeader } from "@/components/ui/panel";
import { Table, Td, Thead, Tr } from "@/components/ui/table";
import { products } from "@/lib/mock/catalog";
import { cn, formatBRLCents, formatNumber } from "@/lib/utils";

export const metadata = { title: "Catálogo · Preço Baixo" };

export default function CatalogoPage() {
  const critical = products.filter((p) => p.stock < p.minStock);
  const totalConsultas = products.reduce((sum, p) => sum + p.askedTimes, 0);

  return (
    <div className="mx-auto max-w-[1560px]">
      <PageHeader
        title="Catálogo"
        description="O que o agente consulta para responder preço e disponibilidade. Estoque abaixo do mínimo vira alerta na Central."
        action={
          <button className="btn-primary">
            <Plus className="h-4 w-4" strokeWidth={2.4} />
            Adicionar produto
          </button>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Itens no catálogo", value: "4.820", hint: "sincronizado há 6 min" },
          {
            label: "Consultas do agente",
            value: formatNumber(totalConsultas),
            hint: "últimos 7 dias",
          },
          {
            label: "Abaixo do mínimo",
            value: String(critical.length),
            hint: "exigem reposição",
          },
          { label: "Cobertura de resposta", value: "97,4%", hint: "itens com preço válido" },
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
            eyebrow="Produtos"
            title="Mais consultados pelo agente"
            action={
              <div className="relative hidden sm:block">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-[14px] w-[14px] -translate-y-1/2 text-fg-ghost"
                  strokeWidth={2}
                />
                <input
                  className="field !w-[180px] !py-1.5 !pl-8.5 !text-[12px]"
                  placeholder="Buscar produto…"
                />
              </div>
            }
          />
          <Table>
            <Thead
              columns={["Produto", "Categoria", "Consultas", "Estoque", "Preço"]}
            />
            <tbody>
              {products.map((product, i) => {
                const low = product.stock < product.minStock;
                return (
                  <Tr key={product.id} index={i}>
                    <Td>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-fg">{product.name}</p>
                        {product.prescription && (
                          <span className="chip !px-2 !py-[2px] !text-[9.5px]">
                            receita
                          </span>
                        )}
                      </div>
                    </Td>
                    <Td className="text-fg-faint">{product.category}</Td>
                    <Td className="tnum font-mono">{product.askedTimes}</Td>
                    <Td>
                      <span
                        className={cn(
                          "tnum font-mono",
                          low ? "text-caution" : "text-fg-muted",
                        )}
                      >
                        {product.stock}
                      </span>
                      <span className="text-[10.5px] text-fg-ghost">
                        {" "}
                        / mín. {product.minStock}
                      </span>
                    </Td>
                    <Td align="right" className="tnum font-mono font-medium text-fg">
                      {formatBRLCents(product.price)}
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </Panel>

        <div className="flex flex-col gap-4 xl:col-span-4">
          <Panel>
            <PanelHeader
              eyebrow="Reposição"
              title="Abaixo do estoque mínimo"
              action={
                <span className="chip chip-warn">{critical.length} itens</span>
              }
            />
            <ul className="space-y-1 px-3 pb-4">
              {critical.map((product) => (
                <li
                  key={product.id}
                  className="flex items-start gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-white/[0.03]"
                >
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 shrink-0 text-caution"
                    strokeWidth={2}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-fg">
                      {product.name}
                    </p>
                    <p className="tnum font-mono text-[11px] text-fg-ghost">
                      {product.stock} un · mínimo {product.minStock}
                    </p>
                  </div>
                  <button className="btn-ghost shrink-0 !px-3 !py-1 !text-[11px]">
                    repor
                  </button>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel className="flex-1">
            <PanelHeader eyebrow="Integração" title="Origem dos dados" />
            <div className="px-5 pb-5">
              <p className="text-[12.5px] leading-relaxed text-fg-muted">
                Hoje o catálogo é alimentado por importação manual. Ao conectar o
                sistema de PDV da rede, preço e estoque passam a ser lidos em
                tempo real — é o que permite o agente fechar pedido sem conferência
                humana.
              </p>
              <button className="btn-ghost mt-4 w-full">
                Configurar integração com o PDV
              </button>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
