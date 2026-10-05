"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Calendário próprio, no lugar do seletor de data do navegador.
 *
 * O do navegador muda de cara em cada sistema, trava no Windows e deixava
 * escolher data no passado para agendar campanha. Este é igual em todo
 * lugar, segue o tema, e sabe o que pode e o que não pode ser escolhido.
 *
 * Datas trafegam como "AAAA-MM-DD" (dia do calendário, sem fuso) e horas
 * como "HH:MM", que é como a loja pensa: "dia 10 às 9h".
 */

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

export function diaIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function deIso(iso: string) {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, (m || 1) - 1, d || 1);
}

export function dataCurta(iso: string) {
  if (!iso) return "";
  const d = deIso(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

/** Fecha o painel ao clicar fora ou apertar Esc. */
function useFecharFora(aberto: boolean, fechar: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const clique = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) fechar();
    };
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    document.addEventListener("mousedown", clique);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", clique);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto, fechar]);
  return ref;
}

/** A grade de um mês. Serve para dia único e para período. */
function Mes({
  mes,
  onMes,
  selecionado,
  inicio,
  fim,
  previa,
  onPrevia,
  onEscolher,
  minimo,
  maximo,
}: {
  mes: Date;
  onMes: (d: Date) => void;
  selecionado?: string;
  inicio?: string;
  fim?: string;
  previa?: string;
  onPrevia?: (iso: string) => void;
  onEscolher: (iso: string) => void;
  minimo?: string;
  maximo?: string;
}) {
  const hoje = diaIso(new Date());
  const dias = useMemo(() => {
    const primeiro = new Date(mes.getFullYear(), mes.getMonth(), 1);
    const comeco = new Date(primeiro);
    comeco.setDate(1 - primeiro.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(comeco);
      d.setDate(comeco.getDate() + i);
      return d;
    });
  }, [mes]);

  const fimEfetivo = fim || (inicio && previa && previa > inicio ? previa : "");

  return (
    <div className="w-[264px]">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))}
          aria-label="Mês anterior"
          className="flex h-8 w-8 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-nivel-3 hover:text-fg"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={2} />
        </button>
        <p className="text-[13px] font-semibold first-letter:uppercase text-fg" aria-live="polite">
          {MESES[mes.getMonth()]} de {mes.getFullYear()}
        </p>
        <button
          type="button"
          onClick={() => onMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))}
          aria-label="Próximo mês"
          className="flex h-8 w-8 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-nivel-3 hover:text-fg"
        >
          <ChevronRight className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-y-0.5" role="grid">
        {SEMANA.map((d, i) => (
          <span key={i} className="py-1 text-center text-[10.5px] font-semibold text-fg-ghost" aria-hidden>
            {d}
          </span>
        ))}
        {dias.map((d) => {
          const iso = diaIso(d);
          const foraDoMes = d.getMonth() !== mes.getMonth();
          const bloqueado = (minimo && iso < minimo) || (maximo && iso > maximo);
          const ehSelecionado = iso === selecionado || iso === inicio || iso === fimEfetivo;
          const noMeio = inicio && fimEfetivo && iso > inicio && iso < fimEfetivo;
          return (
            <button
              key={iso}
              type="button"
              disabled={Boolean(bloqueado)}
              onClick={() => onEscolher(iso)}
              onMouseEnter={() => onPrevia?.(iso)}
              aria-label={d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
              aria-pressed={ehSelecionado}
              className={cn(
                "tnum relative flex h-9 items-center justify-center text-[12.5px] transition-colors",
                noMeio && "bg-brand-500/[0.12]",
                iso === inicio && fimEfetivo && "rounded-l-full bg-brand-500/[0.12]",
                iso === fimEfetivo && inicio && "rounded-r-full bg-brand-500/[0.12]",
                bloqueado && "cursor-not-allowed opacity-30",
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full",
                  ehSelecionado
                    ? "bg-brand-500 font-semibold text-white"
                    : foraDoMes
                      ? "text-fg-ghost"
                      : "text-fg",
                  !ehSelecionado && !bloqueado && "hover:bg-nivel-3",
                  iso === hoje && !ehSelecionado && "ring-1 ring-inset ring-brand-500/60",
                )}
              >
                {d.getDate()}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   Período (de / até)
   ------------------------------------------------------------------ */

export type Atalho = { rotulo: string; de: string; ate: string };

export function SeletorPeriodo({
  de,
  ate,
  onMudar,
  atalhos,
  maximo,
}: {
  de: string;
  ate: string;
  onMudar: (de: string, ate: string, rotulo?: string) => void;
  atalhos: Atalho[];
  maximo?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [mes, setMes] = useState(() => deIso(ate || diaIso(new Date())));
  const [inicio, setInicio] = useState("");
  const [previa, setPrevia] = useState("");
  const ref = useFecharFora(aberto, () => {
    setAberto(false);
    setInicio("");
  });

  function escolher(iso: string) {
    if (!inicio) {
      setInicio(iso);
      return;
    }
    const [a, b] = iso < inicio ? [iso, inicio] : [inicio, iso];
    onMudar(a, b);
    setInicio("");
    setAberto(false);
  }

  const atalhoAtual = atalhos.find((a) => a.de === de && a.ate === ate);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-haspopup="dialog"
        className="field flex !w-auto items-center gap-2 !py-2 !text-[12.5px]"
      >
        <CalendarDays className="h-4 w-4 text-fg-ghost" strokeWidth={2} />
        <span className="font-medium text-fg">{atalhoAtual?.rotulo ?? "Período"}</span>
        <span className="tnum text-fg-faint">
          {dataCurta(de)}
          {de !== ate && ` a ${dataCurta(ate)}`}
        </span>
      </button>
      {aberto && (
        <div
          role="dialog"
          aria-label="Escolher período"
          className="glass-solid sombra-flutuante absolute left-0 top-[calc(100%+6px)] z-50 flex flex-col gap-3 rounded-2xl p-3 sm:flex-row"
          style={{ animation: "rise 0.22s cubic-bezier(0.16,1,0.3,1) both" }}
        >
          <div className="flex flex-row flex-wrap gap-1 sm:w-[150px] sm:flex-col">
            {atalhos.map((a) => (
              <button
                key={a.rotulo}
                type="button"
                onClick={() => {
                  onMudar(a.de, a.ate, a.rotulo);
                  setMes(deIso(a.ate));
                  setAberto(false);
                }}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-left text-[12.5px] transition-colors",
                  atalhoAtual?.rotulo === a.rotulo ? "bg-brand-500/[0.14] font-medium text-fg" : "text-fg-muted hover:bg-nivel-3 hover:text-fg",
                )}
              >
                {a.rotulo}
              </button>
            ))}
          </div>
          <div className="border-t border-hairline pt-3 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
            <Mes
              mes={mes}
              onMes={setMes}
              inicio={inicio || de}
              fim={inicio ? "" : ate}
              previa={previa}
              onPrevia={setPrevia}
              onEscolher={escolher}
              maximo={maximo}
            />
            <p className="mt-2 text-center text-[11px] text-fg-ghost">
              {inicio ? "Agora clique no último dia" : "Clique no primeiro dia e depois no último"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------
   Dia e hora (agendamento)
   ------------------------------------------------------------------ */

const HORARIOS = Array.from({ length: 30 }, (_, i) => {
  const minutos = 7 * 60 + i * 30;
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${minutos % 60 ? "30" : "00"}`;
});

/**
 * Escolhe dia e hora. Nada antes de agora: dia passado fica apagado, e no dia
 * de hoje só aparecem horários que ainda não passaram.
 *
 * `valor` no formato "AAAA-MM-DDTHH:MM".
 */
export function SeletorDataHora({
  valor,
  onMudar,
  rotulo = "Escolher dia e hora",
}: {
  valor: string;
  onMudar: (valor: string) => void;
  rotulo?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [dia, hora] = valor ? valor.split("T") : ["", ""];
  const [mes, setMes] = useState(() => deIso(dia || diaIso(new Date())));
  const ref = useFecharFora(aberto, () => setAberto(false));
  const [agora, setAgora] = useState<Date | null>(null);

  useEffect(() => {
    if (!aberto) return;
    const t = setTimeout(() => setAgora(new Date()), 0);
    return () => clearTimeout(t);
  }, [aberto]);

  const hoje = agora ? diaIso(agora) : "";
  const minutoAgora = agora ? agora.getHours() * 60 + agora.getMinutes() : 0;
  const disponiveis = (d: string) =>
    HORARIOS.filter((h) => {
      if (d !== hoje) return true;
      const [hh, mm] = h.split(":").map(Number);
      return hh * 60 + mm > minutoAgora + 10;
    });

  function escolherDia(iso: string) {
    const lista = disponiveis(iso);
    const horaValida = hora && lista.includes(hora) ? hora : (lista.find((h) => h >= "09:00") ?? lista[0] ?? "");
    onMudar(horaValida ? `${iso}T${horaValida}` : "");
  }

  const amanha = agora ? diaIso(new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1)) : "";
  const sabado = agora
    ? diaIso(new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + ((6 - agora.getDay() + 7) % 7 || 7)))
    : "";

  const legivel = valor
    ? `${deIso(dia).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })} às ${hora}`
    : "";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-haspopup="dialog"
        className="field flex items-center gap-2 text-left"
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-fg-ghost" strokeWidth={2} />
        <span className={cn("flex-1 truncate", valor ? "text-fg" : "text-fg-ghost")}>{legivel || "Enviar agora (sem agendar)"}</span>
      </button>
      {aberto && (
        <div
          role="dialog"
          aria-label={rotulo}
          className="glass-solid sombra-flutuante absolute left-0 top-[calc(100%+6px)] z-50 flex w-max max-w-[calc(100vw-2rem)] flex-col gap-3 rounded-2xl p-3 sm:flex-row"
          style={{ animation: "rise 0.22s cubic-bezier(0.16,1,0.3,1) both" }}
        >
          <div>
            <div className="mb-2 flex flex-wrap gap-1">
              {[
                ["Amanhã 9h", `${amanha}T09:00`],
                ["Sábado 10h", `${sabado}T10:00`],
              ].map(([r, v]) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    onMudar(v);
                    setMes(deIso(v.split("T")[0]));
                  }}
                  className="chip transition-colors hover:border-brand-500/40 hover:text-fg"
                >
                  {r}
                </button>
              ))}
              {valor && (
                <button type="button" onClick={() => onMudar("")} className="chip transition-colors hover:text-fg">
                  Sem agendamento
                </button>
              )}
            </div>
            <Mes mes={mes} onMes={setMes} selecionado={dia} onEscolher={escolherDia} minimo={hoje} />
          </div>
          <div className="border-t border-hairline pt-3 sm:w-[132px] sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
            <p className="mb-2 flex items-center gap-1.5 text-[11.5px] font-medium text-fg-muted">
              <Clock className="h-3.5 w-3.5" strokeWidth={2} />
              Horário
            </p>
            {!dia ? (
              <p className="text-[11.5px] text-fg-ghost">Escolha o dia primeiro.</p>
            ) : (
              <div data-lenis-prevent className="grid max-h-[300px] grid-cols-3 gap-1 overflow-y-auto sm:grid-cols-1">
                {disponiveis(dia).map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => {
                      onMudar(`${dia}T${h}`);
                      setAberto(false);
                    }}
                    aria-pressed={h === hora}
                    className={cn(
                      "tnum rounded-lg px-3 py-1.5 text-[12.5px] transition-colors",
                      h === hora ? "bg-brand-500 font-semibold text-white" : "text-fg-muted hover:bg-nivel-3 hover:text-fg",
                    )}
                  >
                    {h}
                  </button>
                ))}
                {disponiveis(dia).length === 0 && <p className="text-[11.5px] text-fg-ghost">Hoje não há mais horário.</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Se o agendamento já passou. Campanha não pode ficar marcada no passado. */
export function agendamentoNoPassado(valor: string, agora = new Date()) {
  if (!valor) return false;
  const [d, h] = valor.split("T");
  const data = deIso(d);
  const [hh, mm] = (h || "00:00").split(":").map(Number);
  data.setHours(hh, mm, 0, 0);
  return data.getTime() < agora.getTime();
}
