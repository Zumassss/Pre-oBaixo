"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Mic, Paperclip, SendHorizonal, ShieldAlert, Trash2, WifiOff, X } from "lucide-react";
import { avisar } from "@/lib/db/local-db";
import type { Conversa, Mensagem } from "@/lib/db/types";
import { adicionarMensagem } from "@/lib/db/use-db";
import { descreverMidia, enviarArquivo } from "@/lib/midia";
import { cn } from "@/lib/utils";

const DURACAO_MAXIMA = 120;
const QUEM: Record<Mensagem["origem"], string> = { cliente: "Cliente", agente: "Agente", atendente: "Equipe" };

/** O formato que o navegador sabe gravar. O bot converte para o WhatsApp. */
function formatoDeAudio() {
  if (typeof MediaRecorder === "undefined") return "";
  return (
    ["audio/ogg;codecs=opus", "audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) =>
      MediaRecorder.isTypeSupported(t),
    ) ?? ""
  );
}

function tempo(segundos: number) {
  return `${Math.floor(segundos / 60)}:${String(Math.floor(segundos % 60)).padStart(2, "0")}`;
}

type Gravacao = {
  gravador: MediaRecorder;
  fluxo: MediaStream;
  inicio: number;
  partes: Blob[];
  cancelar: boolean;
  analisador: AnalyserNode;
  contexto: AudioContext;
};

export function Compositor({
  conversa,
  atendente,
  lojaId,
  citando,
  onCancelarCitacao,
  whatsappNoAr,
}: {
  conversa: Conversa;
  atendente: string;
  lojaId: string;
  citando: Mensagem | null;
  onCancelarCitacao: () => void;
  whatsappNoAr: boolean;
}) {
  const [rascunho, setRascunho] = useState("");
  const [enviando, setEnviando] = useState("");
  const [segundos, setSegundos] = useState(0);
  const [nivel, setNivel] = useState(0);
  const [gravando, setGravando] = useState(false);
  const gravacao = useRef<Gravacao | null>(null);
  const campoFoto = useRef<HTMLInputElement>(null);
  const campoArquivo = useRef<HTMLInputElement>(null);
  const texto = useRef<HTMLTextAreaElement>(null);

  const comAtendente = conversa.status === "com_atendente";
  const viaWhatsapp = conversa.canal === "whatsapp";

  // Troca de conversa: o rascunho e a gravação não vão junto.
  useEffect(() => {
    const t = setTimeout(() => setRascunho(""), 0);
    return () => {
      clearTimeout(t);
      pararGravacao(true);
    };
  }, [conversa.id]);

  useEffect(() => {
    if (citando) texto.current?.focus();
  }, [citando]);

  // Cresce até 5 linhas conforme a pessoa escreve.
  useEffect(() => {
    const el = texto.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [rascunho]);

  function citacao(): Mensagem["citada"] {
    return citando
      ? { id: citando.id, texto: citando.texto || descreverMidia(citando.midia), origem: citando.origem }
      : null;
  }

  function enviarTexto() {
    const t = rascunho.trim();
    if (!t) return;
    adicionarMensagem(conversa.id, "atendente", t, atendente, { citada: citacao() });
    setRascunho("");
    onCancelarCitacao();
  }

  async function enviarMidia(arquivo: File | Blob, rotulo: string, nome = "", duracao?: number) {
    setEnviando(rotulo);
    const r = await enviarArquivo(lojaId, arquivo, nome, duracao);
    setEnviando("");
    if (!r.ok) {
      avisar("erro", r.erro);
      return;
    }
    adicionarMensagem(conversa.id, "atendente", rascunho.trim(), atendente, {
      midia: r.midia,
      citada: citacao(),
    });
    setRascunho("");
    onCancelarCitacao();
  }

  async function comecarGravacao() {
    const formato = formatoDeAudio();
    if (!formato || !navigator.mediaDevices?.getUserMedia) {
      avisar("erro", "Este navegador não grava áudio. Use o Chrome, o Edge ou o Firefox.");
      return;
    }
    try {
      const fluxo = await navigator.mediaDevices.getUserMedia({ audio: true });
      const gravador = new MediaRecorder(fluxo, { mimeType: formato });
      const contexto = new AudioContext();
      const analisador = contexto.createAnalyser();
      analisador.fftSize = 256;
      contexto.createMediaStreamSource(fluxo).connect(analisador);
      const atual: Gravacao = { gravador, fluxo, inicio: Date.now(), partes: [], cancelar: false, analisador, contexto };
      gravacao.current = atual;

      gravador.ondataavailable = (e) => e.data.size && atual.partes.push(e.data);
      gravador.onstop = () => {
        fluxo.getTracks().forEach((t) => t.stop());
        void contexto.close();
        const duracao = Math.round((Date.now() - atual.inicio) / 1000);
        if (!atual.cancelar && duracao >= 1) {
          void enviarMidia(new Blob(atual.partes, { type: gravador.mimeType }), "áudio", "", duracao);
        }
      };
      gravador.start(250);
      setGravando(true);
      setSegundos(0);
    } catch {
      avisar("erro", "Sem acesso ao microfone. Libere o microfone para este site no navegador.");
    }
  }

  function pararGravacao(cancelar: boolean) {
    const atual = gravacao.current;
    if (!atual) return;
    atual.cancelar = cancelar;
    if (atual.gravador.state !== "inactive") atual.gravador.stop();
    gravacao.current = null;
    setGravando(false);
    setNivel(0);
  }

  // Cronômetro e medidor de volume enquanto grava.
  useEffect(() => {
    if (!gravando) return;
    let quadro = 0;
    const dados = new Uint8Array(128);
    const medir = () => {
      const atual = gravacao.current;
      if (!atual) return;
      atual.analisador.getByteTimeDomainData(dados);
      let pico = 0;
      for (const v of dados) pico = Math.max(pico, Math.abs(v - 128));
      setNivel(Math.min(1, pico / 64));
      const s = (Date.now() - atual.inicio) / 1000;
      setSegundos(s);
      if (s >= DURACAO_MAXIMA) {
        pararGravacao(false);
        return;
      }
      quadro = requestAnimationFrame(medir);
    };
    quadro = requestAnimationFrame(medir);
    return () => cancelAnimationFrame(quadro);
  }, [gravando]);

  function escolheu(e: React.ChangeEvent<HTMLInputElement>, rotulo: string) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (arquivo) void enviarMidia(arquivo, rotulo, arquivo.name);
  }

  return (
    <div className="border-t border-hairline p-3">
      {viaWhatsapp && !whatsappNoAr && (
        <div className="mb-2 flex items-center gap-2 rounded-xl bg-caution/[0.1] px-3 py-2 text-[11.5px] text-caution">
          <WifiOff className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          WhatsApp desconectado. O que você mandar fica guardado e sai quando o bot voltar.
        </div>
      )}

      {citando && (
        <div className="mb-2 flex items-start gap-2 rounded-xl border-l-[3px] border-brand-500 bg-nivel-2 px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] font-semibold text-brand-400">Respondendo {QUEM[citando.origem].toLowerCase()}</p>
            <p className="line-clamp-1 text-[12px] text-fg-muted">{citando.texto || descreverMidia(citando.midia)}</p>
          </div>
          <button
            onClick={onCancelarCitacao}
            aria-label="Cancelar resposta"
            className="rounded-full p-1 text-fg-ghost transition-colors hover:bg-nivel-3 hover:text-fg"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
      )}

      {!gravando && (
        <div className="mb-2 flex items-center gap-2 px-1">
          <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-fg-ghost" strokeWidth={2} />
          <p className="text-[11px] text-fg-faint">Dúvida sobre dose, uso ou interação vai para o farmacêutico.</p>
        </div>
      )}

      {gravando ? (
        <div className="flex items-center gap-2 rounded-full border border-brand-500/40 bg-brand-500/[0.07] px-2 py-1.5">
          <button
            onClick={() => pararGravacao(true)}
            aria-label="Descartar áudio"
            className="flex h-8 w-8 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-nivel-3 hover:text-brand-400"
          >
            <Trash2 className="h-4 w-4" strokeWidth={2} />
          </button>
          <span className="h-2 w-2 animate-blink rounded-full bg-brand-500" aria-hidden />
          <span className="tnum font-mono text-[12.5px] text-fg" aria-live="polite">
            {tempo(segundos)}
          </span>
          <div className="flex h-6 flex-1 items-center gap-[3px] overflow-hidden" aria-hidden>
            {Array.from({ length: 28 }, (_, i) => {
              const onda = Math.sin(i * 0.9 + segundos * 6) * 0.5 + 0.5;
              return (
                <span
                  key={i}
                  className="w-[3px] rounded-full bg-brand-400 transition-[height] duration-100"
                  style={{ height: `${Math.max(12, (0.25 + nivel * 0.75) * onda * 100)}%` }}
                />
              );
            })}
          </div>
          <span className="hidden text-[11px] text-fg-ghost sm:inline">até 2 min</span>
          <button
            onClick={() => pararGravacao(false)}
            aria-label="Enviar áudio"
            className="btn-primary !h-8 !w-8 !p-0"
          >
            <SendHorizonal className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            enviarTexto();
          }}
          className="flex items-end gap-1 rounded-[22px] border border-hairline bg-nivel-2 px-1.5 py-1.5 transition-colors focus-within:border-brand-500/45"
        >
          <input ref={campoFoto} type="file" accept="image/*" className="hidden" onChange={(e) => escolheu(e, "foto")} />
          <input
            ref={campoArquivo}
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,image/*,video/mp4,audio/*"
            className="hidden"
            onChange={(e) => escolheu(e, "arquivo")}
          />
          <button
            type="button"
            onClick={() => campoFoto.current?.click()}
            disabled={Boolean(enviando)}
            aria-label="Enviar foto"
            title="Enviar foto"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-fg-faint transition-colors hover:bg-nivel-4 hover:text-fg disabled:opacity-40"
          >
            <ImagePlus className="h-[17px] w-[17px]" strokeWidth={1.9} />
          </button>
          <button
            type="button"
            onClick={() => campoArquivo.current?.click()}
            disabled={Boolean(enviando)}
            aria-label="Enviar arquivo"
            title="Enviar arquivo (PDF, documento, planilha)"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-fg-faint transition-colors hover:bg-nivel-4 hover:text-fg disabled:opacity-40"
          >
            <Paperclip className="h-[17px] w-[17px]" strokeWidth={1.9} />
          </button>
          <textarea
            ref={texto}
            rows={1}
            value={rascunho}
            onChange={(e) => setRascunho(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviarTexto();
              }
            }}
            aria-label="Escreva a mensagem"
            className="max-h-[120px] min-w-0 flex-1 resize-none bg-transparent px-2 py-1.5 text-[13px] leading-[1.45] text-fg outline-none placeholder:text-fg-ghost"
            placeholder={
              enviando
                ? `Enviando ${enviando}...`
                : comAtendente
                  ? "Escreva sua resposta"
                  : "Escreva para assumir e responder"
            }
          />
          {enviando ? (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center text-brand-400" aria-label="Enviando">
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
            </span>
          ) : rascunho.trim() ? (
            <button type="submit" aria-label="Enviar" className="btn-primary !h-8 !w-8 shrink-0 !p-0">
              <SendHorizonal className="h-4 w-4" strokeWidth={2} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void comecarGravacao()}
              aria-label="Gravar áudio"
              title="Gravar áudio"
              className={cn("btn-primary !h-8 !w-8 shrink-0 !p-0")}
            >
              <Mic className="h-4 w-4" strokeWidth={2} />
            </button>
          )}
        </form>
      )}
    </div>
  );
}
