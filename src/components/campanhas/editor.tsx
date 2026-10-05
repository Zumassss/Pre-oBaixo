"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bold,
  CalendarClock,
  Check,
  ImagePlus,
  Italic,
  Loader2,
  Lock,
  MessageSquareText,
  RefreshCw,
  Send,
  Sparkles,
  Strikethrough,
  Trash2,
  TriangleAlert,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { Secao, Segmentado } from "@/components/configuracoes/controles";
import { SeletorDataHora, agendamentoNoPassado, deIso } from "@/components/ui/calendario";
import { PreviaWhatsapp, TextoWhatsapp } from "@/components/campanhas/previa-whatsapp";
import {
  atualizarCampanha,
  criarCampanha,
  enviarTesteDeCampanha,
  useBanco,
  useWhatsappNoAr,
} from "@/lib/db/use-db";
import {
  SITUACAO_LABEL,
  type Campanha,
  type Midia,
  type PublicoCampanha,
  type SituacaoCliente,
} from "@/lib/db/types";
import { ETIQUETAS_SUGERIDAS, indexarClientes } from "@/lib/clientes";
import {
  LIMITE_TEXTO,
  TEXTO_LONGO,
  alcanceDaCampanha,
  palavrasDeRemedio,
  remediosNoTexto,
  textoParaEnvio,
} from "@/lib/campanhas";
import { enviarArquivo, useMidiaUrl } from "@/lib/midia";
import { cn, formatBRLCents } from "@/lib/utils";

type Rascunho = {
  nome: string;
  mensagem: string;
  imagem: Midia | null;
  publico: PublicoCampanha;
  agendadaPara: string;
};

type Sugestao = { titulo: string; texto: string };

const VAZIO: Rascunho = {
  nome: "",
  mensagem: "",
  imagem: null,
  publico: { modo: "todos", etiquetas: [], situacoes: [] },
  agendadaPara: "",
};

const EMOJIS = ["😊", "🎉", "☀️", "🛵", "🎁", "💚"];

const IDEIAS = [
  "Protetor solar com preço especial para o verão",
  "Dia das Mães: kits de beleza e perfumaria",
  "Lembrar que a loja entrega em casa e atende pelo WhatsApp",
  "Linha infantil: fraldas e lenços",
];

const TONS = [
  { valor: "amigavel", titulo: "Amigável" },
  { valor: "direto", titulo: "Direto" },
  { valor: "animado", titulo: "Animado" },
] as const;

const SITUACOES_PUBLICO: SituacaoCliente[] = ["comprou", "nao_fechou", "orcou", "so_conversou", "cancelou"];

function deCampanha(c: Campanha | null): Rascunho {
  if (!c) return VAZIO;
  return { nome: c.nome, mensagem: c.mensagem, imagem: c.imagem, publico: c.publico, agendadaPara: c.agendadaPara };
}

function horaAgora() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Montar uma campanha: texto (escrito à mão ou sugerido pela IA), imagem,
 * público e dia. Do lado, o celular do cliente mostra como ela chega.
 *
 * O teste vai pelo WhatsApp da loja para alguém que já escreveu para ela.
 * O disparo para a lista fica travado até o número oficial: pelo número de
 * teste, mensagem em massa é o caminho mais curto para o chip ser banido.
 */
export function EditorCampanha({
  campanha,
  onSalva,
}: {
  campanha: Campanha | null;
  onSalva: (id: string) => void;
}) {
  const { banco } = useBanco();
  const whatsappNoAr = useWhatsappNoAr(banco.whatsapp);
  const [r, setR] = useState<Rascunho>(() => deCampanha(campanha));
  const [salvo, setSalvo] = useState<Rascunho>(() => deCampanha(campanha));
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const texto = useRef<HTMLTextAreaElement>(null);

  const sujo = JSON.stringify(r) !== JSON.stringify(salvo);
  const mudar = (parcial: Partial<Rascunho>) => {
    setR((atual) => ({ ...atual, ...parcial }));
    setErro("");
  };

  // Aviso ao fechar a aba com alteração não salva.
  useEffect(() => {
    if (!sujo) return;
    const antes = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", antes);
    return () => window.removeEventListener("beforeunload", antes);
  }, [sujo]);

  /* ---------------- Público ---------------- */

  const indice = useMemo(
    () => indexarClientes(banco.clientes, banco.conversas, banco.pedidos),
    [banco.clientes, banco.conversas, banco.pedidos],
  );
  const alcance = useMemo(() => alcanceDaCampanha(r.publico, banco.clientes, indice), [r.publico, banco.clientes, indice]);
  const etiquetas = useMemo(() => {
    const contagem = new Map<string, number>();
    for (const c of banco.clientes) for (const e of c.etiquetas) contagem.set(e, (contagem.get(e) ?? 0) + 1);
    for (const e of ETIQUETAS_SUGERIDAS) if (!contagem.has(e)) contagem.set(e, 0);
    return [...contagem.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [banco.clientes]);
  const porSituacao = useMemo(() => {
    const contagem = new Map<SituacaoCliente, number>();
    for (const i of indice.values()) contagem.set(i.situacao, (contagem.get(i.situacao) ?? 0) + 1);
    return contagem;
  }, [indice]);

  function alternarNaLista<T>(lista: T[], item: T) {
    return lista.includes(item) ? lista.filter((x) => x !== item) : [...lista, item];
  }

  /* ---------------- Texto ---------------- */

  const remedios = useMemo(() => palavrasDeRemedio(banco.produtos), [banco.produtos]);
  const citados = remediosNoTexto(r.mensagem, remedios);

  function envolver(marca: string) {
    const el = texto.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b, value: v } = el;
    const miolo = v.slice(a, b) || "texto";
    mudar({ mensagem: v.slice(0, a) + marca + miolo + marca + v.slice(b) });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + marca.length, a + marca.length + miolo.length);
    });
  }

  function inserir(trecho: string) {
    const el = texto.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b, value: v } = el;
    mudar({ mensagem: v.slice(0, a) + trecho + v.slice(b) });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + trecho.length, a + trecho.length);
    });
  }

  /* ---------------- Imagem ---------------- */

  const arquivo = useRef<HTMLInputElement>(null);
  const [enviandoImagem, setEnviandoImagem] = useState<string | null>(null);
  const [erroImagem, setErroImagem] = useState("");

  async function escolherImagem(f: File | undefined) {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setErroImagem("Escolha uma imagem (JPG, PNG ou WebP).");
      return;
    }
    setErroImagem("");
    const local = URL.createObjectURL(f);
    setEnviandoImagem(local);
    const res = await enviarArquivo(banco.loja.id, f, f.name);
    setEnviandoImagem(null);
    URL.revokeObjectURL(local);
    if (!res.ok) {
      setErroImagem(res.erro);
      return;
    }
    mudar({ imagem: res.midia });
  }

  /* ---------------- IA ---------------- */

  const [iaAberta, setIaAberta] = useState(!campanha);
  const [ideia, setIdeia] = useState("");
  const [tom, setTom] = useState<(typeof TONS)[number]["valor"]>("amigavel");
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [pensando, setPensando] = useState(false);
  const [erroIa, setErroIa] = useState("");

  async function sugerir() {
    if (ideia.trim().length < 4) {
      setErroIa("Conte em poucas palavras o que a campanha divulga.");
      return;
    }
    setPensando(true);
    setErroIa("");
    try {
      const loja = banco.loja;
      const resposta = await fetch("/api/campanhas/sugerir", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contexto: ideia,
          tom,
          loja: {
            nome: loja.nome,
            bairro: loja.bairro,
            horarios: loja.horarios,
            entrega: !loja.temMotoboy
              ? "só retirada no balcão"
              : loja.taxaEntrega > 0
                ? `entrega em casa por ${formatBRLCents(loja.taxaEntrega)}`
                : "entrega grátis",
          },
          produtos: banco.produtos.map((p) => ({
            nome: p.nome,
            categoria: p.categoria,
            exigeReceita: p.exigeReceita,
            preco: p.preco,
            promocao: p.promocao,
          })),
        }),
      });
      const dados = (await resposta.json().catch(() => ({}))) as { sugestoes?: Sugestao[]; error?: string };
      if (!resposta.ok || !dados.sugestoes) {
        setErroIa(dados.error ?? "A IA não respondeu agora. Tente de novo.");
        return;
      }
      setSugestoes(dados.sugestoes);
    } catch {
      setErroIa("Sem conexão com o servidor. Tente de novo.");
    } finally {
      setPensando(false);
    }
  }

  /* ---------------- Salvar ---------------- */

  const noPassado = agendamentoNoPassado(r.agendadaPara);

  function problema(): string {
    if (!r.mensagem.trim() && !r.imagem) return "Escreva a mensagem antes de salvar.";
    if (r.mensagem.length > LIMITE_TEXTO) return `O WhatsApp aceita até ${LIMITE_TEXTO} caracteres.`;
    if (citados.length) return "Tire o nome do remédio da mensagem: campanha não pode anunciar medicamento.";
    if (noPassado) return "Esse horário já passou. Escolha outro ou tire o agendamento.";
    if (r.publico.modo === "etiquetas" && r.publico.etiquetas.length === 0) return "Escolha ao menos uma etiqueta.";
    if (r.publico.modo === "situacao" && r.publico.situacoes.length === 0) return "Escolha ao menos uma situação.";
    return "";
  }

  async function salvar(): Promise<string | null> {
    const p = problema();
    if (p) {
      setErro(p);
      return null;
    }
    setSalvando(true);
    const nome = r.nome.trim() || r.mensagem.replace(/[{}*_~]|nome/g, "").trim().split(/\s+/).slice(0, 5).join(" ") || "Campanha";
    const dados = { ...r, nome, mensagem: r.mensagem.trim(), status: r.agendadaPara ? ("agendada" as const) : ("rascunho" as const) };
    let id = campanha?.id ?? null;
    if (id) {
      const res = await atualizarCampanha(id, dados);
      if (res !== "ok") {
        setSalvando(false);
        setErro("Não foi possível salvar agora. Confira a conexão e tente de novo.");
        return null;
      }
    } else {
      id = criarCampanha(dados).id;
    }
    const final = { ...r, nome, mensagem: dados.mensagem };
    setR(final);
    setSalvo(final);
    setSalvando(false);
    onSalva(id);
    return id;
  }

  /* ---------------- Teste ---------------- */

  const quemJaEscreveu = useMemo(
    () => banco.clientes.filter((c) => c.primeiraMensagemEm > 0).sort((a, b) => b.ultimaMensagemEm - a.ultimaMensagemEm),
    [banco.clientes],
  );
  const [destino, setDestino] = useState("");
  const destinoEfetivo = destino || quemJaEscreveu[0]?.telefone || "";
  const ultimoTeste = campanha
    ? banco.envios.filter((e) => e.campanhaId === campanha.id).sort((a, b) => b.criadoEm - a.criadoEm)[0]
    : undefined;

  async function testar() {
    if (!destinoEfetivo) return;
    const id = sujo || !campanha ? await salvar() : campanha.id;
    if (!id) return;
    const atual = banco.campanhas.find((c) => c.id === id) ?? { ...(campanha as Campanha), id, imagem: r.imagem };
    enviarTesteDeCampanha({ ...atual, imagem: r.imagem }, destinoEfetivo, textoParaEnvio(r.mensagem));
  }

  /* ---------------- Prévia ---------------- */

  const exemplo = alcance.clientes[0]?.nome ?? quemJaEscreveu[0]?.nome ?? "Maria";
  const primeiroNome = exemplo.trim().split(/\s+/)[0];
  const horaPrevia = r.agendadaPara ? r.agendadaPara.split("T")[1] : horaAgora();
  const legivelAgendamento = r.agendadaPara
    ? `${deIso(r.agendadaPara.split("T")[0]).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })} às ${r.agendadaPara.split("T")[1]}`
    : "";

  return (
    <div className="mx-auto max-w-[1400px]">
      {/* Cabeçalho */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <Link href="/campanhas" className="mb-2 inline-flex items-center gap-1.5 text-[12.5px] text-fg-muted transition-colors hover:text-fg">
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
            Campanhas
          </Link>
          <h1 className="truncate text-[24px] font-semibold tracking-[-0.025em] text-fg">
            {campanha ? r.nome || campanha.nome : "Nova campanha"}
          </h1>
          <p className="mt-1 text-[13px] text-fg-muted">
            {r.agendadaPara ? `Agendada para ${legivelAgendamento}.` : "Rascunho, sem dia marcado."}{" "}
            Vai para {alcance.clientes.length} {alcance.clientes.length === 1 ? "cliente" : "clientes"}.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-fg-faint" aria-live="polite">
            {salvando ? "Salvando…" : sujo ? "Alterações não salvas" : campanha ? "Tudo salvo" : ""}
          </span>
          <button onClick={() => void salvar()} disabled={salvando || (!sujo && Boolean(campanha))} className="btn-primary disabled:opacity-50">
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" strokeWidth={2.4} />}
            {r.agendadaPara ? "Salvar e agendar" : "Salvar rascunho"}
          </button>
        </div>
      </div>

      {erro && (
        <div role="alert" className="tile mb-4 flex items-start gap-2.5 border-negative/40 p-3.5">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-negative" strokeWidth={2} />
          <p className="text-[12.5px] leading-relaxed text-fg">{erro}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-5">
          {/* ---------- Mensagem ---------- */}
          <Secao id="mensagem" icone={MessageSquareText} titulo="Mensagem" descricao="O que o cliente lê. {nome} vira o primeiro nome de cada um.">
            <label className="mb-1.5 block text-[12px] font-medium text-fg-muted" htmlFor="nome-campanha">
              Nome da campanha
            </label>
            <input
              id="nome-campanha"
              value={r.nome}
              onChange={(e) => mudar({ nome: e.target.value })}
              placeholder="Ex: Protetor solar de outubro (só a equipe vê)"
              className="field mb-4"
              maxLength={80}
            />

            {/* IA */}
            <div className="mb-4 overflow-hidden rounded-2xl border border-brand-500/25 bg-brand-500/[0.05]">
              <button
                type="button"
                onClick={() => setIaAberta((v) => !v)}
                aria-expanded={iaAberta}
                className="flex w-full items-center gap-2.5 px-4 py-3 text-left"
              >
                <Sparkles className="h-4 w-4 text-brand-400" strokeWidth={2} />
                <span className="flex-1 text-[13px] font-semibold text-fg">Escrever com a IA</span>
                <span className="text-[11.5px] text-fg-faint">{iaAberta ? "Fechar" : "Abrir"}</span>
              </button>
              {iaAberta && (
                <div className="border-t border-brand-500/15 px-4 pb-4 pt-3" style={{ animation: "fade-in 0.2s ease both" }}>
                  <label htmlFor="ideia" className="mb-1.5 block text-[12px] text-fg-muted">
                    O que você quer divulgar?
                  </label>
                  <textarea
                    id="ideia"
                    value={ideia}
                    onChange={(e) => setIdeia(e.target.value)}
                    rows={2}
                    maxLength={600}
                    placeholder="Ex: protetor solar com preço especial até sábado"
                    className="field !rounded-xl resize-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void sugerir();
                    }}
                  />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {IDEIAS.map((i) => (
                      <button key={i} type="button" onClick={() => setIdeia(i)} className="chip !h-auto max-w-full whitespace-normal py-1 text-left transition-colors hover:border-brand-500/40 hover:text-fg">
                        {i}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div role="radiogroup" aria-label="Tom da mensagem" className="inline-flex gap-1 rounded-xl border border-hairline bg-nivel-1 p-1">
                      {TONS.map((t) => (
                        <button
                          key={t.valor}
                          type="button"
                          role="radio"
                          aria-checked={tom === t.valor}
                          onClick={() => setTom(t.valor)}
                          className={cn(
                            "rounded-lg px-3 py-1 text-[12px] transition-colors",
                            tom === t.valor ? "bg-brand-500/[0.16] font-medium text-fg" : "text-fg-muted hover:text-fg",
                          )}
                        >
                          {t.titulo}
                        </button>
                      ))}
                    </div>
                    <button type="button" onClick={() => void sugerir()} disabled={pensando} className="btn-primary !py-2 disabled:opacity-60">
                      {pensando ? <Loader2 className="h-4 w-4 animate-spin" /> : sugestoes.length ? <RefreshCw className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                      {pensando ? "Escrevendo…" : sugestoes.length ? "Gerar outras" : "Gerar 3 versões"}
                    </button>
                  </div>
                  {erroIa && <p className="mt-2 text-[12px] text-negative">{erroIa}</p>}
                  <p className="mt-2 text-[11px] leading-relaxed text-fg-ghost">
                    A IA usa os produtos do catálogo que podem ser anunciados e nunca cita remédio. Confira o texto antes de usar.
                  </p>

                  {(pensando || sugestoes.length > 0) && (
                    <div className="mt-3 grid grid-cols-1 gap-2.5 xl:grid-cols-3" aria-busy={pensando}>
                      {pensando
                        ? [0, 1, 2].map((i) => <div key={i} className="h-[180px] animate-pulse rounded-xl bg-nivel-2" />)
                        : sugestoes.map((s, i) => (
                            <div
                              key={i}
                              className="flex flex-col rounded-xl border border-hairline bg-nivel-1 p-3"
                              style={{ animation: `rise 0.35s cubic-bezier(0.16,1,0.3,1) ${i * 70}ms both` }}
                            >
                              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-400">{s.titulo}</p>
                              <p className="mb-3 line-clamp-[8] flex-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-fg-muted">
                                <TextoWhatsapp texto={s.texto} />
                              </p>
                              <button
                                type="button"
                                onClick={() => mudar({ mensagem: s.texto })}
                                className={cn(
                                  "btn-ghost !justify-center !py-1.5 !text-[12px]",
                                  r.mensagem === s.texto && "!border-brand-500/50 !text-fg",
                                )}
                              >
                                {r.mensagem === s.texto ? <Check className="h-3.5 w-3.5" /> : null}
                                {r.mensagem === s.texto ? "Em uso" : "Usar este texto"}
                              </button>
                            </div>
                          ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Editor de texto */}
            <div className="overflow-hidden rounded-xl border border-hairline bg-nivel-1 focus-within:border-brand-500/45">
              <div className="flex flex-wrap items-center gap-0.5 border-b border-hairline px-1.5 py-1" role="toolbar" aria-label="Formatação">
                {[
                  { marca: "*", icone: Bold, rotulo: "Negrito" },
                  { marca: "_", icone: Italic, rotulo: "Itálico" },
                  { marca: "~", icone: Strikethrough, rotulo: "Riscado" },
                ].map(({ marca, icone: Icone, rotulo }) => (
                  <button
                    key={marca}
                    type="button"
                    onClick={() => envolver(marca)}
                    aria-label={rotulo}
                    title={rotulo}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-nivel-3 hover:text-fg"
                  >
                    <Icone className="h-3.5 w-3.5" strokeWidth={2.4} />
                  </button>
                ))}
                <span className="mx-1 h-4 w-px bg-hairline-strong" />
                <button
                  type="button"
                  onClick={() => inserir("{nome}")}
                  className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-[12px] text-fg-muted transition-colors hover:bg-nivel-3 hover:text-fg"
                >
                  <UserRound className="h-3.5 w-3.5" strokeWidth={2} />
                  Nome do cliente
                </button>
                <span className="mx-1 h-4 w-px bg-hairline-strong" />
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => inserir(e)}
                    aria-label={`Inserir ${e}`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-[15px] transition-colors hover:bg-nivel-3"
                  >
                    {e}
                  </button>
                ))}
              </div>
              <textarea
                ref={texto}
                value={r.mensagem}
                onChange={(e) => mudar({ mensagem: e.target.value })}
                rows={8}
                maxLength={LIMITE_TEXTO}
                aria-label="Texto da campanha"
                placeholder={"Oi, {nome}! Chegou protetor solar com preço especial esta semana ☀️\n\nResponda QUERO que a gente separa para você."}
                className="block w-full resize-y bg-transparent px-3.5 py-3 text-[13.5px] leading-relaxed text-fg outline-none placeholder:text-fg-ghost"
              />
              <div className="flex items-center justify-between border-t border-hairline px-3.5 py-1.5 text-[11px]">
                <span className="text-fg-ghost">*negrito*  _itálico_  ~riscado~</span>
                <span className={cn("tnum", r.mensagem.length > TEXTO_LONGO ? "text-caution" : "text-fg-ghost")}>
                  {r.mensagem.length > TEXTO_LONGO ? "Longa: pouca gente lê até o fim · " : ""}
                  {r.mensagem.length} caracteres
                </span>
              </div>
            </div>
            {citados.length > 0 && (
              <p role="alert" className="mt-2 flex items-start gap-1.5 text-[12px] leading-relaxed text-negative">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                A mensagem cita {citados.join(", ")}. Campanha não pode anunciar remédio (regra da ANVISA). Tire antes de salvar.
              </p>
            )}

            {/* Imagem */}
            <div className="mt-4">
              <p className="mb-1.5 text-[12px] font-medium text-fg-muted">Imagem (opcional)</p>
              <input
                ref={arquivo}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  void escolherImagem(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              {r.imagem || enviandoImagem ? (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-hairline bg-nivel-1 p-2.5">
                  <MiniaturaImagem midia={r.imagem} local={enviandoImagem} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-fg">{enviandoImagem ? "Enviando…" : r.imagem?.nome || "Imagem"}</p>
                    <p className="text-[11px] text-fg-faint">Vai em cima do texto, numa mensagem só.</p>
                  </div>
                  {!enviandoImagem && (
                    <div className="flex gap-1.5">
                      <button type="button" onClick={() => arquivo.current?.click()} className="btn-ghost !px-3 !py-1.5 !text-[12px]">
                        Trocar
                      </button>
                      <button
                        type="button"
                        onClick={() => mudar({ imagem: null })}
                        aria-label="Tirar a imagem"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-ghost transition-colors hover:bg-nivel-3 hover:text-negative"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => arquivo.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    void escolherImagem(e.dataTransfer.files?.[0]);
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-hairline-strong bg-nivel-1 px-4 py-5 text-[12.5px] text-fg-muted transition-colors hover:border-brand-500/45 hover:text-fg"
                >
                  <ImagePlus className="h-4 w-4" strokeWidth={2} />
                  Escolher imagem ou arrastar para cá
                </button>
              )}
              {erroImagem && <p className="mt-1.5 text-[12px] text-negative">{erroImagem}</p>}
            </div>
          </Secao>

          {/* ---------- Público ---------- */}
          <Secao id="publico" icone={Users} titulo="Para quem" descricao="Só entra quem autorizou receber mensagem da loja (LGPD).">
            <Segmentado
              rotulo="Público"
              valor={r.publico.modo}
              onEscolher={(modo) => mudar({ publico: { ...r.publico, modo } })}
              opcoes={[
                { valor: "todos", titulo: "Todos", descricao: "Quem autorizou contato" },
                { valor: "etiquetas", titulo: "Por etiqueta", descricao: "VIP, uso contínuo…" },
                { valor: "situacao", titulo: "Por situação", descricao: "Comprou, não fechou…" },
              ]}
            />

            {r.publico.modo === "etiquetas" && (
              <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Etiquetas">
                {etiquetas.map(([e, n]) => {
                  const ativa = r.publico.etiquetas.includes(e);
                  return (
                    <button
                      key={e}
                      type="button"
                      aria-pressed={ativa}
                      onClick={() => mudar({ publico: { ...r.publico, etiquetas: alternarNaLista(r.publico.etiquetas, e) } })}
                      className={cn("chip transition-colors", ativa ? "chip-hot" : "hover:text-fg")}
                    >
                      {ativa && <Check className="h-3 w-3" strokeWidth={2.6} />}
                      {e}
                      <span className="tnum opacity-60">{n}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {r.publico.modo === "situacao" && (
              <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Situações">
                {SITUACOES_PUBLICO.map((s) => {
                  const ativa = r.publico.situacoes.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={ativa}
                      onClick={() => mudar({ publico: { ...r.publico, situacoes: alternarNaLista(r.publico.situacoes, s) } })}
                      className={cn("chip transition-colors", ativa ? "chip-hot" : "hover:text-fg")}
                    >
                      {ativa && <Check className="h-3 w-3" strokeWidth={2.6} />}
                      {SITUACAO_LABEL[s]}
                      <span className="tnum opacity-60">{porSituacao.get(s) ?? 0}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-hairline bg-nivel-1 px-4 py-3">
              <p className="flex items-baseline gap-2">
                <span className="tnum text-[26px] font-semibold leading-none tracking-[-0.03em] text-fg">{alcance.clientes.length}</span>
                <span className="text-[12.5px] text-fg-muted">{alcance.clientes.length === 1 ? "cliente recebe" : "clientes recebem"}</span>
              </p>
              <div className="space-y-0.5 text-[11.5px] text-fg-faint">
                <p>{alcance.jaEscreveram} já conversaram com a loja no WhatsApp</p>
                {alcance.semConsentimento > 0 && (
                  <p>
                    {alcance.semConsentimento} {alcance.semConsentimento === 1 ? "ficou" : "ficaram"} de fora por não ter autorizado.{" "}
                    <Link href="/clientes" className="underline decoration-hairline-strong underline-offset-2 hover:text-fg">
                      Ver clientes
                    </Link>
                  </p>
                )}
              </div>
            </div>
          </Secao>

          {/* ---------- Quando ---------- */}
          <Secao id="quando" icone={CalendarClock} titulo="Quando" descricao="Dia e hora em que a campanha deve sair. Nada antes de agora.">
            <div className="max-w-[360px]">
              <SeletorDataHora valor={r.agendadaPara} onMudar={(v) => mudar({ agendadaPara: v })} rotulo="Dia e hora da campanha" />
            </div>
            {noPassado && (
              <p role="alert" className="mt-2 text-[12px] text-negative">
                Esse horário já passou. Escolha outro.
              </p>
            )}
          </Secao>
        </div>

        {/* ---------- Coluna da prévia ---------- */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <PreviaWhatsapp
            loja={banco.loja.nome || "Sua farmácia"}
            texto={r.mensagem.replaceAll("{nome}", primeiroNome)}
            imagem={r.imagem}
            imagemLocal={enviandoImagem}
            hora={horaPrevia}
          />
          <p className="text-center text-[11px] text-fg-ghost">Como {primeiroNome} vai ver no celular</p>

          <div className="panel p-4">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-fg">
              <Send className="h-3.5 w-3.5 text-brand-400" strokeWidth={2.2} />
              Mandar um teste
            </p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-fg-faint">
              Vai pelo WhatsApp da loja para alguém que já escreveu para ela, como um cliente vai receber.
            </p>
            {quemJaEscreveu.length === 0 ? (
              <p className="mt-3 text-[12px] text-fg-muted">
                Ninguém escreveu para a loja ainda. Mande um “oi” do seu celular para o número da loja e ele aparece aqui.
              </p>
            ) : (
              <div className="mt-3 flex gap-2">
                <select
                  value={destinoEfetivo}
                  onChange={(e) => setDestino(e.target.value)}
                  aria-label="Para quem mandar o teste"
                  className="field min-w-0 flex-1 !py-2 !text-[12.5px]"
                >
                  {quemJaEscreveu.slice(0, 50).map((c) => (
                    <option key={c.id} value={c.telefone}>
                      {c.nome} · {c.telefone}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={() => void testar()} disabled={salvando} className="btn-ghost !py-2 !text-[12.5px]">
                  Enviar teste
                </button>
              </div>
            )}
            {!whatsappNoAr && quemJaEscreveu.length > 0 && (
              <p className="mt-2 text-[11.5px] text-caution">O WhatsApp da loja está desligado agora. O teste sai assim que ele voltar.</p>
            )}
            {ultimoTeste && <StatusTeste envio={ultimoTeste} />}
          </div>

          <div className="rounded-2xl border border-dashed border-hairline-strong p-4">
            <button type="button" disabled className="btn-primary w-full !justify-center opacity-45" aria-describedby="porque-travado">
              <Lock className="h-4 w-4" strokeWidth={2.2} />
              Disparar para {alcance.clientes.length} {alcance.clientes.length === 1 ? "cliente" : "clientes"}
            </button>
            <p id="porque-travado" className="mt-2.5 text-[11.5px] leading-relaxed text-fg-faint">
              O disparo para a lista sai pelo número oficial do WhatsApp, com modelo aprovado pela Meta. Pelo número de teste,
              mensagem em massa faz o chip ser banido. A campanha fica salva e pronta para quando o número oficial entrar.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function MiniaturaImagem({ midia, local }: { midia: Midia | null; local: string | null }) {
  return (
    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-nivel-3">
      <ImagemPorCaminho midia={midia} local={local} />
      {local && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <Loader2 className="h-4 w-4 animate-spin text-white" />
        </div>
      )}
    </div>
  );
}


function ImagemPorCaminho({ midia, local }: { midia: Midia | null; local: string | null }) {
  const { url } = useMidiaUrl(local ? undefined : midia?.caminho);
  const fonte = local ?? url;
  if (!fonte) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={fonte} alt="" className="h-full w-full object-cover" />;
}

function StatusTeste({ envio }: { envio: { status: string; motivo: string; criadoEm: number; enviadoEm: number } }) {
  const hora = (em: number) => new Date(em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const mapa: Record<string, { texto: string; classe: string; icone: React.ReactNode }> = {
    pendente: { texto: `Na fila do WhatsApp desde ${hora(envio.criadoEm)}`, classe: "text-fg-muted", icone: <Loader2 className="h-3.5 w-3.5 animate-spin" /> },
    enviado: { texto: `Teste entregue às ${hora(envio.enviadoEm || envio.criadoEm)}`, classe: "text-positive", icone: <Check className="h-3.5 w-3.5" strokeWidth={2.6} /> },
    recusado: { texto: envio.motivo || "O WhatsApp da loja recusou o teste.", classe: "text-caution", icone: <X className="h-3.5 w-3.5" /> },
    falhou: { texto: `Não saiu: ${envio.motivo || "erro no WhatsApp"}`, classe: "text-negative", icone: <X className="h-3.5 w-3.5" /> },
  };
  const s = mapa[envio.status] ?? mapa.pendente;
  return (
    <p role="status" className={cn("mt-3 flex items-start gap-1.5 text-[12px] leading-snug", s.classe)}>
      <span className="mt-px">{s.icone}</span>
      {s.texto}
    </p>
  );
}
