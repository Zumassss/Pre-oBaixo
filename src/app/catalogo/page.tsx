"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Check, Plus, Search } from "lucide-react";
import { PageHeader, Panel, PanelHeader } from "@/components/ui/panel";
import { Table, Td, Thead, Tr } from "@/components/ui/table";
import { Dropdown } from "@/components/ui/dropdown";
import { Reveal } from "@/components/ui/reveal";
import { useAppState } from "@/components/providers/app-state";
import { products } from "@/lib/mock/catalog";
import { cn, formatBRLCents, formatNumber } from "@/lib/utils";

const CATEGORIAS = [
  { value: "todas", label: "Todas as categorias" },
  { value: "Genérico", label: "Genérico" },
  { value: "Referência", label: "Referência" },
  { value: "Similar", label: "Similar" },
  { value: "Dermocosmético", label: "Dermocosmético" },
  { value: "Higiene", label: "Higiene" },
];

export default function CatalogoPage() {
  const { busca } = useAppState();
  const [buscaLocal, setBuscaLocal] = useState("");
  const [categoria, setCategoria] = useState("todas");
  const [repostos, setRepostos] = useState<string[]>([]);

  const termo = (buscaLocal || busca).toLowerCase().trim();

  const visiveis = useMemo(
    () =>
      products.filter((p) => {
        const passaBusca = !termo || p.name.toLowerCase().includes(termo);
        const passaCategoria = categoria === "todas" || p.category === categoria;
        return passaBusca && passaCategoria;
      }),
    [termo, categoria],
  );

  const criticos = products.filter(
    (p) => p.stock < p.minStock && !repostos.includes(p.id),
  );
  const totalConsultas = products.reduce((s, p) => s + p.askedTimes, 0);

  return (
    <div className="mx-auto max-w-[1560px]">
      <PageHeader
        title="Catálogo"
        description="O que o agente consulta para responder preço e estoque."
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
            value: String(criticos.length),
            hint: "exigem reposição",
          },
          { label: "Cobertura de resposta", value: "97,4%", hint: "com preço válido" },
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
            eyebrow="Produtos"
            title="Mais consultados"
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
                    className="field !w-[150px] !py-1.5 !pl-8.5 !text-[12px]"
                    placeholder="Buscar"
                  />
                </div>
                <Dropdown
                  value={categoria}
                  options={CATEGORIAS}
                  onChange={setCategoria}
                  align="right"
                />
              </div>
            }
          />
          <Table>
            <Thead columns={["Produto", "Categoria", "Consultas", "Estoque", "Preço"]} />
            <tbody>
              {visiveis.map((product, i) => {
                const baixo = product.stock < product.minStock;
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
                          baixo ? "text-caution" : "text-fg-muted",
                        )}
                      >
                        {product.stock}
                      </span>
                      <span className="text-[10.5px] text-fg-ghost">
                        {" "}
                        de {product.minStock} mín.
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
          {visiveis.length === 0 && (
            <p className="px-5 py-10 text-center text-[12.5px] text-fg-ghost">
              Nenhum produto com esse filtro.
            </p>
          )}
        </Panel>

        <div className="flex flex-col gap-4 xl:col-span-4">
          <Panel>
            <PanelHeader
              eyebrow="Reposição"
              title="Abaixo do mínimo"
              action={
                <span className={cn("chip", criticos.length ? "chip-warn" : "chip-good")}>
                  {criticos.length || "tudo certo"}
                </span>
              }
            />
            <ul className="space-y-1 px-3 pb-4">
              {criticos.map((product) => (
                <Reveal
                  as="li"
                  key={product.id}
                  className="flex items-start gap-3 rounded-xl px-2 py-2.5"
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
                      {product.stock} un, mínimo {product.minStock}
                    </p>
                  </div>
                  <button
                    onClick={() => setRepostos((r) => [...r, product.id])}
                    className="btn-ghost shrink-0 !px-3 !py-1 !text-[11px]"
                  >
                    repor
                  </button>
                </Reveal>
              ))}
              {criticos.length === 0 && (
                <li className="flex items-center gap-2 px-2 py-4 text-[12.5px] text-positive">
                  <Check className="h-4 w-4" strokeWidth={2.4} />
                  Nenhum item abaixo do mínimo.
                </li>
              )}
            </ul>
          </Panel>

          <Panel className="flex-1">
            <PanelHeader eyebrow="Integração" title="Origem dos dados" />
            <div className="px-5 pb-5">
              <p className="text-[12.5px] leading-relaxed text-fg-muted">
                Hoje o catálogo entra por importação manual. Conectando o PDV da
                rede, preço e estoque passam a ser lidos em tempo real, e o agente
                fecha pedido sem conferência.
              </p>
              <button className="btn-ghost mt-4 w-full">Configurar PDV</button>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
