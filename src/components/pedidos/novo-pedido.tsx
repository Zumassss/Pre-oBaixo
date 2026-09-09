"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Minus, Plus, Search, Trash2 } from "lucide-react";
import { Modal, Campo, Entrada } from "@/components/ui/modal";
import { criarPedido } from "@/lib/db/use-db";
import type { BancoLocal, ItemPedido, Pedido } from "@/lib/db/types";
import { cn, formatBRLCents } from "@/lib/utils";

/**
 * Montagem de um pedido.
 *
 * Enquanto o WhatsApp não está ligado, é por aqui que o pedido entra: a
 * pessoa do balcão registra o que o cliente pediu na conversa. Quando a API
 * da Meta estiver conectada, o agente vai chamar exatamente a mesma função
 * `criarPedido`, e esta tela vira só o caminho manual.
 */
export function NovoPedido({
  banco,
  aberto,
  onFechar,
}: {
  banco: BancoLocal;
  aberto: boolean;
  onFechar: (criado?: Pedido | null) => void;
}) {
  const [cliente, setCliente] = useState("");
  const [telefone, setTelefone] = useState("");
  const [origem, setOrigem] = useState<Pedido["origem"]>("whatsapp");
  const [forma, setForma] = useState<Pedido["formaPagamento"]>("balcao");
  const [observacao, setObservacao] = useState("");
  const [busca, setBusca] = useState("");
  const [itens, setItens] = useState<ItemPedido[]>([]);

  const encontrados = useMemo(() => {
    const termo = busca.toLowerCase().trim();
    return banco.produtos
      .filter((p) => !termo || p.nome.toLowerCase().includes(termo))
      .slice(0, 6);
  }, [banco.produtos, busca]);

  const total = itens.reduce((s, i) => s + i.precoUnitario * i.quantidade, 0);
  const temReceita = itens.some((i) => i.exigeReceita);

  function adicionar(produtoId: string) {
    const produto = banco.produtos.find((p) => p.id === produtoId);
    if (!produto) return;
    setItens((atuais) => {
      const existente = atuais.find((i) => i.produtoId === produtoId);
      if (existente) {
        return atuais.map((i) =>
          i.produtoId === produtoId ? { ...i, quantidade: i.quantidade + 1 } : i,
        );
      }
      return [
        ...atuais,
        {
          produtoId: produto.id,
          nome: produto.nome,
          precoUnitario: produto.preco,
          quantidade: 1,
          exigeReceita: produto.exigeReceita,
        },
      ];
    });
  }

  function mudarQuantidade(produtoId: string, delta: number) {
    setItens((atuais) =>
      atuais
        .map((i) =>
          i.produtoId === produtoId
            ? { ...i, quantidade: Math.max(0, i.quantidade + delta) }
            : i,
        )
        .filter((i) => i.quantidade > 0),
    );
  }

  function limpar() {
    setCliente("");
    setTelefone("");
    setOrigem("whatsapp");
    setForma("balcao");
    setObservacao("");
    setBusca("");
    setItens([]);
  }

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!cliente.trim() || itens.length === 0) return;
    const criado = criarPedido({
      cliente: cliente.trim(),
      telefone: telefone.trim(),
      origem,
      itens,
      formaPagamento: forma,
      observacao: observacao.trim(),
    });
    limpar();
    onFechar(criado);
  }

  function estoqueDe(produtoId: string) {
    return banco.produtos.find((p) => p.id === produtoId)?.estoque ?? 0;
  }

  return (
    <Modal
      aberto={aberto}
      titulo="Novo pedido"
      descricao="Monte o pedido com os produtos do catálogo desta loja."
      onFechar={() => onFechar()}
      larguraMaxima="max-w-2xl"
    >
      <form onSubmit={salvar} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo label="Cliente">
            <Entrada
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              placeholder="Nome de quem vai retirar"
              list="clientes-cadastrados"
              required
              autoFocus
            />
            <datalist id="clientes-cadastrados">
              {banco.clientes.map((c) => (
                <option key={c.id} value={c.nome} />
              ))}
            </datalist>
          </Campo>
          <Campo label="Telefone">
            <Entrada
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="Ex: 27 99999-0000"
            />
          </Campo>
        </div>

        {/* Produtos */}
        <div>
          <p className="mb-1.5 text-[11.5px] font-medium text-fg-muted">
            Produtos
          </p>

          {banco.produtos.length === 0 ? (
            <div className="tile p-3.5 text-[12.5px] text-fg-faint">
              O catálogo está vazio. Cadastre produtos antes de montar um
              pedido.
            </div>
          ) : (
            <>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-[14px] w-[14px] -translate-y-1/2 text-fg-ghost"
                  strokeWidth={2}
                />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="field w-full !py-2 !pl-9 !text-[12.5px]"
                  placeholder="Buscar produto para adicionar"
                />
              </div>

              <ul
                data-lenis-prevent
                className="mt-2 max-h-[168px] space-y-1 overflow-y-auto"
              >
                {encontrados.map((produto) => (
                  <li key={produto.id}>
                    <button
                      type="button"
                      onClick={() => adicionar(produto.id)}
                      className="flex w-full items-center gap-3 rounded-xl border border-hairline bg-white/[0.022] px-3 py-2 text-left transition-colors hover:border-hairline-strong hover:bg-white/[0.05]"
                    >
                      <Plus
                        className="h-3.5 w-3.5 shrink-0 text-fg-faint"
                        strokeWidth={2.4}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] text-fg">
                          {produto.nome}
                        </span>
                        <span className="text-[11px] text-fg-ghost">
                          {produto.estoque} em estoque
                        </span>
                      </span>
                      {produto.exigeReceita && (
                        <span className="chip !px-2 !py-[2px] !text-[9.5px]">
                          receita
                        </span>
                      )}
                      <span className="tnum shrink-0 font-mono text-[12px] text-fg-muted">
                        {formatBRLCents(produto.preco)}
                      </span>
                    </button>
                  </li>
                ))}
                {encontrados.length === 0 && (
                  <li className="px-3 py-2 text-[12px] text-fg-ghost">
                    Nenhum produto corresponde à busca.
                  </li>
                )}
              </ul>
            </>
          )}
        </div>

        {/* Itens escolhidos */}
        {itens.length > 0 && (
          <div className="rounded-xl border border-hairline bg-white/[0.022] p-2">
            <ul className="space-y-1">
              {itens.map((item) => {
                const disponivel = estoqueDe(item.produtoId);
                const faltando = item.quantidade > disponivel;
                return (
                  <li
                    key={item.produtoId}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] text-fg">
                        {item.nome}
                      </p>
                      {faltando && (
                        <p className="flex items-center gap-1 text-[10.5px] text-caution">
                          <AlertTriangle className="h-3 w-3" strokeWidth={2.2} />
                          só {disponivel} em estoque
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        aria-label={`Menos ${item.nome}`}
                        onClick={() => mudarQuantidade(item.produtoId, -1)}
                        className="rounded-lg p-1 text-fg-faint transition-colors hover:bg-white/[0.07] hover:text-fg"
                      >
                        <Minus className="h-3.5 w-3.5" strokeWidth={2.4} />
                      </button>
                      <span className="tnum w-6 text-center font-mono text-[12.5px] text-fg">
                        {item.quantidade}
                      </span>
                      <button
                        type="button"
                        aria-label={`Mais ${item.nome}`}
                        onClick={() => mudarQuantidade(item.produtoId, 1)}
                        className="rounded-lg p-1 text-fg-faint transition-colors hover:bg-white/[0.07] hover:text-fg"
                      >
                        <Plus className="h-3.5 w-3.5" strokeWidth={2.4} />
                      </button>
                    </div>

                    <span className="tnum w-[74px] shrink-0 text-right font-mono text-[12.5px] text-fg-muted">
                      {formatBRLCents(item.precoUnitario * item.quantidade)}
                    </span>

                    <button
                      type="button"
                      aria-label={`Remover ${item.nome}`}
                      onClick={() =>
                        mudarQuantidade(item.produtoId, -item.quantidade)
                      }
                      className="shrink-0 rounded-lg p-1 text-fg-ghost transition-colors hover:bg-white/[0.06] hover:text-negative"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="mt-1 flex items-center justify-between border-t border-hairline px-2 pt-2">
              <span className="text-[12px] text-fg-muted">Total</span>
              <span className="tnum font-mono text-[15px] font-semibold text-fg">
                {formatBRLCents(total)}
              </span>
            </div>
          </div>
        )}

        {temReceita && (
          <div className="flex items-start gap-2.5 rounded-xl border border-caution/30 bg-caution/[0.07] p-3">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-caution"
              strokeWidth={2}
            />
            <p className="text-[12px] leading-relaxed text-fg-muted">
              O pedido tem item que exige receita. Ele entra na fila em
              conferência e só anda depois que o farmacêutico responsável
              validar a receita.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo label="Origem">
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  ["whatsapp", "WhatsApp"],
                  ["balcao", "Balcão"],
                ] as const
              ).map(([valor, rotulo]) => (
                <button
                  key={valor}
                  type="button"
                  onClick={() => setOrigem(valor)}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-[12.5px] transition-colors",
                    origem === valor
                      ? "border-brand-500/50 bg-brand-500/[0.12] text-fg"
                      : "border-hairline bg-white/[0.03] text-fg-muted hover:bg-white/[0.06]",
                  )}
                >
                  {rotulo}
                </button>
              ))}
            </div>
          </Campo>

          <Campo label="Pagamento">
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  ["balcao", "Na retirada"],
                  ["pix", "Pix"],
                ] as const
              ).map(([valor, rotulo]) => (
                <button
                  key={valor}
                  type="button"
                  onClick={() => setForma(valor)}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-[12.5px] transition-colors",
                    forma === valor
                      ? "border-brand-500/50 bg-brand-500/[0.12] text-fg"
                      : "border-hairline bg-white/[0.03] text-fg-muted hover:bg-white/[0.06]",
                  )}
                >
                  {rotulo}
                </button>
              ))}
            </div>
          </Campo>
        </div>

        <Campo label="Observação" hint="Opcional. Ex: cliente retira depois das 18h.">
          <Entrada
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Alguma instrução para quem vai separar"
          />
        </Campo>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={() => onFechar()} className="btn-ghost">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={itens.length === 0 || !cliente.trim()}
            className="btn-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            Criar pedido
          </button>
        </div>
      </form>
    </Modal>
  );
}
