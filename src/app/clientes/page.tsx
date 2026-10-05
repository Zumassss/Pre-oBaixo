"use client";

import { useMemo, useState } from "react";
import { MessageCircle, Search, Tag, UserPlus, Users } from "lucide-react";
import { PageHeader, Panel } from "@/components/ui/panel";
import { Table, Td, Thead, Tr } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal, Campo, Entrada, AreaTexto } from "@/components/ui/modal";
import { Reveal } from "@/components/ui/reveal";
import { useAppState } from "@/components/providers/app-state";
import { FichaCliente } from "@/components/clientes/ficha";
import { CORES_SITUACAO } from "@/components/clientes/situacao";
import { indexarClientes } from "@/lib/clientes";
import { criarCliente, useBanco } from "@/lib/db/use-db";
import { SITUACAO_LABEL, type SituacaoCliente } from "@/lib/db/types";
import { cn, formatBRLCents } from "@/lib/utils";

const FORM_VAZIO = {
  nome: "",
  telefone: "",
  endereco: "",
  consentimento: false,
  observacao: "",
};

const SITUACOES: SituacaoCliente[] = ["comprou", "nao_fechou", "orcou", "so_conversou", "cancelou", "sem_contato"];

function quando(em: number) {
  if (!em) return "—";
  return new Date(em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export default function ClientesPage() {
  const { banco, carregado } = useBanco();
  const { busca } = useAppState();
  const [buscaLocal, setBuscaLocal] = useState("");
  const [situacao, setSituacao] = useState<SituacaoCliente | "todas">("todas");
  const [etiqueta, setEtiqueta] = useState("");
  const [soWhatsapp, setSoWhatsapp] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState(FORM_VAZIO);
  const [fichaId, setFichaId] = useState<string | null>(null);

  const termo = (buscaLocal || busca).toLowerCase().trim();

  const indice = useMemo(
    () => indexarClientes(banco.clientes, banco.conversas, banco.pedidos),
    [banco.clientes, banco.conversas, banco.pedidos],
  );

  const etiquetasDaLoja = useMemo(
    () => [...new Set(banco.clientes.flatMap((c) => c.etiquetas))].sort((a, b) => a.localeCompare(b)),
    [banco.clientes],
  );

  const contagem = useMemo(() => {
    const total: Record<string, number> = {};
    for (const s of SITUACOES) total[s] = 0;
    for (const c of banco.clientes) total[indice.get(c.id)?.situacao ?? "sem_contato"]++;
    return total;
  }, [banco.clientes, indice]);

  // Mais recente primeiro: quem acabou de escrever está no topo.
  const visiveis = useMemo(() => {
    const digitos = termo.replace(/\D/g, "");
    return banco.clientes
      .filter((c) => {
        const dados = indice.get(c.id);
        if (situacao !== "todas" && dados?.situacao !== situacao) return false;
        if (etiqueta && !c.etiquetas.includes(etiqueta)) return false;
        if (soWhatsapp && c.primeiraMensagemEm <= 0) return false;
        if (!termo) return true;
        return (
          c.nome.toLowerCase().includes(termo) ||
          (digitos.length > 0 && c.telefone.replace(/\D/g, "").includes(digitos)) ||
          c.etiquetas.some((e) => e.toLowerCase().includes(termo))
        );
      })
      .sort(
        (a, b) =>
          Math.max(indice.get(b.id)?.ultimaConversaEm ?? 0, b.criadoEm) -
          Math.max(indice.get(a.id)?.ultimaConversaEm ?? 0, a.criadoEm),
      );
  }, [banco.clientes, indice, situacao, etiqueta, soWhatsapp, termo]);

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim() || !form.telefone.trim()) return;
    criarCliente({
      nome: form.nome.trim(),
      telefone: form.telefone.trim(),
      endereco: form.endereco.trim(),
      consentimento: form.consentimento,
      observacao: form.observacao.trim(),
      origem: "manual",
    });
    setForm(FORM_VAZIO);
    setAberto(false);
  }

  const ficha = fichaId ? banco.clientes.find((c) => c.id === fichaId) : null;
  const doWhatsapp = banco.clientes.filter((c) => c.primeiraMensagemEm > 0).length;
  const faturado = banco.clientes.reduce((s, c) => s + c.compras.total, 0);
  const filtrando = situacao !== "todas" || Boolean(etiqueta) || soWhatsapp || Boolean(termo);

  return (
    <div className="mx-auto max-w-[1560px]">
      <PageHeader
        title="Clientes"
        description="Todo mundo que falou com a loja no WhatsApp entra aqui sozinho, com o número real."
        action={
          <button onClick={() => setAberto(true)} className="btn-primary">
            <UserPlus className="h-4 w-4" strokeWidth={2} />
            Novo cliente
          </button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Clientes", valor: String(banco.clientes.length), dica: `${doWhatsapp} vieram do WhatsApp` },
          { label: "Compraram", valor: String(contagem.comprou), dica: `${formatBRLCents(faturado)} no total` },
          {
            label: "Oportunidades",
            valor: String(contagem.nao_fechou + contagem.orcou),
            dica: `${contagem.nao_fechou} não fecharam o pedido`,
          },
          {
            label: "Aceitam campanha",
            valor: String(banco.clientes.filter((c) => c.consentimento).length),
            dica: "com consentimento registrado",
          },
        ].map((stat, i) => (
          <Reveal
            key={stat.label}
            className="tile p-4"
            style={{ animation: `rise 0.5s cubic-bezier(0.16,1,0.3,1) ${i * 60}ms both` }}
          >
            <p className="text-[12px] text-fg-muted">{stat.label}</p>
            <p className="tnum mt-2 text-[23px] font-semibold leading-none tracking-[-0.03em] text-fg">
              {carregado ? stat.valor : "0"}
            </p>
            <p className="mt-1.5 truncate text-[11px] text-fg-ghost">{stat.dica}</p>
          </Reveal>
        ))}
      </div>

      <Panel>
        {/* Filtros */}
        <div className="space-y-3 border-b border-hairline p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-fg-ghost"
                strokeWidth={2}
              />
              <input
                value={buscaLocal}
                onChange={(e) => setBuscaLocal(e.target.value)}
                className="field !py-2 !pl-9.5 !text-[12.5px]"
                placeholder="Buscar por nome, telefone ou etiqueta"
                aria-label="Buscar cliente"
              />
            </div>
            {etiquetasDaLoja.length > 0 && (
              <label className="relative">
                <span className="sr-only">Filtrar por etiqueta</span>
                <Tag
                  className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-ghost"
                  strokeWidth={2}
                />
                <select
                  value={etiqueta}
                  onChange={(e) => setEtiqueta(e.target.value)}
                  className="field !w-auto !py-2 !pl-9 !pr-8 !text-[12.5px]"
                >
                  <option value="">Todas as etiquetas</option>
                  {etiquetasDaLoja.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button
              onClick={() => setSoWhatsapp((v) => !v)}
              aria-pressed={soWhatsapp}
              className={cn("chip !py-2 transition-colors", soWhatsapp && "chip-hot")}
            >
              <MessageCircle className="h-3.5 w-3.5" strokeWidth={2} />
              Só quem escreveu no WhatsApp
            </button>
          </div>
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto" role="group" aria-label="Filtrar por situação">
            <button
              onClick={() => setSituacao("todas")}
              aria-pressed={situacao === "todas"}
              className={cn("chip shrink-0 transition-colors", situacao === "todas" && "chip-hot")}
            >
              Todos <span className="tnum opacity-60">{banco.clientes.length}</span>
            </button>
            {SITUACOES.map((s) => (
              <button
                key={s}
                onClick={() => setSituacao(situacao === s ? "todas" : s)}
                aria-pressed={situacao === s}
                className={cn("chip shrink-0 transition-colors", situacao === s && "chip-hot")}
              >
                {SITUACAO_LABEL[s]} <span className="tnum opacity-60">{contagem[s]}</span>
              </button>
            ))}
          </div>
        </div>

        {banco.clientes.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nenhum cliente ainda"
            description="Quem escrever para a loja no WhatsApp aparece aqui sozinho. Você também pode cadastrar quem compra no balcão."
            action={
              <button onClick={() => setAberto(true)} className="btn-primary">
                <UserPlus className="h-4 w-4" strokeWidth={2} />
                Cadastrar cliente
              </button>
            }
          />
        ) : visiveis.length === 0 ? (
          <EmptyState
            icon={Search}
            title="Ninguém com estes filtros"
            description="Tire um dos filtros para ver mais gente."
            action={
              filtrando ? (
                <button
                  onClick={() => {
                    setSituacao("todas");
                    setEtiqueta("");
                    setSoWhatsapp(false);
                    setBuscaLocal("");
                  }}
                  className="btn-ghost"
                >
                  Limpar filtros
                </button>
              ) : undefined
            }
          />
        ) : (
          <Table>
            <Thead columns={["Cliente", "Telefone", "Situação", "Compras", "Último contato"]} />
            <tbody>
              {visiveis.map((cliente, i) => {
                const dados = indice.get(cliente.id);
                const s = dados?.situacao ?? "sem_contato";
                return (
                  <Tr key={cliente.id} index={i}>
                    <Td>
                      <button
                        onClick={() => setFichaId(cliente.id)}
                        className="group flex w-full items-center gap-2.5 text-left"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-surface-3 to-surface text-[10.5px] font-semibold text-fg-muted ring-1 ring-inset ring-anel">
                          {cliente.nome.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]).join("").toUpperCase() || "?"}
                        </span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate font-medium text-fg transition-colors group-hover:text-brand-400">
                              {cliente.nome}
                            </span>
                            {cliente.primeiraMensagemEm > 0 && (
                              <MessageCircle className="h-3 w-3 shrink-0 text-fg-ghost" strokeWidth={2} aria-label="Escreveu pelo WhatsApp" />
                            )}
                          </span>
                          {cliente.etiquetas.length > 0 && (
                            <span className="mt-0.5 flex flex-wrap gap-1">
                              {cliente.etiquetas.slice(0, 3).map((e) => (
                                <span key={e} className="rounded-full bg-nivel-3 px-1.5 py-px text-[9.5px] font-medium text-fg-muted">
                                  {e}
                                </span>
                              ))}
                              {cliente.etiquetas.length > 3 && (
                                <span className="text-[9.5px] text-fg-ghost">+{cliente.etiquetas.length - 3}</span>
                              )}
                            </span>
                          )}
                        </span>
                      </button>
                    </Td>
                    <Td className="tnum font-mono">{cliente.telefone}</Td>
                    <Td>
                      <span className={cn("chip", CORES_SITUACAO[s])}>{SITUACAO_LABEL[s]}</span>
                    </Td>
                    <Td className="tnum">
                      {cliente.compras.quantidade > 0 ? (
                        <span>
                          {cliente.compras.quantidade} · <span className="text-fg">{formatBRLCents(cliente.compras.total)}</span>
                        </span>
                      ) : (
                        <span className="text-fg-ghost">—</span>
                      )}
                    </Td>
                    <Td className="text-fg-faint">
                      {quando(Math.max(dados?.ultimaConversaEm ?? 0, cliente.compras.ultimaEm))}
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Panel>

      {ficha && (
        <FichaCliente
          key={ficha.id}
          cliente={ficha}
          indice={indice.get(ficha.id)}
          lojaId={banco.loja.id}
          etiquetasDaLoja={etiquetasDaLoja}
          onFechar={() => setFichaId(null)}
        />
      )}

      <Modal
        aberto={aberto}
        titulo="Novo cliente"
        descricao="Para quem compra no balcão ou por telefone. Quem escreve no WhatsApp entra sozinho."
        onFechar={() => setAberto(false)}
      >
        <form onSubmit={salvar} className="space-y-4">
          <Campo label="Nome completo">
            <Entrada
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Ex: Ana Paula Ribeiro"
              required
              autoFocus
            />
          </Campo>

          <Campo label="Telefone com DDD" hint="Se a pessoa escrever no WhatsApp depois, o cadastro é o mesmo.">
            <Entrada
              value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: e.target.value })}
              placeholder="Ex: 27 99999-0000"
              required
            />
          </Campo>

          <Campo label="Endereço (opcional)" hint="Só é necessário se o cliente for receber por motoboy.">
            <Entrada
              value={form.endereco}
              onChange={(e) => setForm({ ...form, endereco: e.target.value })}
              placeholder="Ex: Rua das Acácias, 45, ap. 202 - Centro"
            />
          </Campo>

          <Campo label="Observação (opcional)">
            <AreaTexto
              value={form.observacao}
              onChange={(e) => setForm({ ...form, observacao: e.target.value })}
              placeholder="Algo que a equipe precise saber"
              rows={2}
            />
          </Campo>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-hairline bg-nivel-1 p-3">
            <input
              type="checkbox"
              checked={form.consentimento}
              onChange={(e) => setForm({ ...form, consentimento: e.target.checked })}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-brand-500)]"
            />
            <span>
              <span className="block text-[12.5px] font-medium text-fg">Autoriza receber mensagens da loja</span>
              <span className="mt-0.5 block text-[11.5px] leading-relaxed text-fg-faint">
                Marque só se a pessoa disse que aceita. Sem isto, ela não entra em nenhuma campanha.
              </span>
            </span>
          </label>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setAberto(false)} className="btn-ghost">
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              Cadastrar
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
