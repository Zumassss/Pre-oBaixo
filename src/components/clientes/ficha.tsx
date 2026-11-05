"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Lock,
  MessageCircle,
  MessageSquarePlus,
  Plus,
  ShoppingBag,
  Trash2,
  X,
} from "lucide-react";
import { Bolha } from "@/components/conversas/bolha";
import { ChipStatus } from "@/components/pedidos/status";
import { Interruptor } from "@/components/configuracoes/controles";
import { Gaveta, SecaoGaveta } from "@/components/ui/gaveta";
import { Campo, Entrada, AreaTexto } from "@/components/ui/modal";
import { ETIQUETAS_SUGERIDAS, fimDoTelefone, resumoDeCompras, type IndiceCliente } from "@/lib/clientes";
import { historicoNoServidor } from "@/lib/db/local-db";
import {
  type Cliente,
  type Conversa,
  normalizarConversa,
  type Pedido,
  SITUACAO_LABEL,
} from "@/lib/db/types";
import {
  abrirConversaComCliente,
  atualizarCliente,
  criarCliente,
  removerCliente,
  useSessao,
} from "@/lib/db/use-db";
import { cn, formatBRLCents } from "@/lib/utils";
import { PONTO_SITUACAO } from "./situacao";

function data(em: number) {
  return em
    ? new Date(em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "—";
}

function dataHora(em: number) {
  return new Date(em).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "12 de março" a partir de AAAA-MM-DD, sem o ano: é para lembrar aniversário. */
function aniversario(iso: string) {
  const [, mes, dia] = iso.split("-").map(Number);
  if (!mes || !dia) return "";
  return new Date(2000, mes - 1, dia).toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
}

function iniciais(nome: string) {
  return nome.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]).join("").toUpperCase() || "?";
}

type ItemLinha =
  | { tipo: "conversa"; em: number; conversa: Conversa }
  | { tipo: "pedido"; em: number; pedido: Pedido };

type Aba = "resumo" | "dados" | "historico";

const FORM_ID = "form-cliente";

const FORM_VAZIO = {
  nome: "",
  telefone: "",
  telefone2: "",
  email: "",
  nascimento: "",
  endereco: "",
  bairro: "",
  observacao: "",
  consentimento: false,
};

/**
 * A ficha do cliente.
 *
 * Três abas, porque são três perguntas diferentes: quem é e como compra
 * (Resumo), o cadastro em si (Dados) e tudo o que já aconteceu (Histórico).
 * Antes era uma coluna só, com campos que gravavam ao sair deles; aqui a
 * edição tem botão de salvar, para ninguém mudar endereço sem perceber.
 *
 * Sem `cliente`, a mesma gaveta serve para cadastrar.
 */
export function FichaCliente({
  cliente,
  indice,
  lojaId,
  etiquetasDaLoja,
  abaInicial = "resumo",
  onFechar,
}: {
  cliente: Cliente | null;
  indice: IndiceCliente | undefined;
  lojaId: string;
  etiquetasDaLoja: string[];
  abaInicial?: Aba;
  onFechar: () => void;
}) {
  const novo = !cliente;
  const [aba, setAba] = useState<Aba>(novo ? "dados" : abaInicial);
  const [confirmar, setConfirmar] = useState(false);

  // Os botões ficam no rodapé fixo da gaveta e enviam o formulário pelo id:
  // assim "Salvar" está sempre à vista, por mais comprido que seja o cadastro.
  const botoesDoFormulario = (rotulo: string, onCancelar: () => void) => (
    <>
      <button type="button" onClick={onCancelar} className="btn-ghost ml-auto">
        Cancelar
      </button>
      <button type="submit" form={FORM_ID} className="btn-primary">
        {rotulo}
      </button>
    </>
  );

  if (novo) {
    return (
      <Gaveta
        aberta
        titulo="Novo cliente"
        descricao="Para quem compra no balcão ou por telefone. Quem escreve no WhatsApp entra sozinho."
        onFechar={onFechar}
        rodape={botoesDoFormulario("Cadastrar", onFechar)}
      >
        <FormularioDados cliente={null} etiquetasDaLoja={etiquetasDaLoja} onSalvo={onFechar} />
      </Gaveta>
    );
  }

  const rodapeDados = (
    <>
      {confirmar ? (
        <span className="mr-auto flex items-center gap-2">
          <span className="text-[12.5px] text-fg-muted">Remover do cadastro?</span>
          <button
            type="button"
            onClick={() => {
              removerCliente(cliente.id);
              onFechar();
            }}
            className="btn-perigo !px-3 !py-1.5 !text-[12.5px]"
          >
            Remover
          </button>
          <button
            type="button"
            onClick={() => setConfirmar(false)}
            className="rounded-lg px-2 py-1.5 text-[12.5px] text-fg-muted hover:text-fg"
          >
            Não
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmar(true)}
          title="As conversas e os pedidos continuam no histórico"
          className="mr-auto inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12.5px] text-fg-faint transition-colors hover:bg-nivel-3 hover:text-negative"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
          Remover
        </button>
      )}
      {botoesDoFormulario("Salvar alterações", () => setAba("resumo"))}
    </>
  );

  const situacao = indice?.situacao ?? "sem_contato";

  return (
    <Gaveta
      aberta
      titulo={cliente.nome}
      onFechar={onFechar}
      largura="sm:max-w-[580px]"
      rodape={aba === "dados" ? rodapeDados : undefined}
    >
      <div className="-mt-1 flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-nivel-4 text-[14px] font-semibold text-fg-muted">
          {iniciais(cliente.nome)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="tnum text-[13px] text-fg">{cliente.telefone}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className={cn("estado !text-[12px]", PONTO_SITUACAO[situacao])}>{SITUACAO_LABEL[situacao]}</span>
            {cliente.primeiraMensagemEm > 0 && (
              <span className="flex items-center gap-1 text-[12px] text-fg-faint">
                <MessageCircle className="h-3 w-3" strokeWidth={2} />
                WhatsApp desde {data(cliente.primeiraMensagemEm)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 flex border-b border-hairline" role="tablist">
        {(
          [
            ["resumo", "Resumo"],
            ["dados", "Dados"],
            ["historico", "Histórico"],
          ] as const
        ).map(([id, rotulo]) => (
          <button
            key={id}
            role="tab"
            aria-selected={aba === id}
            onClick={() => setAba(id)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-[13px] font-medium transition-colors",
              aba === id ? "border-fg text-fg" : "border-transparent text-fg-faint hover:text-fg",
            )}
          >
            {rotulo}
          </button>
        ))}
      </div>

      <div className="pt-5">
        {aba === "resumo" && (
          <Resumo cliente={cliente} indice={indice} onEditar={() => setAba("dados")} onHistorico={() => setAba("historico")} />
        )}
        {aba === "dados" && (
          <FormularioDados cliente={cliente} etiquetasDaLoja={etiquetasDaLoja} onSalvo={() => setAba("resumo")} />
        )}
        {aba === "historico" && <Historico cliente={cliente} indice={indice} lojaId={lojaId} />}
      </div>
    </Gaveta>
  );
}

/* ------------------------------------------------------------------
   Resumo
   ------------------------------------------------------------------ */

function Resumo({
  cliente,
  indice,
  onEditar,
  onHistorico,
}: {
  cliente: Cliente;
  indice: IndiceCliente | undefined;
  onEditar: () => void;
  onHistorico: () => void;
}) {
  const router = useRouter();
  const { usuario } = useSessao();
  const emAndamento = indice?.conversas.some((c) => c.status !== "resolvida");
  const podeWhatsapp = cliente.primeiraMensagemEm > 0;
  const { quantidade, total, ultimaEm } = resumoDeCompras(cliente, indice?.pedidos);

  function conversar() {
    const conversa = abrirConversaComCliente(cliente, usuario?.nome ?? "");
    router.push(`/conversas?c=${conversa.id}`);
  }

  const dados: [string, string][] = [
    ["Pedidos", String(quantidade)],
    ["Total gasto", formatBRLCents(total)],
    ["Ticket médio", quantidade ? formatBRLCents(total / quantidade) : "—"],
    ["Última compra", data(ultimaEm)],
  ];

  const contato: [string, string][] = [
    ["Outro telefone", cliente.telefone2],
    ["E-mail", cliente.email],
    ["Aniversário", cliente.nascimento ? aniversario(cliente.nascimento) : ""],
    ["Endereço", [cliente.endereco, cliente.bairro].filter(Boolean).join(" - ")],
    ["Campanhas", cliente.consentimento ? "Autorizou receber" : "Não autorizou"],
    ["Cliente desde", data(cliente.criadoEm)],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button onClick={conversar} className="btn-primary">
          <MessageSquarePlus className="h-4 w-4" strokeWidth={2} />
          {emAndamento ? "Abrir conversa em andamento" : "Nova conversa"}
        </button>
        <button onClick={onEditar} className="btn-ghost">
          Editar dados
        </button>
      </div>
      <p className="-mt-4 text-[12px] text-fg-faint">
        {podeWhatsapp
          ? "A conversa vai pelo WhatsApp: esta pessoa já escreveu para a loja."
          : "A conversa fica registrada aqui: esta pessoa nunca escreveu pelo WhatsApp."}
      </p>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        {dados.map(([rotulo, valor]) => (
          <div key={rotulo}>
            <dt className="text-[12px] text-fg-faint">{rotulo}</dt>
            <dd className="tnum mt-1 text-[17px] font-semibold tracking-[-0.02em] text-fg">{valor}</dd>
          </div>
        ))}
      </dl>

      <section>
        <h3 className="mb-2 text-[12px] font-medium text-fg-muted">Contato e cadastro</h3>
        <dl className="divide-y divide-hairline rounded-xl border border-hairline">
          {contato.map(([rotulo, valor]) => (
            <div key={rotulo} className="flex items-baseline justify-between gap-4 px-4 py-2.5 text-[13px]">
              <dt className="shrink-0 text-fg-faint">{rotulo}</dt>
              <dd className={cn("min-w-0 text-right", valor ? "text-fg" : "text-fg-ghost")}>{valor || "não informado"}</dd>
            </div>
          ))}
        </dl>
      </section>

      {(cliente.etiquetas.length > 0 || cliente.observacao) && (
        <section className="space-y-3">
          {cliente.etiquetas.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {cliente.etiquetas.map((e) => (
                <span key={e} className="chip">
                  {e}
                </span>
              ))}
            </div>
          )}
          {cliente.observacao && (
            <p className="rounded-xl bg-nivel-2 px-4 py-3 text-[13px] leading-relaxed text-fg-muted">
              {cliente.observacao}
            </p>
          )}
        </section>
      )}

      {indice && (indice.pedidos.length > 0 || indice.conversas.length > 0) && (
        <button
          onClick={onHistorico}
          className="text-[12.5px] font-medium text-fg-muted underline-offset-2 hover:text-fg hover:underline"
        >
          Ver o histórico completo ({indice.pedidos.length} pedidos, {indice.conversas.length} conversas)
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------
   Dados (cadastro e edição)
   ------------------------------------------------------------------ */

function FormularioDados({
  cliente,
  etiquetasDaLoja,
  onSalvo,
}: {
  cliente: Cliente | null;
  etiquetasDaLoja: string[];
  onSalvo: () => void;
}) {
  const [form, setForm] = useState(
    cliente
      ? {
          nome: cliente.nome,
          telefone: cliente.telefone,
          telefone2: cliente.telefone2,
          email: cliente.email,
          nascimento: cliente.nascimento,
          endereco: cliente.endereco,
          bairro: cliente.bairro,
          observacao: cliente.observacao,
          consentimento: cliente.consentimento,
        }
      : FORM_VAZIO,
  );
  const [etiquetas, setEtiquetas] = useState<string[]>(cliente?.etiquetas ?? []);
  const [novaEtiqueta, setNovaEtiqueta] = useState("");

  // Quem já escreveu pelo WhatsApp tem o número confirmado pelo próprio
  // WhatsApp. O banco não deixa trocar (é com ele que o bot responde), e a
  // tela diz isso em vez de aceitar e desfazer calada.
  const telefoneTravado = Boolean(cliente && cliente.primeiraMensagemEm > 0);
  const podeSalvar = form.nome.trim() && form.telefone.replace(/\D/g, "").length >= 10;
  const sugestoes = [...new Set([...ETIQUETAS_SUGERIDAS, ...etiquetasDaLoja])].filter((e) => !etiquetas.includes(e));

  function adicionarEtiqueta(nome: string) {
    const limpa = nome.trim().slice(0, 24);
    if (!limpa || etiquetas.includes(limpa)) return;
    setEtiquetas((atual) => [...atual, limpa]);
    setNovaEtiqueta("");
  }

  function salvar(e?: React.FormEvent) {
    e?.preventDefault();
    if (!podeSalvar) return;
    const dados = {
      nome: form.nome.trim(),
      telefone2: form.telefone2.trim(),
      email: form.email.trim(),
      nascimento: form.nascimento,
      endereco: form.endereco.trim(),
      bairro: form.bairro.trim(),
      observacao: form.observacao.trim(),
      consentimento: form.consentimento,
      etiquetas,
    };
    if (cliente) {
      void atualizarCliente(cliente.id, telefoneTravado ? dados : { ...dados, telefone: form.telefone.trim() });
    } else {
      criarCliente({ ...dados, telefone: form.telefone.trim(), origem: "manual" });
    }
    onSalvo();
  }

  return (
    <form id={FORM_ID} onSubmit={salvar} className="space-y-5">
      <SecaoGaveta titulo="Identificação">
        <Campo label="Nome completo">
          <Entrada
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            placeholder="Ex: Ana Paula Ribeiro"
            autoFocus={!cliente}
            required
          />
        </Campo>
        <Campo label="Aniversário" hint="Opcional. Serve para lembrar e para campanha de aniversário.">
          <Entrada
            type="date"
            value={form.nascimento}
            onChange={(e) => setForm({ ...form, nascimento: e.target.value })}
          />
        </Campo>
      </SecaoGaveta>

      <SecaoGaveta titulo="Contato">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo
            label="WhatsApp"
            hint={telefoneTravado ? "Confirmado pelo WhatsApp, não muda." : "Com DDD. É o que junta conversas e pedidos."}
          >
            <div className="relative">
              <Entrada
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                placeholder="27 99999-0000"
                disabled={telefoneTravado}
                className={telefoneTravado ? "pr-9 opacity-70" : ""}
                required
              />
              {telefoneTravado && (
                <Lock className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-ghost" strokeWidth={2} />
              )}
            </div>
          </Campo>
          <Campo label="Outro telefone" hint="Recado ou familiar. Opcional.">
            <Entrada
              value={form.telefone2}
              onChange={(e) => setForm({ ...form, telefone2: e.target.value })}
              placeholder="Opcional"
            />
          </Campo>
        </div>
        <Campo label="E-mail">
          <Entrada
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="Opcional"
          />
        </Campo>
      </SecaoGaveta>

      <SecaoGaveta titulo="Entrega">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_180px]">
          <Campo label="Endereço">
            <Entrada
              value={form.endereco}
              onChange={(e) => setForm({ ...form, endereco: e.target.value })}
              placeholder="Rua, número, complemento"
            />
          </Campo>
          <Campo label="Bairro">
            <Entrada
              value={form.bairro}
              onChange={(e) => setForm({ ...form, bairro: e.target.value })}
              placeholder="Opcional"
            />
          </Campo>
        </div>
      </SecaoGaveta>

      <SecaoGaveta titulo="Para a equipe">
        <div>
          <span className="mb-1.5 block text-[11.5px] font-medium text-fg-muted">Etiquetas</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {etiquetas.map((e) => (
              <span key={e} className="chip">
                {e}
                <button
                  type="button"
                  onClick={() => setEtiquetas((atual) => atual.filter((x) => x !== e))}
                  aria-label={`Tirar a etiqueta ${e}`}
                  className="-mr-1 rounded-full p-0.5 hover:bg-nivel-4"
                >
                  <X className="h-3 w-3" strokeWidth={2.2} />
                </button>
              </span>
            ))}
            <input
              value={novaEtiqueta}
              onChange={(ev) => setNovaEtiqueta(ev.target.value)}
              onKeyDown={(ev) => {
                if (ev.key === "Enter") {
                  ev.preventDefault();
                  adicionarEtiqueta(novaEtiqueta);
                }
              }}
              placeholder="Nova etiqueta + Enter"
              aria-label="Nova etiqueta"
              maxLength={24}
              className="field !w-[170px] !px-3 !py-1 !text-[12px]"
            />
          </div>
          {sugestoes.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {sugestoes.slice(0, 8).map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => adicionarEtiqueta(e)}
                  className="flex items-center gap-1 rounded-full border border-dashed border-hairline px-2.5 py-1 text-[11.5px] text-fg-faint transition-colors hover:border-hairline-strong hover:text-fg"
                >
                  <Plus className="h-3 w-3" strokeWidth={2.2} />
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>
        <Campo label="Observação">
          <AreaTexto
            rows={3}
            value={form.observacao}
            onChange={(e) => setForm({ ...form, observacao: e.target.value })}
            placeholder="Algo que a equipe precise lembrar (prefere retirar à noite, paga sempre em Pix...)"
          />
        </Campo>
        <Interruptor
          ligado={form.consentimento}
          onAlternar={(v) => setForm({ ...form, consentimento: v })}
          rotulo="Autoriza receber campanhas"
          descricao="Marque só se a pessoa disse que aceita. É exigência da LGPD: sem isto, ela não entra em nenhuma campanha."
        />
      </SecaoGaveta>

    </form>
  );
}

/* ------------------------------------------------------------------
   Histórico
   ------------------------------------------------------------------ */

/**
 * Tudo o que já aconteceu com a pessoa, do mais novo ao mais antigo.
 *
 * A tela carrega só o recente (conversas de 90 dias, pedidos de 60). O
 * histórico antigo vem do servidor quando a aba abre e se junta ao que já
 * está na tela.
 */
function Historico({
  cliente,
  indice,
  lojaId,
}: {
  cliente: Cliente;
  indice: IndiceCliente | undefined;
  lojaId: string;
}) {
  const [antigos, setAntigos] = useState<{ conversas: Conversa[]; pedidos: Pedido[] } | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);
  const [tipo, setTipo] = useState<"tudo" | "pedido" | "conversa">("tudo");

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

  const visiveis = linha.filter((i) => tipo === "tudo" || i.tipo === tipo);
  const nPedidos = linha.filter((i) => i.tipo === "pedido").length;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-1">
        {(
          [
            ["tudo", `Tudo ${linha.length}`],
            ["pedido", `Pedidos ${nPedidos}`],
            ["conversa", `Conversas ${linha.length - nPedidos}`],
          ] as const
        ).map(([id, rotulo]) => (
          <button
            key={id}
            onClick={() => setTipo(id)}
            aria-pressed={tipo === id}
            className={cn(
              "rounded-lg px-2.5 py-1 text-[12.5px] font-medium transition-colors",
              tipo === id ? "bg-nivel-4 text-fg" : "text-fg-muted hover:bg-nivel-2 hover:text-fg",
            )}
          >
            {rotulo}
          </button>
        ))}
        {!antigos && <span className="ml-auto text-[11.5px] text-fg-ghost">buscando o histórico antigo...</span>}
      </div>

      {visiveis.length === 0 ? (
        <p className="rounded-xl bg-nivel-2 px-4 py-6 text-center text-[12.5px] text-fg-faint">
          Nada registrado ainda.
        </p>
      ) : (
        <ul className="divide-y divide-hairline rounded-xl border border-hairline">
          {visiveis.map((item) =>
            item.tipo === "pedido" ? (
              <li key={`p-${item.pedido.id}`} className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <ShoppingBag className="h-4 w-4 shrink-0 text-fg-faint" strokeWidth={1.9} />
                  <p className="text-[13px] font-medium text-fg">Pedido #{item.pedido.numero}</p>
                  <span className="text-[12px] text-fg-ghost">{dataHora(item.pedido.criadoEm)}</span>
                  <span className="tnum ml-auto text-[13px] text-fg">{formatBRLCents(item.pedido.total)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-3 pl-[26px]">
                  <p className="line-clamp-1 text-[12px] text-fg-faint">
                    {item.pedido.itens.map((i) => `${i.quantidade}x ${i.nome}`).join(", ")}
                  </p>
                  <ChipStatus status={item.pedido.status} className="shrink-0 !text-[11.5px]" />
                </div>
              </li>
            ) : (
              <li key={`c-${item.conversa.id}`}>
                <button
                  onClick={() => setAberta(aberta === item.conversa.id ? null : item.conversa.id)}
                  aria-expanded={aberta === item.conversa.id}
                  className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-nivel-2"
                >
                  <MessageCircle className="h-4 w-4 shrink-0 text-fg-faint" strokeWidth={1.9} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-fg">
                      Conversa {item.conversa.canal === "whatsapp" ? "no WhatsApp" : "registrada"}
                    </span>
                    <span className="block text-[12px] text-fg-ghost">
                      {dataHora(item.conversa.criadaEm)} · {item.conversa.mensagens.length} mensagens ·{" "}
                      {item.conversa.status === "resolvida" ? "resolvida" : "em andamento"}
                    </span>
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-fg-ghost transition-transform",
                      aberta === item.conversa.id && "rotate-180",
                    )}
                    strokeWidth={2}
                  />
                </button>
                {aberta === item.conversa.id && (
                  <div className="space-y-3 border-t border-hairline bg-nivel-1 p-4">
                    {item.conversa.mensagens.map((m) => (
                      <Bolha key={m.id} mensagem={m} />
                    ))}
                  </div>
                )}
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
