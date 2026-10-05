"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FileText, ImageOff, Pause, Play, X } from "lucide-react";
import type { Midia } from "@/lib/db/types";
import { tamanhoLegivel, useMidiaUrl } from "@/lib/midia";
import { cn } from "@/lib/utils";

function tempo(segundos: number) {
  if (!Number.isFinite(segundos) || segundos < 0) return "0:00";
  const m = Math.floor(segundos / 60);
  const s = Math.floor(segundos % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Tocador de áudio, igual em todo navegador e nos dois temas. */
function Audio({ url, duracao, deMim }: { url: string; duracao?: number; deMim: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [tocando, setTocando] = useState(false);
  const [atual, setAtual] = useState(0);
  const [total, setTotal] = useState(duracao ?? 0);

  return (
    <div className="flex w-[240px] max-w-full items-center gap-2.5">
      <audio
        ref={ref}
        src={url}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setTotal(d);
        }}
        onTimeUpdate={(e) => setAtual(e.currentTarget.currentTime)}
        onPlay={() => setTocando(true)}
        onPause={() => setTocando(false)}
        onEnded={() => {
          setTocando(false);
          setAtual(0);
        }}
      />
      <button
        type="button"
        onClick={() => (tocando ? ref.current?.pause() : void ref.current?.play())}
        aria-label={tocando ? "Pausar áudio" : "Ouvir áudio"}
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95",
          deMim ? "bg-white/20 text-white" : "bg-brand-500 text-white",
        )}
      >
        {tocando ? (
          <Pause className="h-4 w-4" strokeWidth={2.2} />
        ) : (
          <Play className="ml-0.5 h-4 w-4" strokeWidth={2.2} />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <input
          type="range"
          min={0}
          max={total || 1}
          step={0.1}
          value={atual}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (ref.current) ref.current.currentTime = v;
            setAtual(v);
          }}
          aria-label="Posição do áudio"
          className={cn("faixa-audio w-full", deMim && "faixa-audio-clara")}
        />
        <p className={cn("tnum mt-0.5 font-mono text-[10.5px]", deMim ? "text-white/75" : "text-fg-ghost")}>
          {tempo(tocando || atual > 0 ? atual : total)}
        </p>
      </div>
    </div>
  );
}

/** Foto em tela cheia. Fecha no Esc, no X ou clicando fora. */
function Ampliada({ url, nome, onFechar }: { url: string; nome: string; onFechar: () => void }) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onFechar]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Foto ampliada"
      onClick={onFechar}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      style={{ animation: "fade-in 0.2s ease-out both" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={nome || "Foto enviada na conversa"}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] max-w-full rounded-2xl object-contain shadow-2xl"
      />
      <div className="absolute right-4 top-4 flex gap-2">
        <a
          href={url}
          download={nome || "foto.jpg"}
          onClick={(e) => e.stopPropagation()}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25"
          aria-label="Baixar foto"
        >
          <Download className="h-4 w-4" strokeWidth={2} />
        </a>
        <button
          onClick={onFechar}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

/**
 * Uma mídia dentro da bolha da mensagem.
 *
 * `deMim` é a bolha preenchida (agente ou equipe), onde o texto é claro.
 */
export function VisualMidia({ midia, deMim = false }: { midia: Midia; deMim?: boolean }) {
  const { url, carregando, falhou } = useMidiaUrl(midia.caminho);
  const [ampliada, setAmpliada] = useState(false);

  if (carregando) {
    return (
      <div
        className={cn(
          "animate-pulse rounded-xl",
          midia.tipo === "imagem" ? "h-[180px] w-[220px]" : "h-10 w-[220px]",
          deMim ? "bg-white/15" : "bg-nivel-4",
        )}
        aria-label="Carregando arquivo"
      />
    );
  }

  if (falhou || !url) {
    return (
      <div className={cn("flex items-center gap-2 text-[12px]", deMim ? "text-white/80" : "text-fg-faint")}>
        <ImageOff className="h-4 w-4" strokeWidth={2} />
        Não foi possível abrir o arquivo.
      </div>
    );
  }

  if (midia.tipo === "imagem") {
    return (
      <>
        <button
          type="button"
          onClick={() => setAmpliada(true)}
          className="block overflow-hidden rounded-xl"
          aria-label="Ampliar foto"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={midia.nome || "Foto enviada na conversa"}
            className="max-h-[260px] w-auto max-w-[260px] object-cover transition-transform duration-300 hover:scale-[1.02]"
          />
        </button>
        {ampliada && <Ampliada url={url} nome={midia.nome} onFechar={() => setAmpliada(false)} />}
      </>
    );
  }

  if (midia.tipo === "audio") return <Audio url={url} duracao={midia.duracao} deMim={deMim} />;

  if (midia.tipo === "video") {
    return <video src={url} controls preload="metadata" className="max-h-[260px] max-w-[300px] rounded-xl" />;
  }

  return (
    <a
      href={url}
      download={midia.nome || "arquivo"}
      className={cn(
        "flex w-[240px] max-w-full items-center gap-2.5 rounded-xl p-2.5 transition-colors",
        deMim ? "bg-white/15 hover:bg-white/25" : "bg-nivel-2 ring-1 ring-inset ring-anel hover:bg-nivel-4",
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          deMim ? "bg-white/20 text-white" : "bg-brand-500/12 text-brand-400",
        )}
      >
        <FileText className="h-4 w-4" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-[12.5px] font-medium", deMim ? "text-white" : "text-fg")}>
          {midia.nome || "Arquivo"}
        </span>
        <span className={cn("block text-[10.5px]", deMim ? "text-white/75" : "text-fg-ghost")}>
          {tamanhoLegivel(midia.tamanho)} · baixar
        </span>
      </span>
      <Download className={cn("h-4 w-4 shrink-0", deMim ? "text-white/80" : "text-fg-ghost")} strokeWidth={2} />
    </a>
  );
}
