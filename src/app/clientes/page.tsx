"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronRight, MessageCircle, Search, UserPlus, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/empty-state";
import { useAppState } from "@/components/providers/app-state";
import { FichaCliente } from "@/components/clientes/ficha";
import { PONTO_SITUACAO } from "@/components/clientes/situacao";
import { indexarClientes, resumoDeCompras } from "@/lib/clientes";
import { useBanco } from "@/lib/db/use-db";
import { SITUACAO_LABEL, type SituacaoCliente } from "@/lib/db/types";
import { cn, formatBRLCents } from "@/lib/utils";

const SITUACOES: SituacaoCliente[] = ["comprou", "nao_fechou", "orcou", "so_conversou", "cancelou", "sem_contato"];

type Origem = "todas" | "whatsapp" | "balcao";
type Campanha = "todos" | "sim" | "nao";
type Ordem = "recentes" | "nome" | "compras" | "gasto" | "aniversario";

function quando(em: number) {
  if (!em) return "—";
  return new Date(em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

/** Dias até o próximo aniversário, para ordenar quem faz anos primeiro. */
function diasAteAniversario(iso: string, hoje: Date) {
  const [, mes, dia] = iso.split("-").map(Number);
  if (!mes || !dia) return Infinity;
  const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  let proximo = new Date(hoje.getFullYear(), mes - 1, dia);
  if (proximo < base) proximo = new Date(hoje.getFullYear() + 1, mes - 1, dia);
  return Math.round((proximo.getTime() - base.getTime()) / 86_400_000);
}

export default function ClientesPage() {
  // O Suspense é exigido pelo Next para ler "?c=" (a ficha que outra tela,
  // como Conversas, mandou abrir) numa página gerada de antemão.
  return (
    <Suspense>
      <Clientes />
    </Suspense>
  );
}

function Clientes() {
  const { banco, carregado } = useBanco();
  const { busca } = useAppState();
  const parametros = useSearchParams();

  const [buscaLocal, setBuscaLocal] = useState("");
  const [situacao, setSituacao] = useState<SituacaoCliente | "todas">("todas");
  const [etiqueta, setEtiqueta] = useState("");
  const [origem, setOrigem] = useState<Origem>("todas");
  const [campanha, setCampanha] = useState<Campanha>("todos");
  const [ordem, setOrdem] = useState<Ordem>("recentes");
  // "novo" = cadastro; id = ficha aberta. Começa pela ficha pedida no link.
  const [fichaId, setFichaId] = useState<string | null>(parametros.get("c"));

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

  const visiveis = useMemo(() => {
    const digitos = termo.replace(/\D/g, "");
    const hoje = new Date();
    const contato = (id: string, criadoEm: number) => Math.max(indice.get(id)?.ultimaConversaEm ?? 0, criadoEm);
    return banco.clientes
      .filter((c) => {
        if (situacao !== "todas" && indice.get(c.id)?.situacao !== situacao) return false;
        if (etiqueta && !c.etiquetas.includes(etiqueta)) return false;
        if (origem === "whatsapp" && c.primeiraMensagemEm <= 0) return false;
        if (origem === "balcao" && c.primeiraMensagemEm > 0) return false;
        if (campanha === "sim" && !c.consentimento) return false;
        if (campanha === "nao" && c.consentimento) return false;
        if (!termo) return true;
        return (
          c.nome.toLowerCase().includes(termo) ||
          (digitos.length > 0 && (c.telefone + c.telefone2).replace(/\D/g, "").includes(digitos)) ||
          c.email.toLowerCase().includes(termo) ||
          c.bairro.toLowerCase().includes(termo) ||
          c.etiquetas.some((e) => e.toLowerCase().includes(termo))
        );
      })
      .sort((a, b) => {
        if (ordem === "nome") return a.nome.localeCompare(b.nome, "pt-BR");
        if (ordem === "compras")
          return resumoDeCompras(b, indice.get(b.id)?.pedidos).quantidade - resumoDeCompras(a, indice.get(a.id)?.pedidos).quantidade;
        if (ordem === "gasto")
          return resumoDeCompras(b, indice.get(b.id)?.pedidos).total - resumoDeCompras(a, indice.get(a.id)?.pedidos).total;
        if (ordem === "aniversario")
          return diasAteAniversario(a.nascimento, hoje) - diasAteAniversario(b.nascimento, hoje);
        return contato(b.id, b.criadoEm) - contato(a.id, a.criadoEm);
      });
  }, [banco.clientes, indice, situacao, etiqueta, origem, campanha, ordem, termo]);

  const filtrando =
    situacao !== "todas" || Boolean(etiqueta) || origem !== "todas" || campanha !== "todos" || Boolean(buscaLocal);

  function limpar() {
    setSituacao("todas");
    setEtiqueta("");
    setOrigem("todas");
    setCampanha("todos");
    setBuscaLocal("");
  }

  const ficha = fichaId && fichaId !== "novo" ? banco.clientes.find((c) => c.id === fichaId) : null;
  const autorizaram = banco.clientes.filter((c) => c.consentimento).length;

  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader
        title="Clientes"
        description="Quem fala com a loja no WhatsApp entra aqui sozinho. Quem compra no balcão, você cadastra."
        action={
          <button onClick={() => setFichaId("novo")} className="btn-primary">
            <UserPlus className="h-4 w-4" strokeWidth={2} />
            Novo cliente
          </button>
        }
      />

      {banco.clientes.length === 0 && carregado ? (
        <div className="panel">
          <EmptyState
            icon={Users}
            title="Nenhum cliente ainda"
            description="Quem escrever para a loja no WhatsApp aparece aqui sozinho. Você também pode cadastrar quem compra no balcão."
            action={
              <button onClick={() => setFichaId("novo")} className="btn-primary">
                <UserPlus className="h-4 w-4" strokeWidth={2} />
                Cadastrar cliente
              </button>
            }
          />
        </div>
      ) : (
        <div className="panel overflow-hidden">
          {/* Busca e filtros. Situação é o filtro principal, por isso fica
              em botões; os outros são escolhas de uma lista. */}
          <div className="space-y-3 border-b border-hairline p-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[240px] flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-fg-ghost"
                  strokeWidth={2}
                />
                <input
                  value={buscaLocal}
                  onChange={(e) => setBuscaLocal(e.target.value)}
                  className="field !py-2 !pl-9 !text-[13px]"
                  placeholder="Buscar nome, telefone, e-mail, bairro ou etiqueta"
                  aria-label="Buscar cliente"
                />
              </div>
              <select
                value={origem}
                onChange={(e) => setOrigem(e.target.value as Origem)}
                aria-label="Origem"
                className="field !w-auto !py-2 !pr-8 !text-[13px]"
              >
                <option value="todas">Qualquer origem</option>
                <option value="whatsapp">Escreveu no WhatsApp</option>
                <option value="balcao">Cadastrado na loja</option>
              </select>
              <select
                value={campanha}
                onChange={(e) => setCampanha(e.target.value as Campanha)}
                aria-label="Campanha"
                className="field !w-auto !py-2 !pr-8 !text-[13px]"
              >
                <option value="todos">Campanha: todos</option>
                <option value="sim">Autorizou campanha</option>
                <option value="nao">Não autorizou</option>
              </select>
              {etiquetasDaLoja.length > 0 && (
                <select
                  value={etiqueta}
                  onChange={(e) => setEtiqueta(e.target.value)}
                  aria-label="Etiqueta"
                  className="field !w-auto !py-2 !pr-8 !text-[13px]"
                >
                  <option value="">Qualquer etiqueta</option>
                  {etiquetasDaLoja.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </select>
              )}
              <select
                value={ordem}
                onChange={(e) => setOrdem(e.target.value as Ordem)}
                aria-label="Ordenar"
                className="field !w-auto !py-2 !pr-8 !text-[13px]"
              >
                <option value="recentes">Ordem: contato mais recente</option>
                <option value="nome">Ordem: nome</option>
                <option value="compras">Ordem: mais pedidos</option>
                <option value="gasto">Ordem: maior gasto</option>
                <option value="aniversario">Ordem: próximo aniversário</option>
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Filtrar por situação">
              <BotaoFiltro ativo={situacao === "todas"} onClick={() => setSituacao("todas")} rotulo="Todos" total={banco.clientes.length} />
              {SITUACOES.map((s) =>
                contagem[s] === 0 && situacao !== s ? null : (
                  <BotaoFiltro
                    key={s}
                    ativo={situacao === s}
                    onClick={() => setSituacao(situacao === s ? "todas" : s)}
                    rotulo={SITUACAO_LABEL[s]}
                    total={contagem[s]}
                  />
                ),
              )}
              {filtrando && (
                <button
                  onClick={limpar}
                  className="ml-auto rounded-lg px-2.5 py-1 text-[12.5px] text-fg-faint transition-colors hover:text-fg"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          </div>

          {visiveis.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Ninguém com estes filtros"
              description="Tire um dos filtros para ver mais gente."
              action={
                filtrando ? (
                  <button onClick={limpar} className="btn-ghost">
                    Limpar filtros
                  </button>
                ) : undefined
              }
            />
          ) : (
            <>
            {/* No celular, lista: a tabela não cabe sem rolar de lado. */}
            <ul className="divide-y divide-hairline md:hidden">
              {visiveis.map((cliente) => {
                const s = indice.get(cliente.id)?.situacao ?? "sem_contato";
                return (
                  <li key={cliente.id}>
                    <button onClick={() => setFichaId(cliente.id)} className="selectable flex w-full items-center gap-3 px-4 py-3.5 text-left">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-nivel-4 text-[11px] font-semibold text-fg-muted">
                        {cliente.nome.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]).join("").toUpperCase() || "?"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium text-fg">{cliente.nome}</span>
                        <span className="tnum block text-[12px] text-fg-faint">{cliente.telefone}</span>
                      </span>
                      <span className={cn("estado shrink-0 !text-[11.5px]", PONTO_SITUACAO[s])}>{SITUACAO_LABEL[s]}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-hairline text-[12px] text-fg-faint">
                    <th className="px-5 py-2.5 font-medium">Cliente</th>
                    <th className="px-4 py-2.5 font-medium">Telefone</th>
                    <th className="px-4 py-2.5 font-medium">Situação</th>
                    <th className="px-4 py-2.5 text-right font-medium">Compras</th>
                    <th className="px-4 py-2.5 font-medium">Último contato</th>
                    <th className="w-[1%] px-4 py-2.5" aria-label="Abrir" />
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((cliente) => {
                    const dados = indice.get(cliente.id);
                    const s = dados?.situacao ?? "sem_contato";
                    const compras = resumoDeCompras(cliente, dados?.pedidos);
                    return (
                      <tr
                        key={cliente.id}
                        onClick={() => setFichaId(cliente.id)}
                        className="selectable group cursor-pointer border-b border-hairline last:border-0"
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-nivel-4 text-[11px] font-semibold text-fg-muted">
                              {cliente.nome.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]).join("").toUpperCase() || "?"}
                            </span>
                            <span className="min-w-0">
                              <span className="flex items-center gap-1.5">
                                <span className="truncate text-[13.5px] font-medium text-fg">{cliente.nome}</span>
                                {cliente.primeiraMensagemEm > 0 && (
                                  <MessageCircle className="h-3 w-3 shrink-0 text-fg-ghost" strokeWidth={2} aria-label="Escreveu pelo WhatsApp" />
                                )}
                              </span>
                              {(cliente.etiquetas.length > 0 || cliente.bairro) && (
                                <span className="mt-0.5 block truncate text-[12px] text-fg-faint">
                                  {[cliente.bairro, ...cliente.etiquetas].filter(Boolean).join(" · ")}
                                </span>
                              )}
                            </span>
                          </div>
                        </td>
                        <td className="tnum whitespace-nowrap px-4 py-3 text-[13px] text-fg-muted">{cliente.telefone}</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className={cn("estado", PONTO_SITUACAO[s])}>{SITUACAO_LABEL[s]}</span>
                        </td>
                        <td className="tnum whitespace-nowrap px-4 py-3 text-right text-[13px]">
                          {compras.quantidade > 0 ? (
                            <span className="text-fg">
                              {formatBRLCents(compras.total)}
                              <span className="ml-1.5 text-fg-ghost">em {compras.quantidade}</span>
                            </span>
                          ) : (
                            <span className="text-fg-ghost">—</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-[13px] text-fg-faint">
                          {quando(Math.max(dados?.ultimaConversaEm ?? 0, compras.ultimaEm))}
                        </td>
                        <td className="px-4 py-3">
                          <ChevronRight className="h-4 w-4 text-fg-ghost transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
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
            {visiveis.length} de {banco.clientes.length} clientes · {autorizaram} autorizaram campanha. Clique num
            cliente para ver a ficha, editar e ver o histórico.
          </p>
        </div>
      )}

      {fichaId === "novo" && (
        <FichaCliente
          cliente={null}
          indice={undefined}
          lojaId={banco.loja.id}
          etiquetasDaLoja={etiquetasDaLoja}
          onFechar={() => setFichaId(null)}
        />
      )}
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
    </div>
  );
}

function BotaoFiltro({
  ativo,
  onClick,
  rotulo,
  total,
}: {
  ativo: boolean;
  onClick: () => void;
  rotulo: string;
  total: number;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12.5px] font-medium transition-colors",
        ativo ? "bg-nivel-4 text-fg" : "text-fg-muted hover:bg-nivel-2 hover:text-fg",
      )}
    >
      {rotulo}
      <span className="tnum text-[11px] opacity-60">{total}</span>
    </button>
  );
}
