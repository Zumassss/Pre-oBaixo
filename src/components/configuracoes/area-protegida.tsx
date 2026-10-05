"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bike,
  Bot,
  CalendarClock,
  Calculator,
  CreditCard,
  HelpCircle,
  KeyRound,
  Lock,
  LockOpen,
  MapPin,
  MessageSquareQuote,
  Plus,
  Route,
  Save,
  ShieldCheck,
  Store,
  Trash2,
  Undo2,
  Wallet,
} from "lucide-react";
import { Campo, Entrada, AreaTexto } from "@/components/ui/modal";
import {
  ajustesLiberadosAte,
  avisar,
  encerrarAjustes,
  liberarAjustes,
  trocarPin,
} from "@/lib/db/local-db";
import type { ResultadoGravacao } from "@/lib/db/sincronia";
import {
  type AjustesAgente,
  DIAS_SEMANA,
  type Loja,
  type Pagamentos,
} from "@/lib/db/types";
import { salvarAjustesAgente, salvarLoja, salvarPagamentos, useBanco, useSessao } from "@/lib/db/use-db";
import {
  calcularEntrega,
  distanciaKm,
  FATOR_RUA,
  localizarEndereco,
  situacaoDaLoja,
  textoDosHorarios,
} from "@/lib/loja-regras";
import { pixConfigurado } from "@/lib/pix";
import { cn, formatBRLCents } from "@/lib/utils";
import { EntradaReais, Interruptor, Opcao, Secao, Segmentado } from "./controles";

/* ------------------------------------------------------------------
   Tranca
   ------------------------------------------------------------------ */

/**
 * Pede a senha de ajustes. A conferência é no servidor (função
 * `liberar_ajustes`): cinco erros seguidos bloqueiam por 15 minutos, e a área
 * fica aberta por 20 minutos. Sem isso, o banco recusa qualquer gravação de
 * cadastro da loja ou de ajuste do agente, mesmo que alguém burle a tela.
 */
function Tranca({ onAberta, compacta = false }: { onAberta: () => void; compacta?: boolean }) {
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState("");
  const [conferindo, setConferindo] = useState(false);

  async function abrir(e: React.FormEvent) {
    e.preventDefault();
    if (pin.length < 4) {
      setErro("A senha tem pelo menos 4 números.");
      return;
    }
    setConferindo(true);
    const r = await liberarAjustes(pin);
    setConferindo(false);
    if (!r.ok) {
      setErro(r.erro ?? "Senha incorreta.");
      setPin("");
      return;
    }
    setErro("");
    onAberta();
  }

  return (
    <form
      onSubmit={abrir}
      className={cn("mx-auto flex w-full max-w-[380px] flex-col items-center text-center", !compacta && "py-10")}
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/12 text-brand-400 ring-1 ring-inset ring-brand-500/25">
        <Lock className="h-6 w-6" strokeWidth={2} />
      </span>
      <h2 className="mt-4 text-[17px] font-semibold tracking-[-0.01em] text-fg">Área protegida</h2>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-fg-faint">
        Dados da loja e tudo o que o agente fala para o cliente: horário, taxa de entrega, formas de
        pagamento. Mudar isto muda o que o cliente ouve, por isso pede senha.
      </p>
      <label htmlFor="pin-ajustes" className="sr-only">
        Senha de ajustes
      </label>
      <input
        id="pin-ajustes"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={8}
        value={pin}
        onChange={(e) => {
          setPin(e.target.value.replace(/\D/g, ""));
          setErro("");
        }}
        aria-invalid={Boolean(erro)}
        aria-describedby={erro ? "erro-pin" : undefined}
        placeholder="••••"
        autoFocus
        className="field tnum mt-5 !rounded-2xl !py-3 text-center font-mono !text-[22px] tracking-[0.5em]"
      />
      {erro && (
        <p id="erro-pin" role="alert" className="mt-2 text-[12px] font-medium text-brand-400">
          {erro}
        </p>
      )}
      <button type="submit" disabled={conferindo} className="btn-primary mt-4 w-full">
        <LockOpen className="h-4 w-4" strokeWidth={2} />
        {conferindo ? "Conferindo..." : "Abrir ajustes"}
      </button>
      <p className="mt-3 text-[11px] text-fg-ghost">A área fecha sozinha depois de 20 minutos.</p>
    </form>
  );
}

/* ------------------------------------------------------------------
   A área
   ------------------------------------------------------------------ */

type Rascunho = { loja: Loja; agente: AjustesAgente; pagamentos: Pagamentos };

const SECOES = [
  { id: "loja", titulo: "Loja", icone: Store },
  { id: "horarios", titulo: "Horários", icone: CalendarClock },
  { id: "entrega", titulo: "Entrega", icone: Bike },
  { id: "pagamento", titulo: "Pagamento", icone: Wallet },
  { id: "servicos", titulo: "Serviços e regras", icone: ShieldCheck },
  { id: "atendente", titulo: "Atendente virtual", icone: Bot },
  { id: "perguntas", titulo: "Perguntas frequentes", icone: HelpCircle },
  { id: "senha", titulo: "Senha da área", icone: KeyRound },
];

export function AreaProtegida() {
  const { banco, carregado } = useBanco();
  const { usuario } = useSessao();
  const [, forcar] = useState(0);
  const [agora, setAgora] = useState(0);

  // A área fecha sozinha: o relógio confere a validade a cada 15 s.
  useEffect(() => {
    const tick = () => setAgora(Date.now());
    const primeira = setTimeout(tick, 0);
    const id = setInterval(tick, 15000);
    return () => {
      clearTimeout(primeira);
      clearInterval(id);
    };
  }, []);

  const ate = ajustesLiberadosAte();
  const aberta = usuario?.papel === "admin" || (agora > 0 && ate > agora);

  if (!carregado) return null;
  if (!aberta) {
    return (
      <div className="panel">
        <Tranca onAberta={() => forcar((n) => n + 1)} />
      </div>
    );
  }

  return (
    <Editor
      key={banco.loja.id}
      inicial={{ loja: banco.loja, agente: banco.agente, pagamentos: banco.pagamentos }}
      ate={usuario?.papel === "admin" ? 0 : ate}
      onFechar={() => {
        void encerrarAjustes().then(() => forcar((n) => n + 1));
      }}
    />
  );
}

function Editor({
  inicial,
  ate,
  onFechar,
}: {
  inicial: Rascunho;
  ate: number;
  onFechar: () => void;
}) {
  const [rascunho, setRascunho] = useState<Rascunho>(inicial);
  const [salvando, setSalvando] = useState(false);
  const [pedirSenha, setPedirSenha] = useState(false);
  const sujo = JSON.stringify(rascunho) !== JSON.stringify(inicial);

  const loja = (dados: Partial<Loja>) => setRascunho((r) => ({ ...r, loja: { ...r.loja, ...dados } }));
  const agente = (dados: Partial<AjustesAgente>) => setRascunho((r) => ({ ...r, agente: { ...r.agente, ...dados } }));
  const entrega = (dados: Partial<AjustesAgente["entrega"]>) =>
    setRascunho((r) => ({ ...r, agente: { ...r.agente, entrega: { ...r.agente.entrega, ...dados } } }));
  const pagamento = (dados: Partial<AjustesAgente["pagamento"]>) =>
    setRascunho((r) => ({ ...r, agente: { ...r.agente, pagamento: { ...r.agente.pagamento, ...dados } } }));
  const servicos = (dados: Partial<AjustesAgente["servicos"]>) =>
    setRascunho((r) => ({ ...r, agente: { ...r.agente, servicos: { ...r.agente.servicos, ...dados } } }));
  const pix = (dados: Partial<Pagamentos>) => setRascunho((r) => ({ ...r, pagamentos: { ...r.pagamentos, ...dados } }));

  // Sair da página com alteração não salva pede confirmação do navegador.
  useEffect(() => {
    if (!sujo) return;
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [sujo]);

  async function salvar() {
    setSalvando(true);
    const { agente: a } = rascunho;
    // O texto de horário e a taxa fixa também vão para o cadastro da loja:
    // é o que a tela de pedidos e os relatórios leem.
    const resultados: ResultadoGravacao[] = [
      await salvarLoja({
        ...rascunho.loja,
        horarios: textoDosHorarios(a),
        taxaEntrega: a.entrega.modo === "fixa" ? a.entrega.taxaFixa : rascunho.loja.taxaEntrega,
      }),
      await salvarAjustesAgente(a),
      await salvarPagamentos(rascunho.pagamentos),
    ];
    setSalvando(false);
    if (resultados.includes("protegido")) {
      setPedirSenha(true);
      return;
    }
    if (resultados.every((r) => r === "ok")) avisar("info", "Ajustes salvos. O agente já usa as novas informações.");
  }

  const fechaAs = ate
    ? new Date(ate).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
      {/* Índice das seções */}
      <nav aria-label="Seções dos ajustes" className="hidden lg:block">
        <div className="sticky top-[84px] space-y-1">
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-positive/30 bg-positive/[0.08] px-3 py-2.5">
            <LockOpen className="h-3.5 w-3.5 shrink-0 text-positive" strokeWidth={2} />
            <p className="min-w-0 flex-1 text-[11.5px] leading-snug text-fg-muted">
              {fechaAs ? `Aberta até ${fechaAs}` : "Aberta (administrador)"}
            </p>
          </div>
          {SECOES.map(({ id, titulo, icone: Icone }) => (
            <a
              key={id}
              href={`#${id}`}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[12.5px] text-fg-muted transition-colors hover:bg-nivel-2 hover:text-fg"
            >
              <Icone className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
              {titulo}
            </a>
          ))}
          {fechaAs && (
            <button
              onClick={onFechar}
              className="mt-2 flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[12.5px] text-fg-faint transition-colors hover:bg-nivel-2 hover:text-fg"
            >
              <Lock className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
              Fechar a área agora
            </button>
          )}
        </div>
      </nav>

      <div className="min-w-0 space-y-4 pb-24">
        <SecaoLoja loja={rascunho.loja} onMudar={loja} />
        <SecaoHorarios agente={rascunho.agente} onMudar={agente} />
        <SecaoEntrega rascunho={rascunho} onEntrega={entrega} onAgente={agente} />
        <SecaoPagamento
          agente={rascunho.agente}
          pagamentos={rascunho.pagamentos}
          temMotoboy={rascunho.loja.temMotoboy}
          onPagamento={pagamento}
          onPix={pix}
        />
        <SecaoServicos agente={rascunho.agente} onServicos={servicos} onAgente={agente} />
        <SecaoAtendente agente={rascunho.agente} onAgente={agente} />
        <SecaoPerguntas agente={rascunho.agente} onAgente={agente} />
        <SecaoSenha lojaId={rascunho.loja.id} />
      </div>

      {/* Barra de salvar: aparece só quando há algo para salvar. */}
      {sujo && (
        <div
          className="glass-solid sombra-flutuante fixed bottom-20 left-1/2 z-40 flex w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 items-center gap-3 rounded-2xl p-3 lg:bottom-6"
          style={{ animation: "rise 0.3s cubic-bezier(0.16,1,0.3,1) both" }}
        >
          <span className="h-2 w-2 shrink-0 rounded-full bg-caution" aria-hidden />
          <p className="min-w-0 flex-1 text-[12.5px] font-medium text-fg">Alterações ainda não salvas</p>
          <button onClick={() => setRascunho(inicial)} className="btn-ghost !px-3 !py-2 !text-[12px]">
            <Undo2 className="h-3.5 w-3.5" strokeWidth={2} />
            Descartar
          </button>
          <button onClick={() => void salvar()} disabled={salvando} className="btn-primary !px-3.5 !py-2 !text-[12px]">
            <Save className="h-3.5 w-3.5" strokeWidth={2} />
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      )}

      {pedirSenha && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-veu p-4 backdrop-blur-sm">
          <div className="panel w-full max-w-[420px] p-6">
            <p className="mb-2 text-center text-[12.5px] text-caution">
              A área fechou antes de salvar. Suas alterações continuam aqui.
            </p>
            <Tranca
              compacta
              onAberta={() => {
                setPedirSenha(false);
                void salvar();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------
   Seções
   ------------------------------------------------------------------ */

function SecaoLoja({ loja, onMudar }: { loja: Loja; onMudar: (d: Partial<Loja>) => void }) {
  return (
    <Secao id="loja" icone={Store} titulo="Dados da loja" descricao="O agente usa endereço e farmacêutico para responder o cliente.">
      <div className="space-y-4">
        <Campo label="Nome da loja">
          <Entrada value={loja.nome} onChange={(e) => onMudar({ nome: e.target.value })} placeholder="Ex: Preço Baixo Vila Velha" />
        </Campo>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Campo label="Endereço" hint="Rua e número." className="sm:col-span-2">
            <Entrada value={loja.endereco} onChange={(e) => onMudar({ endereco: e.target.value })} placeholder="Ex: Rua Jair de Andrade, 120" />
          </Campo>
          <Campo label="Bairro">
            <Entrada value={loja.bairro} onChange={(e) => onMudar({ bairro: e.target.value })} placeholder="Ex: Centro" />
          </Campo>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Campo label="Cidade" className="sm:col-span-2">
            <Entrada value={loja.cidade} onChange={(e) => onMudar({ cidade: e.target.value })} placeholder="Ex: Vila Velha" />
          </Campo>
          <Campo label="UF">
            <Entrada value={loja.uf} maxLength={2} onChange={(e) => onMudar({ uf: e.target.value.toUpperCase() })} placeholder="ES" />
          </Campo>
          <Campo label="CEP">
            <Entrada value={loja.cep} onChange={(e) => onMudar({ cep: e.target.value })} placeholder="00000-000" />
          </Campo>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo label="Telefone da loja">
            <Entrada value={loja.telefone} onChange={(e) => onMudar({ telefone: e.target.value })} placeholder="Ex: 27 3000-0000" />
          </Campo>
          <Campo label="CNPJ">
            <Entrada value={loja.cnpj} onChange={(e) => onMudar({ cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
          </Campo>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Campo label="Farmacêutico responsável" hint="Toda dúvida clínica é encaminhada para esta pessoa." className="sm:col-span-2">
            <Entrada value={loja.farmaceutico} onChange={(e) => onMudar({ farmaceutico: e.target.value })} placeholder="Nome completo" />
          </Campo>
          <Campo label="CRF">
            <Entrada value={loja.crf} onChange={(e) => onMudar({ crf: e.target.value })} placeholder="Ex: CRF-ES 00000" />
          </Campo>
        </div>
        <Interruptor
          ligado={loja.temMotoboy}
          onAlternar={(v) => onMudar({ temMotoboy: v })}
          icone={Bike}
          rotulo="Esta loja entrega por motoboy"
          descricao="Desligado, todo pedido é retirada no balcão e o agente não oferece entrega."
        />
      </div>
    </Secao>
  );
}

/** Horas de meia em meia hora, sempre em 24h, seja qual for o idioma do navegador. */
const HORAS = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);

function SeletorHora({ valor, onMudar, rotulo }: { valor: string; onMudar: (v: string) => void; rotulo: string }) {
  const opcoes = HORAS.includes(valor) || !valor ? HORAS : [...HORAS, valor].sort();
  return (
    <select value={valor} onChange={(e) => onMudar(e.target.value)} aria-label={rotulo} className="field tnum !w-[96px] !px-3 !py-1.5">
      {opcoes.map((h) => (
        <option key={h} value={h}>
          {h}
        </option>
      ))}
    </select>
  );
}

function SecaoHorarios({ agente, onMudar }: { agente: AjustesAgente; onMudar: (d: Partial<AjustesAgente>) => void }) {
  const [agora, setAgora] = useState<Date | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setAgora(new Date()), 0);
    return () => clearTimeout(t);
  }, []);
  const situacao = agora ? situacaoDaLoja(agente, agora) : null;

  function dia(id: (typeof DIAS_SEMANA)[number]["id"], dados: Partial<AjustesAgente["horarios"]["seg"]>) {
    onMudar({ horarios: { ...agente.horarios, [id]: { ...agente.horarios[id], ...dados } } });
  }

  function copiarSegunda() {
    const seg = agente.horarios.seg;
    onMudar({
      horarios: { ...agente.horarios, ter: { ...seg }, qua: { ...seg }, qui: { ...seg }, sex: { ...seg } },
    });
  }

  return (
    <Secao
      id="horarios"
      icone={CalendarClock}
      titulo="Horário de funcionamento"
      descricao="O agente calcula sozinho se a loja está aberta na hora em que o cliente pergunta."
    >
      <div className="overflow-hidden rounded-xl border border-hairline">
        {DIAS_SEMANA.map(({ id, nome }, i) => {
          const h = agente.horarios[id];
          return (
            <div
              key={id}
              className={cn("flex flex-wrap items-center gap-3 px-3 py-2.5", i > 0 && "border-t border-hairline", !h.aberto && "bg-nivel-1")}
            >
              <span className="w-[76px] text-[12.5px] font-medium text-fg">{nome}</span>
              <button
                type="button"
                role="switch"
                aria-checked={h.aberto}
                aria-label={`${nome}: ${h.aberto ? "aberto" : "fechado"}`}
                onClick={() => dia(id, { aberto: !h.aberto })}
                className={cn(
                  "flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors",
                  h.aberto ? "bg-brand-500" : "bg-nivel-4",
                )}
              >
                <span className={cn("h-4 w-4 rounded-full bg-white shadow transition-transform", h.aberto ? "translate-x-4" : "")} />
              </button>
              {h.aberto ? (
                <div className="flex items-center gap-2">
                  <SeletorHora valor={h.abre} onMudar={(v) => dia(id, { abre: v })} rotulo={`${nome}: abre às`} />
                  <span className="text-[12px] text-fg-ghost">às</span>
                  <SeletorHora valor={h.fecha} onMudar={(v) => dia(id, { fecha: v })} rotulo={`${nome}: fecha às`} />
                </div>
              ) : (
                <span className="text-[12px] text-fg-ghost">Fechado</span>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={copiarSegunda} className="btn-ghost !px-3 !py-1.5 !text-[12px]">
          Copiar segunda para os dias úteis
        </button>
        {situacao && (
          <span className={cn("chip", situacao.aberta ? "chip-good" : "chip-warn")}>
            Com estes horários, a loja está {situacao.texto}
          </span>
        )}
      </div>
      <p className="mt-3 rounded-xl bg-nivel-2 px-3 py-2.5 text-[12px] leading-relaxed text-fg-muted">
        <span className="font-medium text-fg">O agente diz:</span> {textoDosHorarios(agente)}.
      </p>
      <Campo label="Feriados e horários especiais" hint="Ex: Natal e Ano Novo das 8h às 14h. Plantão aos domingos alternados." className="mt-4">
        <AreaTexto rows={2} value={agente.observacaoHorario} onChange={(e) => onMudar({ observacaoHorario: e.target.value })} />
      </Campo>
    </Secao>
  );
}

function SecaoEntrega({
  rascunho,
  onEntrega,
  onAgente,
}: {
  rascunho: Rascunho;
  onEntrega: (d: Partial<AjustesAgente["entrega"]>) => void;
  onAgente: (d: Partial<AjustesAgente>) => void;
}) {
  const { loja, agente } = rascunho;
  const e = agente.entrega;
  const [localizando, setLocalizando] = useState(false);
  const [simulacao, setSimulacao] = useState({ rua: "", bairro: "", subtotal: 40 });
  const [resultado, setResultado] = useState("");

  async function localizarLoja() {
    setLocalizando(true);
    const partes = loja.endereco.match(/^(.*?)[,\s]+(\d+[a-zA-Z]?)\b/);
    const r = await localizarEndereco({
      rua: partes ? partes[1] : loja.endereco,
      numero: partes ? partes[2] : "",
      bairro: loja.bairro,
      cidade: loja.cidade,
      uf: loja.uf,
    });
    setLocalizando(false);
    if (!r) {
      avisar("erro", "Não achei o endereço da loja no mapa. Confira rua, bairro e cidade.");
      return;
    }
    onAgente({ localizacao: { lat: r.lat, lon: r.lon } });
  }

  async function simular() {
    setResultado("Calculando...");
    let km: number | null = null;
    if (e.modo === "distancia") {
      const origem = agente.localizacao;
      const partes = simulacao.rua.match(/^(.*?)[,\s]+(\d+[a-zA-Z]?)\b/);
      const destino = await localizarEndereco({
        rua: partes ? partes[1] : simulacao.rua,
        numero: partes ? partes[2] : "",
        bairro: simulacao.bairro,
        cidade: loja.cidade,
        uf: loja.uf,
      });
      if (!origem) {
        setResultado("Localize a loja no mapa antes de simular.");
        return;
      }
      if (destino) km = distanciaKm(origem, destino) * FATOR_RUA;
    }
    const r = calcularEntrega(e, { subtotal: simulacao.subtotal, bairro: simulacao.bairro, km });
    setResultado(r.ok ? `Taxa: ${formatBRLCents(r.taxa)} (${r.detalhe})` : r.motivo);
  }

  if (!loja.temMotoboy) {
    return (
      <Secao id="entrega" icone={Bike} titulo="Entrega" descricao="Ligue a entrega por motoboy em Dados da loja para configurar taxas.">
        <p className="text-[12.5px] text-fg-faint">Hoje a loja só trabalha com retirada no balcão.</p>
      </Secao>
    );
  }

  return (
    <Secao
      id="entrega"
      icone={Bike}
      titulo="Entrega por motoboy"
      descricao="A taxa é calculada pelo sistema, não pela IA: o agente pergunta o endereço e o sistema responde o valor."
    >
      <Segmentado
        rotulo="Como cobrar a entrega"
        valor={e.modo}
        onEscolher={(modo) => onEntrega({ modo })}
        opcoes={[
          { valor: "fixa", titulo: "Taxa fixa", descricao: "O mesmo valor para todo endereço.", icone: CreditCard },
          { valor: "bairro", titulo: "Por bairro", descricao: "Uma tabela com o valor de cada bairro.", icone: MapPin },
          { valor: "distancia", titulo: "Por distância", descricao: "Valor base mais um tanto por km.", icone: Route },
        ]}
      />

      <div className="mt-4 space-y-4">
        {e.modo === "fixa" && (
          <Campo label="Taxa de entrega" hint="Zero significa entrega grátis." className="max-w-[220px]">
            <EntradaReais valor={e.taxaFixa} onMudar={(v) => onEntrega({ taxaFixa: v })} />
          </Campo>
        )}

        {e.modo === "bairro" && (
          <div>
            <div className="overflow-hidden rounded-xl border border-hairline">
              {e.bairros.length === 0 && (
                <p className="px-3 py-4 text-center text-[12px] text-fg-faint">Nenhum bairro na tabela ainda.</p>
              )}
              {e.bairros.map((b, i) => (
                <div key={i} className={cn("flex items-center gap-2 px-3 py-2", i > 0 && "border-t border-hairline")}>
                  <input
                    value={b.nome}
                    onChange={(ev) => onEntrega({ bairros: e.bairros.map((x, j) => (j === i ? { ...x, nome: ev.target.value } : x)) })}
                    placeholder="Nome do bairro"
                    aria-label={`Bairro ${i + 1}`}
                    className="field !py-1.5"
                  />
                  <div className="w-[150px] shrink-0">
                    <EntradaReais valor={b.taxa} onMudar={(v) => onEntrega({ bairros: e.bairros.map((x, j) => (j === i ? { ...x, taxa: v } : x)) })} />
                  </div>
                  <button
                    type="button"
                    onClick={() => onEntrega({ bairros: e.bairros.filter((_, j) => j !== i) })}
                    aria-label={`Remover ${b.nome || "bairro"}`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-fg-ghost transition-colors hover:bg-nivel-3 hover:text-brand-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => onEntrega({ bairros: [...e.bairros, { nome: "", taxa: 0 }] })}
              className="btn-ghost mt-2 !px-3 !py-1.5 !text-[12px]"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.2} />
              Adicionar bairro
            </button>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo label="Bairro fora da tabela">
                <select
                  value={e.foraDaTabela}
                  onChange={(ev) => onEntrega({ foraDaTabela: ev.target.value as typeof e.foraDaTabela })}
                  className="field"
                >
                  <option value="nao_entrega">Não entrega</option>
                  <option value="taxa_padrao">Cobra a taxa padrão</option>
                </select>
              </Campo>
              {e.foraDaTabela === "taxa_padrao" && (
                <Campo label="Taxa padrão">
                  <EntradaReais valor={e.taxaPadrao} onMudar={(v) => onEntrega({ taxaPadrao: v })} />
                </Campo>
              )}
            </div>
          </div>
        )}

        {e.modo === "distancia" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Campo label="Taxa base">
                <EntradaReais valor={e.taxaBase} onMudar={(v) => onEntrega({ taxaBase: v })} />
              </Campo>
              <Campo label="Km incluídos na base">
                <Entrada type="number" min={0} step="0.5" value={String(e.kmInclusos)} onChange={(ev) => onEntrega({ kmInclusos: Math.max(0, Number(ev.target.value) || 0) })} />
              </Campo>
              <Campo label="Por km a mais">
                <EntradaReais valor={e.porKm} onMudar={(v) => onEntrega({ porKm: v })} />
              </Campo>
              <Campo label="Raio máximo (km)">
                <Entrada type="number" min={0} step="0.5" value={String(e.raioMaximoKm)} onChange={(ev) => onEntrega({ raioMaximoKm: Math.max(0, Number(ev.target.value) || 0) })} />
              </Campo>
            </div>
            <div className="flex flex-wrap items-center gap-3 rounded-xl bg-nivel-2 p-3">
              <MapPin className={cn("h-4 w-4 shrink-0", agente.localizacao ? "text-positive" : "text-caution")} strokeWidth={2} />
              <p className="min-w-0 flex-1 text-[12px] leading-relaxed text-fg-muted">
                {agente.localizacao ? (
                  <>
                    Loja localizada no mapa.{" "}
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${agente.localizacao.lat}&mlon=${agente.localizacao.lon}#map=17/${agente.localizacao.lat}/${agente.localizacao.lon}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-brand-400 underline-offset-2 hover:underline"
                    >
                      Conferir no mapa
                    </a>
                  </>
                ) : (
                  "A distância é medida a partir da loja. Localize a loja no mapa pelo endereço cadastrado."
                )}
              </p>
              <button type="button" onClick={() => void localizarLoja()} disabled={localizando} className="btn-ghost !px-3 !py-1.5 !text-[12px]">
                {localizando ? "Procurando..." : agente.localizacao ? "Localizar de novo" : "Localizar a loja"}
              </button>
            </div>
            <p className="text-[11.5px] leading-relaxed text-fg-ghost">
              A distância é estimada: linha reta corrigida para o traçado da rua. Serve para cobrar,
              não para navegar.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Campo label="Pedido mínimo para entrega" hint="Zero: sem mínimo.">
            <EntradaReais valor={e.pedidoMinimo} onMudar={(v) => onEntrega({ pedidoMinimo: v })} />
          </Campo>
          <Campo label="Entrega grátis a partir de" hint="Zero: nunca é grátis.">
            <EntradaReais valor={e.freteGratisAcima} onMudar={(v) => onEntrega({ freteGratisAcima: v })} />
          </Campo>
          <Campo label="Tempo médio (minutos)">
            <Entrada type="number" min={0} step="5" value={String(e.tempoMinutos)} onChange={(ev) => onEntrega({ tempoMinutos: Math.max(0, Number(ev.target.value) || 0) })} />
          </Campo>
        </div>
        <Campo label="Horário das entregas" hint="Se for diferente do horário da loja. Ex: entregas das 8h às 21h.">
          <Entrada value={e.horario} onChange={(ev) => onEntrega({ horario: ev.target.value })} />
        </Campo>

        {/* Simulador: testar a regra antes de o cliente testar. */}
        <div className="rounded-xl border border-dashed border-hairline p-3.5">
          <p className="mb-2.5 flex items-center gap-2 text-[12.5px] font-semibold text-fg">
            <Calculator className="h-4 w-4 text-fg-ghost" strokeWidth={2} />
            Simular uma entrega
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_140px_auto]">
            <input
              value={simulacao.rua}
              onChange={(ev) => setSimulacao({ ...simulacao, rua: ev.target.value })}
              placeholder="Rua e número"
              aria-label="Rua e número para simular"
              className="field !py-2"
            />
            <input
              value={simulacao.bairro}
              onChange={(ev) => setSimulacao({ ...simulacao, bairro: ev.target.value })}
              placeholder="Bairro"
              aria-label="Bairro para simular"
              className="field !py-2"
            />
            <EntradaReais valor={simulacao.subtotal} onMudar={(v) => setSimulacao({ ...simulacao, subtotal: v })} />
            <button type="button" onClick={() => void simular()} className="btn-ghost !py-2 !text-[12px]">
              Calcular
            </button>
          </div>
          {resultado && (
            <p role="status" className="mt-2.5 text-[12.5px] font-medium text-fg">
              {resultado}
            </p>
          )}
        </div>
      </div>
    </Secao>
  );
}

function SecaoPagamento({
  agente,
  pagamentos,
  temMotoboy,
  onPagamento,
  onPix,
}: {
  agente: AjustesAgente;
  pagamentos: Pagamentos;
  temMotoboy: boolean;
  onPagamento: (d: Partial<AjustesAgente["pagamento"]>) => void;
  onPix: (d: Partial<Pagamentos>) => void;
}) {
  const p = agente.pagamento;
  return (
    <Secao id="pagamento" icone={Wallet} titulo="Pagamento" descricao="O agente fala só das formas marcadas aqui.">
      <p className="mb-2 text-[11.5px] font-medium text-fg-muted">Formas aceitas</p>
      <div className="flex flex-wrap gap-2">
        <Opcao rotulo="Dinheiro" marcada={p.dinheiro} onAlternar={(v) => onPagamento({ dinheiro: v })} />
        <Opcao rotulo="Pix" marcada={p.pix} onAlternar={(v) => onPagamento({ pix: v })} />
        <Opcao rotulo="Cartão de débito" marcada={p.debito} onAlternar={(v) => onPagamento({ debito: v })} />
        <Opcao rotulo="Cartão de crédito" marcada={p.credito} onAlternar={(v) => onPagamento({ credito: v })} />
      </div>
      {temMotoboy && (
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Interruptor
            ligado={p.maquininhaNaEntrega}
            onAlternar={(v) => onPagamento({ maquininhaNaEntrega: v })}
            rotulo="Motoboy leva maquininha"
            descricao="Desligado, na entrega é só dinheiro ou Pix."
          />
          <Interruptor
            ligado={p.trocoNaEntrega}
            onAlternar={(v) => onPagamento({ trocoNaEntrega: v })}
            rotulo="Motoboy leva troco"
            descricao="O agente pergunta para quanto é o troco."
          />
        </div>
      )}
      <Campo label="Observação sobre pagamento" hint="Ex: parcelamos acima de R$ 100 em até 3x sem juros." className="mt-4">
        <Entrada value={p.observacao} onChange={(e) => onPagamento({ observacao: e.target.value })} />
      </Campo>

      <div className="mt-5 rounded-xl bg-nivel-2 p-3.5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-[12.5px] font-semibold text-fg">Chave Pix da loja</p>
          <span className={cn("chip", pixConfigurado(pagamentos) ? "chip-good" : "chip-warn")}>
            {pixConfigurado(pagamentos) ? "ativa" : "sem chave"}
          </span>
        </div>
        <p className="mb-3 text-[11.5px] leading-relaxed text-fg-faint">
          Usada para gerar o Pix copia e cola dos pedidos, com o valor certo. A baixa ainda é manual:
          confirmar sozinho exige um provedor de pagamento conectado.
        </p>
        <div className="space-y-3">
          <Campo label="Chave Pix" hint="CPF, CNPJ, telefone, email ou chave aleatória.">
            <Entrada value={pagamentos.chavePix} onChange={(e) => onPix({ chavePix: e.target.value })} placeholder="Ex: 00.000.000/0001-00" />
          </Campo>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo label="Nome do recebedor" hint="Como aparece no app do cliente.">
              <Entrada value={pagamentos.beneficiario} maxLength={25} onChange={(e) => onPix({ beneficiario: e.target.value })} />
            </Campo>
            <Campo label="Cidade">
              <Entrada value={pagamentos.cidade} maxLength={15} onChange={(e) => onPix({ cidade: e.target.value })} />
            </Campo>
          </div>
        </div>
      </div>
    </Secao>
  );
}

function SecaoServicos({
  agente,
  onServicos,
  onAgente,
}: {
  agente: AjustesAgente;
  onServicos: (d: Partial<AjustesAgente["servicos"]>) => void;
  onAgente: (d: Partial<AjustesAgente>) => void;
}) {
  const s = agente.servicos;
  return (
    <Secao id="servicos" icone={ShieldCheck} titulo="Serviços e regras da loja" descricao="Tudo que o cliente costuma perguntar antes de vir até a loja.">
      <p className="mb-2 text-[11.5px] font-medium text-fg-muted">Serviços oferecidos</p>
      <div className="flex flex-wrap gap-2">
        <Opcao rotulo="Aferição de pressão" marcada={s.pressao} onAlternar={(v) => onServicos({ pressao: v })} />
        <Opcao rotulo="Teste de glicemia" marcada={s.glicemia} onAlternar={(v) => onServicos({ glicemia: v })} />
        <Opcao rotulo="Aplicação de injetáveis" marcada={s.injetaveis} onAlternar={(v) => onServicos({ injetaveis: v })} />
        <Opcao rotulo="Furo de orelha" marcada={s.furoOrelha} onAlternar={(v) => onServicos({ furoOrelha: v })} />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Campo label="Outros serviços">
          <Entrada value={s.outros} onChange={(e) => onServicos({ outros: e.target.value })} placeholder="Ex: teste rápido de covid" />
        </Campo>
        <Campo label="Convênios aceitos">
          <Entrada value={agente.convenios} onChange={(e) => onAgente({ convenios: e.target.value })} placeholder="Ex: Farmácia Popular, Unimed" />
        </Campo>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Campo label="Troca e devolução">
          <AreaTexto rows={2} value={agente.politicaTroca} onChange={(e) => onAgente({ politicaTroca: e.target.value })} placeholder="Ex: troca em até 7 dias com nota, exceto medicamento." />
        </Campo>
        <Campo label="Retirada por outra pessoa">
          <AreaTexto rows={2} value={agente.retiradaTerceiros} onChange={(e) => onAgente({ retiradaTerceiros: e.target.value })} placeholder="Ex: pode, com o número do pedido. Controlado só com documento." />
        </Campo>
      </div>
      <Campo label="Fidelidade e descontos" className="mt-3">
        <Entrada value={agente.fidelidade} onChange={(e) => onAgente({ fidelidade: e.target.value })} placeholder="Ex: 5% de desconto para idosos às quartas." />
      </Campo>
    </Secao>
  );
}

function SecaoAtendente({ agente, onAgente }: { agente: AjustesAgente; onAgente: (d: Partial<AjustesAgente>) => void }) {
  return (
    <Secao id="atendente" icone={Bot} titulo="Atendente virtual" descricao="O jeito de falar. As regras de segurança (nunca opinar sobre remédio) não mudam aqui.">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Campo label="Nome do atendente" hint="Vazio: ele não se apresenta com nome.">
          <Entrada value={agente.nomeAtendente} maxLength={30} onChange={(e) => onAgente({ nomeAtendente: e.target.value })} placeholder="Ex: Bia" />
        </Campo>
        <Campo label="Saudação" hint="Usada na primeira mensagem." className="sm:col-span-2">
          <Entrada value={agente.saudacao} maxLength={200} onChange={(e) => onAgente({ saudacao: e.target.value })} placeholder="Ex: Oi! Aqui é a Bia, da Preço Baixo. Em que posso ajudar?" />
        </Campo>
      </div>
      <p className="mb-2 mt-4 text-[11.5px] font-medium text-fg-muted">Tom</p>
      <Segmentado
        rotulo="Tom do atendente"
        valor={agente.tom}
        onEscolher={(tom) => onAgente({ tom })}
        opcoes={[
          { valor: "proximo", titulo: "Próximo", descricao: "Descontraído, como alguém do bairro." },
          { valor: "equilibrado", titulo: "Equilibrado", descricao: "Simpático e profissional." },
          { valor: "formal", titulo: "Formal", descricao: "Trata por senhor e senhora." },
        ]}
      />
      <Campo label="O que mais o agente precisa saber" hint="Escreva como explicaria para alguém novo no balcão." className="mt-4">
        <AreaTexto
          rows={4}
          value={agente.observacoes}
          maxLength={1500}
          onChange={(e) => onAgente({ observacoes: e.target.value })}
          placeholder="Ex: temos estacionamento na frente. Aos sábados o movimento é grande, avise que a retirada pode demorar 15 minutos."
        />
      </Campo>
    </Secao>
  );
}

const SUGESTOES_PERGUNTAS = [
  "Vocês aceitam receita digital?",
  "Tem estacionamento?",
  "Vendem medicamento controlado pelo WhatsApp?",
  "Fazem entrega de madrugada?",
  "Tem farmacêutico na loja agora?",
];

function SecaoPerguntas({ agente, onAgente }: { agente: AjustesAgente; onAgente: (d: Partial<AjustesAgente>) => void }) {
  const lista = agente.perguntas;
  const sugestoes = useMemo(
    () => SUGESTOES_PERGUNTAS.filter((s) => !lista.some((q) => q.pergunta.trim() === s)),
    [lista],
  );

  return (
    <Secao
      id="perguntas"
      icone={MessageSquareQuote}
      titulo="Perguntas frequentes"
      descricao="O agente responde estas perguntas exatamente com a resposta escrita aqui."
    >
      <div className="space-y-2.5">
        {lista.length === 0 && (
          <p className="rounded-xl bg-nivel-2 px-3 py-4 text-center text-[12px] text-fg-faint">
            Nenhuma pergunta ainda. Comece por uma sugestão abaixo.
          </p>
        )}
        {lista.map((q, i) => (
          <div key={i} className="rounded-xl border border-hairline p-3">
            <div className="flex items-start gap-2">
              <span className="tnum mt-2 w-5 shrink-0 font-mono text-[11px] text-fg-ghost">{i + 1}</span>
              <div className="min-w-0 flex-1 space-y-2">
                <input
                  value={q.pergunta}
                  onChange={(e) => onAgente({ perguntas: lista.map((x, j) => (j === i ? { ...x, pergunta: e.target.value } : x)) })}
                  placeholder="Pergunta do cliente"
                  aria-label={`Pergunta ${i + 1}`}
                  className="field !py-2 font-medium"
                />
                <textarea
                  rows={2}
                  value={q.resposta}
                  onChange={(e) => onAgente({ perguntas: lista.map((x, j) => (j === i ? { ...x, resposta: e.target.value } : x)) })}
                  placeholder="Resposta da loja"
                  aria-label={`Resposta ${i + 1}`}
                  className="field !rounded-2xl !py-2"
                />
              </div>
              <button
                type="button"
                onClick={() => onAgente({ perguntas: lista.filter((_, j) => j !== i) })}
                aria-label={`Remover pergunta ${i + 1}`}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-fg-ghost transition-colors hover:bg-nivel-3 hover:text-brand-400"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onAgente({ perguntas: [...lista, { pergunta: "", resposta: "" }] })}
          className="btn-ghost !px-3 !py-1.5 !text-[12px]"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.2} />
          Nova pergunta
        </button>
        {sugestoes.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onAgente({ perguntas: [...lista, { pergunta: s, resposta: "" }] })}
            className="chip transition-colors hover:border-brand-500/40 hover:text-brand-300"
          >
            <Plus className="h-3 w-3" strokeWidth={2.2} />
            {s}
          </button>
        ))}
      </div>
    </Secao>
  );
}

function SecaoSenha({ lojaId }: { lojaId: string }) {
  const [nova, setNova] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [mensagem, setMensagem] = useState<{ ok: boolean; texto: string } | null>(null);

  async function trocar(e: React.FormEvent) {
    e.preventDefault();
    if (nova !== confirmacao) {
      setMensagem({ ok: false, texto: "As duas senhas não são iguais." });
      return;
    }
    const r = await trocarPin(lojaId, nova);
    setMensagem(r.ok ? { ok: true, texto: "Senha trocada. Avise quem precisa saber." } : { ok: false, texto: r.erro ?? "Não deu para trocar." });
    if (r.ok) {
      setNova("");
      setConfirmacao("");
    }
  }

  return (
    <Secao id="senha" icone={KeyRound} titulo="Senha desta área" descricao="De 4 a 8 números. Combine com quem gerencia a loja; quem opera o caixa não precisa saber.">
      <form onSubmit={trocar} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Campo label="Nova senha">
          <Entrada type="password" inputMode="numeric" maxLength={8} value={nova} onChange={(e) => setNova(e.target.value.replace(/\D/g, ""))} autoComplete="new-password" />
        </Campo>
        <Campo label="Repita a nova senha">
          <Entrada type="password" inputMode="numeric" maxLength={8} value={confirmacao} onChange={(e) => setConfirmacao(e.target.value.replace(/\D/g, ""))} autoComplete="new-password" />
        </Campo>
        <button type="submit" disabled={nova.length < 4} className="btn-ghost">
          Trocar senha
        </button>
      </form>
      {mensagem && (
        <p role="status" className={cn("mt-2 text-[12px] font-medium", mensagem.ok ? "text-positive" : "text-brand-400")}>
          {mensagem.texto}
        </p>
      )}
    </Secao>
  );
}
