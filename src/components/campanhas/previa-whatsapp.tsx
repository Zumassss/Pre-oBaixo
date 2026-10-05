"use client";

import { Fragment } from "react";
import { ArrowLeft, ImageIcon, Mic, Phone, Video } from "lucide-react";
import type { Midia } from "@/lib/db/types";
import { useMidiaUrl } from "@/lib/midia";
import { RODAPE_SAIR } from "@/lib/campanhas";
import { cn } from "@/lib/utils";

/**
 * A formatação do WhatsApp: *negrito*, _itálico_, ~riscado~ e ```mono```.
 * Só o que o aplicativo entende; o resto aparece como foi digitado, igual
 * vai aparecer no celular do cliente.
 */
export function TextoWhatsapp({ texto }: { texto: string }) {
  const linhas = texto.split("\n");
  return (
    <>
      {linhas.map((linha, i) => (
        <Fragment key={i}>
          {formatarLinha(linha)}
          {i < linhas.length - 1 && <br />}
        </Fragment>
      ))}
    </>
  );
}

const MARCAS = /(```[^`]+```|\*[^*\s][^*]*?\*|_[^_\s][^_]*?_|~[^~\s][^~]*?~)/g;

function formatarLinha(linha: string) {
  const partes = linha.split(MARCAS);
  return partes.map((p, i) => {
    if (i % 2 === 0) return p;
    if (p.startsWith("```")) return <code key={i} className="font-mono text-[0.92em]">{p.slice(3, -3)}</code>;
    const miolo = p.slice(1, -1);
    if (p[0] === "*") return <strong key={i} className="font-semibold">{miolo}</strong>;
    if (p[0] === "_") return <em key={i}>{miolo}</em>;
    return <s key={i}>{miolo}</s>;
  });
}

function Imagem({ midia, local }: { midia: Midia | null; local?: string | null }) {
  const { url, carregando } = useMidiaUrl(local ? undefined : midia?.caminho);
  const fonte = local ?? url;
  if (!midia && !local) return null;
  return (
    <div className="-mx-[3px] -mt-[3px] mb-1 overflow-hidden rounded-[7px] bg-black/10">
      {fonte ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={fonte} alt="Imagem da campanha" className="block max-h-[260px] w-full object-cover" />
      ) : (
        <div className={cn("flex h-[160px] items-center justify-center", carregando && "animate-pulse")}>
          <ImageIcon className="h-6 w-6 text-[var(--wa-meta)]" strokeWidth={1.6} />
        </div>
      )}
    </div>
  );
}

/**
 * Um celular com a conversa do cliente aberta, mostrando a campanha como ela
 * chega: o nome e a foto da loja no topo, a imagem, o texto já com o nome
 * do cliente e a linha de saída que vai em toda campanha.
 *
 * As cores são as do próprio WhatsApp, no tema escuro e no claro. É o único
 * lugar do sistema que foge da paleta da marca, e foge de propósito: a
 * prévia só serve se parecer com o que o cliente vê.
 */
export function PreviaWhatsapp({
  loja,
  texto,
  imagem,
  imagemLocal,
  hora,
  vazio = "A mensagem aparece aqui enquanto você escreve.",
}: {
  loja: string;
  texto: string;
  imagem: Midia | null;
  imagemLocal?: string | null;
  hora: string;
  vazio?: string;
}) {
  const iniciais = loja
    .split(/\s+/)
    .filter((p) => p.length > 2 || /^\d+$/.test(p))
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <div
      className="mx-auto w-full max-w-[340px] rounded-[2.4rem] border border-hairline-strong bg-nivel-1 p-2 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.6)]"
      aria-label="Prévia da mensagem no WhatsApp do cliente"
      role="figure"
    >
      <div className="overflow-hidden rounded-[2rem]">
        {/* Topo da conversa */}
        <div className="flex items-center gap-2.5 bg-[var(--wa-topo)] px-3 pb-2.5 pt-4 text-[var(--wa-texto)]">
          <ArrowLeft className="h-4 w-4 opacity-80" strokeWidth={2} />
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500 text-[11px] font-bold text-white">
            {iniciais || "PB"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-medium leading-tight">{loja}</p>
            <p className="text-[10.5px] leading-tight text-[var(--wa-meta)]">Conta comercial</p>
          </div>
          <Video className="h-4 w-4 opacity-70" strokeWidth={2} />
          <Phone className="h-3.5 w-3.5 opacity-70" strokeWidth={2} />
        </div>

        {/* Conversa */}
        <div
          className="flex min-h-[420px] flex-col justify-end gap-2 px-2.5 py-4"
          style={{
            backgroundColor: "var(--wa-fundo)",
            backgroundImage:
              "radial-gradient(var(--wa-desenho) 1.2px, transparent 1.4px), radial-gradient(var(--wa-desenho) 1.2px, transparent 1.4px)",
            backgroundSize: "22px 22px",
            backgroundPosition: "0 0, 11px 11px",
          }}
        >
          <p className="mx-auto rounded-md bg-[var(--wa-topo)] px-2 py-0.5 text-[10.5px] text-[var(--wa-meta)]">Hoje</p>
          {texto.trim() || imagem || imagemLocal ? (
            <div
              className="relative max-w-[88%] self-start rounded-lg rounded-tl-none bg-[var(--wa-bolha)] p-[6px] pb-[5px] text-[13.5px] leading-[1.38] text-[var(--wa-texto)] shadow-[0_1px_0.5px_rgba(0,0,0,0.13)]"
              style={{ animation: "fade-in 0.25s ease both" }}
            >
              {/* Bico da bolha */}
              <svg aria-hidden viewBox="0 0 8 13" className="absolute -left-[8px] top-0 h-[13px] w-[8px]" fill="var(--wa-bolha)">
                <path d="M1.5 0H8v13L.8 2.6C.1 1.5.4 0 1.5 0z" />
              </svg>
              <Imagem midia={imagem} local={imagemLocal} />
              <div className="whitespace-pre-wrap break-words px-[3px]">
                <TextoWhatsapp texto={texto.trim()} />
                <span className="mt-2 block text-[12px] text-[var(--wa-meta)]">{RODAPE_SAIR}</span>
              </div>
              <span className="float-right -mb-0.5 ml-3 mt-0.5 flex items-center gap-1 text-[10.5px] text-[var(--wa-meta)]">
                {hora}
              </span>
              <span className="clear-both block" />
            </div>
          ) : (
            <p className="mx-auto max-w-[220px] text-center text-[12px] leading-relaxed text-[var(--wa-meta)]">{vazio}</p>
          )}
        </div>

        {/* Campo de resposta do cliente, só para a cena ficar completa. */}
        <div className="flex items-center gap-2 px-2 py-2" style={{ backgroundColor: "var(--wa-fundo)" }} aria-hidden>
          <div className="flex-1 rounded-full bg-[var(--wa-topo)] px-4 py-2 text-[12.5px] text-[var(--wa-meta)]">Mensagem</div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#00a884] text-white">
            <Mic className="h-4 w-4" strokeWidth={2.2} />
          </div>
        </div>
      </div>
    </div>
  );
}
