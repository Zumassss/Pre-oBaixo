"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardList,
  MessageCircle,
  MessageSquarePlus,
  Plus,
  ShoppingBag,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { Bolha } from "@/components/conversas/bolha";
import { ChipStatus } from "@/components/pedidos/status";
import { Interruptor } from "@/components/configuracoes/controles";
import { ETIQUETAS_SUGERIDAS, fimDoTelefone, type IndiceCliente } from "@/lib/clientes";
import { historicoNoServidor } from "@/lib/db/local-db";
import {
  type Cliente,
  type Conversa,
  normalizarConversa,
  type Pedido,
  SITUACAO_LABEL,
} from "@/lib/db/types";
import { abrirConversaComCliente, atualizarCliente, removerCliente, useSessao } from "@/lib/db/use-db";
import { cn, formatBRLCents } from "@/lib/utils";
import { CORES_SITUACAO } from "./situacao";

function data(em: number) {
  return em
    ? new Date(em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })
    : "—";
}

function dataHora(em: number) {
  return new Date(em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

type ItemLinha = { tipo: "conversa"; em: number; conversa: Conversa } | { tipo: "pedido"; em: number; pedido: Pedido };

/**
 * Tudo sobre uma pessoa: dados, etiquetas, compras e a linha do tempo de
 * conversas e pedidos de todos os tempos.
 *
 * A tela carrega só o recente (conversas de 90 dias, pedidos de 60). O
 * histórico antigo vem do servidor quando a ficha abre, e se junta ao que
 * já está na tela.
 */
export function FichaCliente({
  cliente,
  indice,
  lojaId,
  etiquetasDaLoja,
  onFechar,
}: {
  cliente: Cliente;
  indice: IndiceCliente | undefined;
  lojaId: string;
  etiquetasDaLoja: string[];
  onFechar: () => void;
}) {
  const router = useRouter();
  const { usuario } = useSessao();
  const [antigos, setAntigos] = useState<{ conversas: Conversa[]; pedidos: Pedido[] } | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);
  const [novaEtiqueta, setNovaEtiqueta] = useState("");
  const [endereco, setEndereco] = useState(cliente.endereco);
  const [observacao, setObservacao] = useState(cliente.observacao);

  useEffect(() => {
    let vivo = true;
    void historicoNoServidor(lojaId, cliente.telefone).then((r) => {
      if (!vivo || !r.ok) return;
      setAntigos({
        conversas: r.registros.filter((x) => x.c === "conversas" && x.d).map((x) => normalizarConversa(x.d!)),
        pedidos: r.registros.filter((x) => x.c === "pedidos" && x.d).map((x) => x.d as unknown as Pedido),
      });
    });
    return () => {
      vivo = false;
    };
  }, [lojaId, cliente.telefone]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onFechar]);

  // O que está na tela é mais novo que o que veio do servidor: vence.
  const linha = useMemo<ItemLinha[]>(() => {
    const conversas = new Map<string, Conversa>();
    for (const c of antigos?.conversas ?? []) conversas.set(c.id, c);
    for (const c of indice?.conversas ?? []) conversas.set(c.id, c);
    const pedidos = new Map<string, Pedido>();
    for (const p of antigos?.pedidos ?? []) pedidos.set(p.id, p);
    for (const p of indice?.pedidos ?? []) pedidos.set(p.id, p);
    const fim = fimDoTelefone(cliente.telefone);
    return [
      ...[...conversas.values()]
        .filter((c) => fimDoTelefone(c.telefone) === fim)
        .map((c) => ({ tipo: "conversa" as const, em: c.atualizadaEm, conversa: c })),
      ...[...pedidos.values()]
        .filter((p) => fimDoTelefone(p.telefone) === fim)
        .map((p) => ({ tipo: "pedido" as const, em: p.criadoEm, pedido: p })),
    ].sort((a, b) => b.em - a.em);
  }, [antigos, indice, cliente.telefone]);

  const situacao = indice?.situacao ?? "sem_contato";
  const podeWhatsapp = cliente.primeiraMensagemEm > 0;
  const sugestoes = [...new Set([...ETIQUETAS_SUGERIDAS, ...etiquetasDaLoja])].filter(
    (e) => !cliente.etiquetas.includes(e),
  );

  function adicionarEtiqueta(nome: string) {
    const limpa = nome.trim().slice(0, 24);
    if (!limpa || cliente.etiquetas.includes(limpa)) return;
    void atualizarCliente(cliente.id, { etiquetas: [...cliente.etiquetas, limpa] });
    setNovaEtiqueta("");
  }

  function novaConversa() {
    const conversa = abrirConversaComCliente(cliente, usuario?.nome ?? "");
    router.push(`/conversas?c=${conversa.id}`);
  }

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true" aria-label={`Ficha de ${cliente.nome}`}>
      <button aria-label="Fechar ficha" onClick={onFechar} className="absolute inset-0 cursor-default bg-veu backdrop-blur-[2px]" />
      <aside
        className="glass-solid relative flex h-full w-full max-w-[560px] flex-col overflow-hidden border-l border-hairline"
        style={{ animation: "entra-direita 0.32s cubic-bezier(0.16,1,0.3,1) both" }}
      >
        <header className="flex items-start gap-3 border-b border-hairline p-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-surface-3 to-surface text-[14px] font-semibold text-fg-muted ring-1 ring-inset ring-anel">
            {cliente.nome.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]).join("").toUpperCase() || "?"}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[17px] font-semibold tracking-[-0.01em] text-fg">{cliente.nome}</h2>
            <p className="tnum font-mono text-[12px] text-fg-faint">{cliente.telefone}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className={cn("chip", CORES_SITUACAO[situacao])}>{SITUACAO_LABEL[situacao]}</span>
              {podeWhatsapp && (
                <span className="chip">
                  <MessageCircle className="h-3 w-3" strokeWidth={2} />
                  WhatsApp desde {data(cliente.primeiraMensagemEm)}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onFechar}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-fg-faint transition-colors hover:bg-nivel-4 hover:text-fg"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </header>

        <div data-lenis-prevent className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          <button onClick={novaConversa} className="btn-primary w-full">
            <MessageSquarePlus className="h-4 w-4" strokeWidth={2} />
            {indice?.conversas.some((c) => c.status !== "resolvida") ? "Abrir a conversa em andamento" : "Nova conversa"}
          </button>
          <p className="-mt-3 text-center text-[11.5px] text-fg-ghost">
            {podeWhatsapp
              ? "Vai pelo WhatsApp: esta pessoa já escreveu para a loja."
              : "Fica registrada aqui: esta pessoa nunca escreveu pelo WhatsApp."}
          </p>

          {/* Compras */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { rotulo: "Pedidos", valor: String(cliente.compras.quantidade) },
              { rotulo: "Total gasto", valor: formatBRLCents(cliente.compras.total) },
              { rotulo: "Última compra", valor: data(cliente.compras.ultimaEm) },
            ].map((item) => (
              <div key={item.rotulo} className="tile p-3 text-center">
                <p className="tnum truncate text-[15px] font-semibold text-fg">{item.valor}</p>
                <p className="mt-0.5 text-[10.5px] text-fg-ghost">{item.rotulo}</p>
              </div>
            ))}
          </div>

          {/* Etiquetas */}
          <section>
            <p className="mb-2 flex items-center gap-1.5 text-[11.5px] font-medium text-fg-muted">
              <Tag className="h-3.5 w-3.5" strokeWidth={2} />
              Etiquetas
            </p>
            <div className="flex flex-wrap gap-1.5">
              {cliente.etiquetas.map((e) => (
                <span key={e} className="chip chip-hot">
                  {e}
                  <button
                    onClick={() => void atualizarCliente(cliente.id, { etiquetas: cliente.etiquetas.filter((x) => x !== e) })}
                    aria-label={`Tirar a etiqueta ${e}`}
                    className="-mr-1 rounded-full p-0.5 hover:bg-brand-500/20"
                  >
                    <X className="h-3 w-3" strokeWidth={2.2} />
                  </button>
                </span>
              ))}
              <form
                onSubmit={(ev) => {
                  ev.preventDefault();
                  adicionarEtiqueta(novaEtiqueta);
                }}
              >
                <input
                  value={novaEtiqueta}
                  onChange={(ev) => setNovaEtiqueta(ev.target.value)}
                  placeholder="Nova etiqueta"
                  aria-label="Nova etiqueta"
                  maxLength={24}
                  className="field !w-[140px] !px-3 !py-1 !text-[12px]"
                />
              </form>
            </div>
            {sugestoes.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {sugestoes.slice(0, 8).map((e) => (
                  <button
                    key={e}
                    onClick={() => adicionarEtiqueta(e)}
                    className="flex items-center gap-1 rounded-full border border-dashed border-hairline px-2.5 py-1 text-[11px] text-fg-faint transition-colors hover:border-brand-500/40 hover:text-fg"
                  >
                    <Plus className="h-3 w-3" strokeWidth={2.2} />
                    {e}
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Dados */}
          <section className="space-y-3">
            <Interruptor
              ligado={cliente.consentimento}
              onAlternar={(v) => void atualizarCliente(cliente.id, { consentimento: v })}
              rotulo="Autoriza receber campanhas"
              descricao="Exigência da LGPD. Sem isto, a pessoa não entra em nenhuma campanha."
            />
            <label className="block">
              <span className="mb-1.5 block text-[11.5px] font-medium text-fg-muted">Endereço para entrega</span>
              <input
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
                onBlur={() => endereco !== cliente.endereco && void atualizarCliente(cliente.id, { endereco })}
                placeholder="Rua, número, bairro"
                className="field"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11.5px] font-medium text-fg-muted">Observação da equipe</span>
              <textarea
                rows={2}
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                onBlur={() => observacao !== cliente.observacao && void atualizarCliente(cliente.id, { observacao })}
                placeholder="Algo que a equipe precise lembrar"
                className="field !rounded-2xl"
              />
            </label>
          </section>

          {/* Linha do tempo */}
          <section>
            <p className="mb-2 text-[11.5px] font-medium text-fg-muted">
              Histórico {antigos ? `(${linha.length})` : "(carregando o histórico completo...)"}
            </p>
            {linha.length === 0 ? (
              <p className="rounded-xl bg-nivel-2 px-3 py-4 text-center text-[12px] text-fg-faint">Nenhuma conversa ou pedido ainda.</p>
            ) : (
              <ol className="relative space-y-2 border-l border-hairline pl-4">
                {linha.map((item) =>
                  item.tipo === "pedido" ? (
                    <li key={`p-${item.pedido.id}`} className="relative">
                      <span className="absolute -left-[21px] top-3 flex h-2.5 w-2.5 rounded-full bg-positive ring-4 ring-[var(--color-void)]" aria-hidden />
                      <div className="rounded-xl border border-hairline bg-nivel-1 p-3">
                        <div className="flex items-center gap-2">
                          <ShoppingBag className="h-3.5 w-3.5 text-positive" strokeWidth={2} />
                          <p className="text-[12.5px] font-medium text-fg">Pedido #{item.pedido.numero}</p>
                          <span className="tnum ml-auto font-mono text-[12px] text-fg">{formatBRLCents(item.pedido.total)}</span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-[11.5px] text-fg-faint">
                          {item.pedido.itens.map((i) => `${i.quantidade}x ${i.nome}`).join(", ")}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <ChipStatus status={item.pedido.status} className="!px-2 !py-[2px] !text-[9.5px]" />
                          <span className="text-[10.5px] text-fg-ghost">{dataHora(item.pedido.criadoEm)}</span>
                        </div>
                      </div>
                    </li>
                  ) : (
                    <li key={`c-${item.conversa.id}`} className="relative">
                      <span className="absolute -left-[21px] top-3 flex h-2.5 w-2.5 rounded-full bg-info ring-4 ring-[var(--color-void)]" aria-hidden />
                      <div className="overflow-hidden rounded-xl border border-hairline bg-nivel-1">
                        <button
                          onClick={() => setAberta(aberta === item.conversa.id ? null : item.conversa.id)}
                          aria-expanded={aberta === item.conversa.id}
                          className="flex w-full items-center gap-2 p-3 text-left transition-colors hover:bg-nivel-2"
                        >
                          <ClipboardList className="h-3.5 w-3.5 text-info" strokeWidth={2} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-[12.5px] font-medium text-fg">
                              Conversa {item.conversa.canal === "whatsapp" ? "no WhatsApp" : "registrada"}
                            </span>
                            <span className="block text-[10.5px] text-fg-ghost">
                              {dataHora(item.conversa.criadaEm)} · {item.conversa.mensagens.length} mensagens
                            </span>
                          </span>
                          <span className={cn("chip", item.conversa.status === "resolvida" ? "chip-good" : "chip-hot")}>
                            {item.conversa.status === "resolvida" ? "resolvida" : "em andamento"}
                          </span>
                        </button>
                        {aberta === item.conversa.id && (
                          <div className="max-h-[360px] space-y-3 overflow-y-auto border-t border-hairline p-3" data-lenis-prevent>
                            {item.conversa.mensagens.map((m) => (
                              <Bolha key={m.id} mensagem={m} />
                            ))}
                          </div>
                        )}
                      </div>
                    </li>
                  ),
                )}
              </ol>
            )}
          </section>

          <button
            onClick={() => {
              if (window.confirm(`Remover ${cliente.nome} do cadastro? As conversas e os pedidos continuam no histórico.`)) {
                removerCliente(cliente.id);
                onFechar();
              }
            }}
            className="btn-ghost w-full !text-[12px] hover:!text-negative"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
            Remover do cadastro
          </button>
        </div>
      </aside>
    </div>
  );
}
