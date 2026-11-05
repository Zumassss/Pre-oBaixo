"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Minus, Package, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/empty-state";
import { Campo, Entrada } from "@/components/ui/modal";
import { Gaveta, SecaoGaveta } from "@/components/ui/gaveta";
import { useAppState } from "@/components/providers/app-state";
import { atualizarProduto, criarProduto, removerProduto, useBanco } from "@/lib/db/use-db";
import { ehMedicamento, type Produto } from "@/lib/db/types";
import { cn, formatBRLCents } from "@/lib/utils";

const CATEGORIAS = [
  "Genérico",
  "Referência",
  "Similar",
  "Dermocosmético",
  "Higiene",
  "Conveniência",
  "Outro",
];

type Filtro = "todos" | "repor" | "zerado" | "receita" | "promocao";

const FILTROS: { id: Filtro; label: string; testa: (p: Produto) => boolean }[] = [
  { id: "todos", label: "Todos", testa: () => true },
  { id: "repor", label: "Para repor", testa: (p) => p.estoque > 0 && p.estoque < p.estoqueMinimo },
  { id: "zerado", label: "Sem estoque", testa: (p) => p.estoque <= 0 },
  { id: "receita", label: "Com receita", testa: (p) => p.exigeReceita },
  { id: "promocao", label: "Em promoção", testa: (p) => p.promocao > 0 },
];

type Ordem = "nome" | "estoque" | "preco";

/** Como o estoque está, em palavras. A cor só acompanha. */
function situacaoEstoque(p: Produto) {
  if (p.estoque <= 0) return { texto: "Sem estoque", ponto: "[--ponto:var(--color-negative)]" };
  if (p.estoque < p.estoqueMinimo) return { texto: "Repor", ponto: "[--ponto:var(--color-caution)]" };
  return { texto: "Disponível", ponto: "[--ponto:var(--color-positive)]" };
}

export default function CatalogoPage() {
  // O Suspense é exigido pelo Next para ler "?filtro=" numa página gerada
  // de antemão (o painel manda para cá já filtrado em "para repor").
  return (
    <Suspense>
      <Catalogo />
    </Suspense>
  );
}

function Catalogo() {
  const { banco, carregado } = useBanco();
  const { busca } = useAppState();
  const parametros = useSearchParams();
  const pedido = parametros.get("filtro");
  const filtroInicial: Filtro = FILTROS.some((f) => f.id === pedido) ? (pedido as Filtro) : "todos";

  const [buscaLocal, setBuscaLocal] = useState("");
  const [filtro, setFiltro] = useState<Filtro>(filtroInicial);
  const [categoria, setCategoria] = useState("todas");
  const [ordem, setOrdem] = useState<Ordem>("nome");
  // null = gaveta fechada; "novo" = cadastro; id = edição.
  const [editando, setEditando] = useState<string | null>(null);

  const termo = (buscaLocal || busca).toLowerCase().trim();

  const visiveis = useMemo(() => {
    const regra = FILTROS.find((f) => f.id === filtro)!;
    return banco.produtos
      .filter(
        (p) =>
          regra.testa(p) &&
          (categoria === "todas" || p.categoria === categoria) &&
          (!termo ||
            p.nome.toLowerCase().includes(termo) ||
            p.principioAtivo.toLowerCase().includes(termo) ||
            p.laboratorio.toLowerCase().includes(termo) ||
            p.codigoBarras.includes(termo)),
      )
      .sort((a, b) =>
        ordem === "estoque"
          ? a.estoque - a.estoqueMinimo - (b.estoque - b.estoqueMinimo)
          : ordem === "preco"
            ? b.preco - a.preco
            : a.nome.localeCompare(b.nome, "pt-BR"),
      );
  }, [banco.produtos, filtro, categoria, ordem, termo]);

  const categoriasUsadas = useMemo(
    () => [...new Set(banco.produtos.map((p) => p.categoria))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [banco.produtos],
  );

  const produtoEditado = editando && editando !== "novo" ? banco.produtos.find((p) => p.id === editando) : undefined;

  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader
        title="Catálogo"
        description="O que esta loja vende. O agente responde preço e estoque a partir daqui."
        action={
          <button onClick={() => setEditando("novo")} className="btn-primary">
            <Plus className="h-4 w-4" strokeWidth={2.4} />
            Adicionar produto
          </button>
        }
      />

      {banco.produtos.length === 0 && carregado ? (
        <div className="panel">
          <EmptyState
            icon={Package}
            title="Catálogo vazio"
            description="Cadastre os produtos que a loja vende. Sem isso o agente não consegue informar preço nem disponibilidade."
            action={
              <button onClick={() => setEditando("novo")} className="btn-primary">
                <Plus className="h-4 w-4" strokeWidth={2.4} />
                Adicionar o primeiro
              </button>
            }
          />
        </div>
      ) : (
        <div className="panel overflow-hidden">
          {/* Busca, filtro e ordem numa faixa só, em cima da lista. */}
          <div className="flex flex-wrap items-center gap-3 border-b border-hairline p-4">
            <div className="relative min-w-[220px] flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-fg-ghost"
                strokeWidth={2}
              />
              <input
                value={buscaLocal}
                onChange={(e) => setBuscaLocal(e.target.value)}
                className="field !py-2 !pl-9 !text-[13px]"
                placeholder="Buscar por nome, princípio ativo, laboratório ou código"
              />
            </div>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              aria-label="Categoria"
              className="field !w-auto !py-2 !pr-8 !text-[13px]"
            >
              <option value="todas">Todas as categorias</option>
              {categoriasUsadas.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={ordem}
              onChange={(e) => setOrdem(e.target.value as Ordem)}
              aria-label="Ordenar"
              className="field !w-auto !py-2 !pr-8 !text-[13px]"
            >
              <option value="nome">Ordem: nome</option>
              <option value="estoque">Ordem: estoque mais crítico</option>
              <option value="preco">Ordem: maior preço</option>
            </select>
          </div>

          <div className="flex flex-wrap gap-1 border-b border-hairline px-4 py-2.5">
            {FILTROS.map((f) => {
              const total = banco.produtos.filter(f.testa).length;
              if (f.id !== "todos" && total === 0 && filtro !== f.id) return null;
              const ativo = filtro === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setFiltro(f.id)}
                  aria-pressed={ativo}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12.5px] font-medium transition-colors",
                    ativo ? "bg-nivel-4 text-fg" : "text-fg-muted hover:bg-nivel-2 hover:text-fg",
                  )}
                >
                  {f.label}
                  <span className="tnum text-[11px] opacity-60">{total}</span>
                </button>
              );
            })}
          </div>

          {visiveis.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Nenhum produto aqui"
              description={termo ? `Nada corresponde a "${termo}" neste filtro.` : "Nenhum produto neste filtro."}
            />
          ) : (
            <>
            {/* No celular, lista: a tabela de seis colunas não cabe sem rolar de lado. */}
            <ul className="divide-y divide-hairline md:hidden">
              {visiveis.map((p) => {
                const situacao = situacaoEstoque(p);
                return (
                  <li key={p.id}>
                    <button onClick={() => setEditando(p.id)} className="selectable flex w-full items-start gap-3 px-4 py-3.5 text-left">
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-medium text-fg">{p.nome}</span>
                        <span className="mt-0.5 block text-[12px] text-fg-faint">
                          {p.categoria}
                          {p.exigeReceita ? " · receita" : ""} · {p.estoque} em estoque
                        </span>
                        <span className={cn("estado mt-1", situacao.ponto)}>{situacao.texto}</span>
                      </span>
                      <span className="tnum shrink-0 text-[14px] font-medium text-fg">
                        {formatBRLCents(p.promocao > 0 ? p.promocao : p.preco)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-hairline text-[12px] font-medium text-fg-faint">
                    <th className="px-5 py-2.5 font-medium">Produto</th>
                    <th className="px-4 py-2.5 font-medium">Categoria</th>
                    <th className="px-4 py-2.5 text-right font-medium">Estoque</th>
                    <th className="px-4 py-2.5 font-medium">Situação</th>
                    <th className="px-4 py-2.5 text-right font-medium">Preço</th>
                    <th className="w-[1%] px-5 py-2.5" aria-label="Ações" />
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((p) => {
                    const situacao = situacaoEstoque(p);
                    const detalhe = [p.principioAtivo, p.laboratorio].filter(Boolean).join(" · ");
                    return (
                      <tr
                        key={p.id}
                        onClick={() => setEditando(p.id)}
                        className="selectable cursor-pointer border-b border-hairline last:border-0"
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <p className="text-[13.5px] font-medium text-fg">{p.nome}</p>
                            {p.exigeReceita && <span className="chip !py-0.5">receita</span>}
                          </div>
                          {detalhe && <p className="mt-0.5 text-[12px] text-fg-faint">{detalhe}</p>}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-[13px] text-fg-muted">{p.categoria}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <span className="tnum text-[13.5px] text-fg">{p.estoque}</span>
                          <span className="tnum ml-1 text-[12px] text-fg-ghost">/ mín. {p.estoqueMinimo}</span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className={cn("estado", situacao.ponto)}>{situacao.texto}</span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          {p.promocao > 0 ? (
                            <span className="inline-flex flex-col items-end leading-tight">
                              <span className="tnum text-[13.5px] font-medium text-fg">{formatBRLCents(p.promocao)}</span>
                              <span className="tnum text-[11.5px] text-fg-ghost line-through">{formatBRLCents(p.preco)}</span>
                            </span>
                          ) : (
                            <span className="tnum text-[13.5px] font-medium text-fg">{formatBRLCents(p.preco)}</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditando(p.id);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] text-fg-muted transition-colors hover:bg-nivel-3 hover:text-fg"
                          >
                            <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                            Editar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}

          <p className="border-t border-hairline px-5 py-3 text-[12px] text-fg-faint">
            Mostrando {visiveis.length} de {banco.produtos.length} produtos. Clique numa linha para editar.
          </p>
        </div>
      )}

      {editando && (
        <EditorProduto
          key={editando}
          produto={produtoEditado}
          onFechar={() => setEditando(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------
   Gaveta de cadastro e edição
   ------------------------------------------------------------------ */

function paraTexto(valor: number) {
  return valor > 0 ? valor.toFixed(2).replace(".", ",") : "";
}

function paraNumero(texto: string) {
  return Number(texto.replace(/\./g, "").replace(",", ".")) || 0;
}

function EditorProduto({ produto, onFechar }: { produto?: Produto; onFechar: () => void }) {
  const novo = !produto;
  const [form, setForm] = useState({
    nome: produto?.nome ?? "",
    categoria: produto?.categoria ?? CATEGORIAS[0],
    laboratorio: produto?.laboratorio ?? "",
    principioAtivo: produto?.principioAtivo ?? "",
    codigoBarras: produto?.codigoBarras ?? "",
    preco: produto ? paraTexto(produto.preco) : "",
    promocao: produto ? paraTexto(produto.promocao) : "",
    estoque: String(produto?.estoque ?? ""),
    estoqueMinimo: String(produto?.estoqueMinimo ?? ""),
    exigeReceita: produto?.exigeReceita ?? false,
  });
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);

  const preco = paraNumero(form.preco);
  const promocao = paraNumero(form.promocao);
  const ehRemedio = ehMedicamento({ categoria: form.categoria, exigeReceita: form.exigeReceita });

  // Cada aviso diz o que acontece e por quê, perto do campo que o causa.
  const avisoPromocao = form.exigeReceita
    ? "Produto com receita não pode ter promoção: a ANVISA proíbe anunciar."
    : promocao > 0 && promocao >= preco
      ? "A promoção precisa ser menor que o preço normal, senão ela é ignorada."
      : ehRemedio
        ? "É remédio: o agente informa o preço, mas nunca oferece nem sugere."
        : "Quando preenchido, o agente pode oferecer no WhatsApp.";

  const estoqueNum = Number(form.estoque) || 0;
  const minimoNum = Number(form.estoqueMinimo) || 0;
  const podeSalvar = form.nome.trim() && preco > 0;

  function ajustarEstoque(delta: number) {
    setForm((f) => ({ ...f, estoque: String(Math.max(0, (Number(f.estoque) || 0) + delta)) }));
  }

  function salvar(e?: React.FormEvent) {
    e?.preventDefault();
    if (!podeSalvar) return;
    const dados = {
      nome: form.nome.trim(),
      categoria: form.categoria,
      laboratorio: form.laboratorio.trim(),
      principioAtivo: form.principioAtivo.trim(),
      codigoBarras: form.codigoBarras.replace(/\D/g, ""),
      preco,
      promocao: !form.exigeReceita && promocao > 0 && promocao < preco ? promocao : 0,
      estoque: estoqueNum,
      estoqueMinimo: minimoNum,
      exigeReceita: form.exigeReceita,
    };
    if (produto) atualizarProduto(produto.id, dados);
    else criarProduto(dados);
    onFechar();
  }

  return (
    <Gaveta
      aberta
      titulo={novo ? "Novo produto" : "Editar produto"}
      descricao={novo ? "O agente passa a responder preço e estoque deste item." : produto.nome}
      onFechar={onFechar}
      rodape={
        <>
          {!novo &&
            (confirmarExclusao ? (
              <span className="mr-auto flex items-center gap-2">
                <span className="text-[12.5px] text-fg-muted">Excluir de vez?</span>
                <button
                  onClick={() => {
                    removerProduto(produto.id);
                    onFechar();
                  }}
                  className="btn-perigo !px-3 !py-1.5 !text-[12.5px]"
                >
                  Excluir
                </button>
                <button
                  onClick={() => setConfirmarExclusao(false)}
                  className="rounded-lg px-2 py-1.5 text-[12.5px] text-fg-muted hover:text-fg"
                >
                  Não
                </button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmarExclusao(true)}
                className="mr-auto inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12.5px] text-fg-faint transition-colors hover:bg-nivel-3 hover:text-negative"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                Excluir produto
              </button>
            ))}
          <button onClick={onFechar} className="btn-ghost ml-auto">
            Cancelar
          </button>
          <button onClick={() => salvar()} disabled={!podeSalvar} className="btn-primary">
            {novo ? "Adicionar" : "Salvar alterações"}
          </button>
        </>
      }
    >
      <form onSubmit={salvar} className="space-y-5">
        <SecaoGaveta titulo="Identificação">
          <Campo label="Nome como aparece para o cliente">
            <Entrada
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Ex: Dipirona 500mg 20 comprimidos"
              autoFocus={novo}
              required
            />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Categoria">
              <select
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                className="w-full rounded-xl border border-hairline bg-nivel-2 px-3 py-2.5 text-[13px] text-fg outline-none transition-colors focus:border-hairline-strong"
              >
                {CATEGORIAS.map((c) => (
                  <option key={c} value={c} className="bg-surface">
                    {c}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo label="Laboratório ou marca">
              <Entrada
                value={form.laboratorio}
                onChange={(e) => setForm({ ...form, laboratorio: e.target.value })}
                placeholder="Opcional"
              />
            </Campo>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Princípio ativo">
              <Entrada
                value={form.principioAtivo}
                onChange={(e) => setForm({ ...form, principioAtivo: e.target.value })}
                placeholder="Opcional"
              />
            </Campo>
            <Campo label="Código de barras">
              <Entrada
                value={form.codigoBarras}
                onChange={(e) => setForm({ ...form, codigoBarras: e.target.value })}
                placeholder="Opcional"
                inputMode="numeric"
              />
            </Campo>
          </div>
        </SecaoGaveta>

        <SecaoGaveta titulo="Preço">
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Preço normal (R$)">
              <Entrada
                value={form.preco}
                onChange={(e) => setForm({ ...form, preco: e.target.value })}
                placeholder="12,90"
                inputMode="decimal"
                required
              />
            </Campo>
            <Campo label="Preço de promoção (R$)">
              <Entrada
                value={form.exigeReceita ? "" : form.promocao}
                onChange={(e) => setForm({ ...form, promocao: e.target.value })}
                placeholder={form.exigeReceita ? "Não permitido" : "Sem promoção"}
                inputMode="decimal"
                disabled={form.exigeReceita}
              />
            </Campo>
          </div>
          <p
            className={cn(
              "text-[12px] leading-relaxed",
              !form.exigeReceita && promocao > 0 && promocao >= preco ? "text-caution" : "text-fg-faint",
            )}
          >
            {avisoPromocao}
          </p>
        </SecaoGaveta>

        <SecaoGaveta titulo="Estoque">
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Quantidade na loja">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => ajustarEstoque(-1)}
                  aria-label="Tirar um"
                  className="flex h-[42px] w-10 shrink-0 items-center justify-center rounded-xl border border-hairline bg-nivel-2 text-fg-muted hover:bg-nivel-3 hover:text-fg"
                >
                  <Minus className="h-4 w-4" strokeWidth={2} />
                </button>
                <Entrada
                  type="number"
                  min={0}
                  value={form.estoque}
                  onChange={(e) => setForm({ ...form, estoque: e.target.value })}
                  className="tnum text-center"
                />
                <button
                  type="button"
                  onClick={() => ajustarEstoque(1)}
                  aria-label="Somar um"
                  className="flex h-[42px] w-10 shrink-0 items-center justify-center rounded-xl border border-hairline bg-nivel-2 text-fg-muted hover:bg-nivel-3 hover:text-fg"
                >
                  <Plus className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
            </Campo>
            <Campo label="Mínimo para avisar">
              <Entrada
                type="number"
                min={0}
                value={form.estoqueMinimo}
                onChange={(e) => setForm({ ...form, estoqueMinimo: e.target.value })}
                className="tnum"
              />
            </Campo>
          </div>
          <p className="text-[12px] leading-relaxed text-fg-faint">
            {estoqueNum <= 0
              ? "Sem estoque: o agente avisa o cliente que está em falta."
              : estoqueNum < minimoNum
                ? `Abaixo do mínimo: aparece em "Precisa de você" no painel até repor.`
                : "O estoque cai sozinho quando um pedido sai da loja."}
          </p>
        </SecaoGaveta>

        <SecaoGaveta titulo="Receita">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={form.exigeReceita}
              onChange={(e) => setForm({ ...form, exigeReceita: e.target.checked })}
              className="mt-0.5 h-4 w-4 shrink-0 accent-fg"
            />
            <span>
              <span className="block text-[13px] text-fg">Exige receita</span>
              <span className="block text-[12px] leading-relaxed text-fg-faint">
                Pedido com este item fica parado em &quot;Aguardando receita&quot; até alguém conferir.
              </span>
            </span>
          </label>
        </SecaoGaveta>
      </form>
    </Gaveta>
  );
}
