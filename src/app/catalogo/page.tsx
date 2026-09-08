"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Package, Plus, Search, Trash2 } from "lucide-react";
import { PageHeader, Panel, PanelHeader } from "@/components/ui/panel";
import { Table, Td, Thead, Tr } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal, Campo, Entrada } from "@/components/ui/modal";
import { Reveal } from "@/components/ui/reveal";
import { useAppState } from "@/components/providers/app-state";
import {
  atualizarEstoque,
  criarProduto,
  removerProduto,
  useBanco,
} from "@/lib/db/use-db";
import { cn, formatBRLCents } from "@/lib/utils";

const CATEGORIAS = [
  "Genérico",
  "Referência",
  "Similar",
  "Dermocosmético",
  "Higiene",
  "Outro",
];

export default function CatalogoPage() {
  const { banco, carregado } = useBanco();
  const { busca } = useAppState();
  const [buscaLocal, setBuscaLocal] = useState("");
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    categoria: CATEGORIAS[0],
    preco: "",
    estoque: "",
    estoqueMinimo: "",
    exigeReceita: false,
  });

  const termo = (buscaLocal || busca).toLowerCase().trim();

  const visiveis = useMemo(
    () =>
      banco.produtos.filter(
        (p) => !termo || p.nome.toLowerCase().includes(termo),
      ),
    [banco.produtos, termo],
  );

  const criticos = banco.produtos.filter((p) => p.estoque < p.estoqueMinimo);

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    const preco = Number(form.preco.replace(",", "."));
    if (!form.nome.trim() || Number.isNaN(preco)) return;

    criarProduto({
      nome: form.nome.trim(),
      categoria: form.categoria,
      preco,
      estoque: Number(form.estoque) || 0,
      estoqueMinimo: Number(form.estoqueMinimo) || 0,
      exigeReceita: form.exigeReceita,
    });
    setForm({
      nome: "",
      categoria: CATEGORIAS[0],
      preco: "",
      estoque: "",
      estoqueMinimo: "",
      exigeReceita: false,
    });
    setAberto(false);
  }

  return (
    <div className="mx-auto max-w-[1560px]">
      <PageHeader
        title="Catálogo"
        description="O que esta loja vende. O agente responde preço e estoque a partir daqui."
        action={
          <button onClick={() => setAberto(true)} className="btn-primary">
            <Plus className="h-4 w-4" strokeWidth={2.4} />
            Adicionar produto
          </button>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: "Produtos cadastrados", valor: banco.produtos.length },
          { label: "Abaixo do mínimo", valor: criticos.length },
          {
            label: "Exigem receita",
            valor: banco.produtos.filter((p) => p.exigeReceita).length,
          },
        ].map((stat, i) => (
          <Reveal
            key={stat.label}
            className="tile p-4"
            style={{ animation: `rise 0.5s cubic-bezier(0.16,1,0.3,1) ${i * 60}ms both` }}
          >
            <p className="text-[12px] text-fg-muted">{stat.label}</p>
            <p className="tnum mt-2 text-[23px] font-semibold leading-none tracking-[-0.03em] text-fg">
              {carregado ? stat.valor : 0}
            </p>
          </Reveal>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Panel className={criticos.length > 0 ? "xl:col-span-8" : "xl:col-span-12"}>
          <PanelHeader
            eyebrow="Produtos"
            title="Catálogo da loja"
            action={
              banco.produtos.length > 0 ? (
                <div className="relative hidden sm:block">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-[14px] w-[14px] -translate-y-1/2 text-fg-ghost"
                    strokeWidth={2}
                  />
                  <input
                    value={buscaLocal}
                    onChange={(e) => setBuscaLocal(e.target.value)}
                    className="field !w-[170px] !py-1.5 !pl-8.5 !text-[12px]"
                    placeholder="Buscar"
                  />
                </div>
              ) : undefined
            }
          />

          {banco.produtos.length === 0 ? (
            <EmptyState
              icon={Package}
              title="Catálogo vazio"
              description="Cadastre os produtos que a loja vende. Sem isso o agente não consegue informar preço nem disponibilidade."
              action={
                <button onClick={() => setAberto(true)} className="btn-primary">
                  <Plus className="h-4 w-4" strokeWidth={2.4} />
                  Adicionar o primeiro
                </button>
              }
            />
          ) : visiveis.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Nenhum produto encontrado"
              description={`Nada corresponde a "${termo}".`}
            />
          ) : (
            <Table>
              <Thead
                columns={["Produto", "Categoria", "Estoque", "Preço", "Ação"]}
              />
              <tbody>
                {visiveis.map((produto, i) => {
                  const baixo = produto.estoque < produto.estoqueMinimo;
                  return (
                    <Tr key={produto.id} index={i}>
                      <Td>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-fg">{produto.nome}</p>
                          {produto.exigeReceita && (
                            <span className="chip !px-2 !py-[2px] !text-[9.5px]">
                              receita
                            </span>
                          )}
                        </div>
                      </Td>
                      <Td className="text-fg-faint">{produto.categoria}</Td>
                      <Td>
                        <input
                          type="number"
                          value={produto.estoque}
                          min={0}
                          onChange={(e) =>
                            atualizarEstoque(produto.id, Number(e.target.value) || 0)
                          }
                          className={cn(
                            "tnum w-[72px] rounded-lg border border-hairline bg-white/[0.035] px-2 py-1 font-mono text-[12px] outline-none transition-colors focus:border-brand-500/50",
                            baixo ? "text-caution" : "text-fg-muted",
                          )}
                        />
                        <span className="ml-1.5 text-[10.5px] text-fg-ghost">
                          mín. {produto.estoqueMinimo}
                        </span>
                      </Td>
                      <Td className="tnum font-mono font-medium text-fg">
                        {formatBRLCents(produto.preco)}
                      </Td>
                      <Td align="right">
                        <button
                          onClick={() => removerProduto(produto.id)}
                          aria-label={`Remover ${produto.nome}`}
                          className="rounded-lg p-1.5 text-fg-ghost transition-colors hover:bg-white/[0.06] hover:text-negative"
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                        </button>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Panel>

        {criticos.length > 0 && (
          <Panel className="xl:col-span-4">
            <PanelHeader
              eyebrow="Reposição"
              title="Abaixo do mínimo"
              action={<span className="chip chip-warn">{criticos.length}</span>}
            />
            <ul className="space-y-1 px-3 pb-4">
              {criticos.map((produto) => (
                <Reveal
                  as="li"
                  key={produto.id}
                  className="flex items-start gap-3 rounded-xl px-2 py-2.5"
                >
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 shrink-0 text-caution"
                    strokeWidth={2}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-fg">
                      {produto.nome}
                    </p>
                    <p className="tnum font-mono text-[11px] text-fg-ghost">
                      {produto.estoque} em estoque, mínimo {produto.estoqueMinimo}
                    </p>
                  </div>
                </Reveal>
              ))}
            </ul>
          </Panel>
        )}
      </div>

      <Modal
        aberto={aberto}
        titulo="Novo produto"
        onFechar={() => setAberto(false)}
      >
        <form onSubmit={salvar} className="space-y-4">
          <Campo label="Nome do produto">
            <Entrada
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Ex: Dipirona 500mg 20 comprimidos"
              required
              autoFocus
            />
          </Campo>

          <div className="grid grid-cols-2 gap-3">
            <Campo label="Categoria">
              <select
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                className="w-full rounded-xl border border-hairline bg-white/[0.035] px-3 py-2.5 text-[13px] text-fg outline-none transition-colors focus:border-brand-500/50"
              >
                {CATEGORIAS.map((c) => (
                  <option key={c} value={c} className="bg-surface">
                    {c}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo label="Preço em reais">
              <Entrada
                value={form.preco}
                onChange={(e) => setForm({ ...form, preco: e.target.value })}
                placeholder="Ex: 12,90"
                inputMode="decimal"
                required
              />
            </Campo>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Campo label="Estoque atual">
              <Entrada
                type="number"
                min={0}
                value={form.estoque}
                onChange={(e) => setForm({ ...form, estoque: e.target.value })}
                placeholder="0"
              />
            </Campo>

            <Campo label="Estoque mínimo" hint="Abaixo disso o sistema avisa.">
              <Entrada
                type="number"
                min={0}
                value={form.estoqueMinimo}
                onChange={(e) => setForm({ ...form, estoqueMinimo: e.target.value })}
                placeholder="0"
              />
            </Campo>
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-hairline bg-white/[0.028] p-3">
            <input
              type="checkbox"
              checked={form.exigeReceita}
              onChange={(e) => setForm({ ...form, exigeReceita: e.target.checked })}
              className="h-4 w-4 shrink-0 accent-[var(--color-brand-500)]"
            />
            <span className="text-[12.5px] text-fg">Exige receita</span>
          </label>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="btn-ghost"
            >
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              Adicionar
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
