"use client";

import { useEffect, useState } from "react";
import { tokenAtual } from "./db/local-db";
import { URL_NUVEM } from "./db/nuvem";
import { type Midia, tipoDaMidia } from "./db/types";

/**
 * Fotos, áudios e arquivos no painel.
 *
 * Tudo passa pela função `midia` do Supabase, que confere a sessão antes de
 * guardar ou entregar. Por isso a tela não usa `<img src>` direto: busca o
 * arquivo com o token no cabeçalho e mostra uma cópia local (blob). O link do
 * arquivo sozinho não abre nada para quem não está logado.
 */

const FUNCAO = `${URL_NUVEM}/functions/v1/midia`;
export const LIMITE_MIDIA = 16 * 1024 * 1024;

/**
 * Foto de celular chega com 4 a 8 MB. Reduzida para 1600 px no lado maior, em
 * JPEG, fica com poucas centenas de KB e continua legível, inclusive uma
 * receita. Poupa a franquia do banco e o pacote de dados de quem recebe.
 */
async function comprimirFoto(arquivo: File): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(arquivo.type) || arquivo.size < 400 * 1024) return arquivo;
  try {
    const bitmap = await createImageBitmap(arquivo);
    const escala = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.82));
    return blob && blob.size < arquivo.size ? blob : arquivo;
  } catch {
    return arquivo;
  }
}

export type ResultadoEnvio = { ok: true; midia: Midia } | { ok: false; erro: string };

/** Guarda um arquivo da loja e devolve a referência para pôr na mensagem. */
export async function enviarArquivo(
  lojaId: string,
  arquivo: File | Blob,
  nome = "",
  duracao?: number,
): Promise<ResultadoEnvio> {
  const token = tokenAtual();
  if (!token) return { ok: false, erro: "Sessão encerrada. Entre de novo." };

  const corpo = arquivo instanceof File && arquivo.type.startsWith("image/") ? await comprimirFoto(arquivo) : arquivo;
  if (corpo.size > LIMITE_MIDIA) return { ok: false, erro: "O arquivo passa de 16 MB, o limite do WhatsApp." };
  const mime = corpo.type || "application/octet-stream";

  try {
    const resposta = await fetch(`${FUNCAO}?loja=${encodeURIComponent(lojaId)}`, {
      method: "POST",
      headers: { "content-type": mime, "x-sessao": token },
      body: corpo,
    });
    const r = (await resposta.json().catch(() => ({}))) as {
      ok?: boolean;
      erro?: string;
      caminho?: string;
      tamanho?: number;
    };
    if (!r.ok || !r.caminho) return { ok: false, erro: r.erro ?? "Não foi possível enviar o arquivo." };
    const base = mime.split(";")[0];
    return {
      ok: true,
      midia: {
        caminho: r.caminho,
        tipo: tipoDaMidia(base),
        mime: base,
        nome: nome || (arquivo instanceof File ? arquivo.name : ""),
        tamanho: r.tamanho ?? corpo.size,
        ...(duracao ? { duracao } : {}),
      },
    };
  } catch {
    return { ok: false, erro: "Sem conexão para enviar o arquivo." };
  }
}

/* Cópias locais já baixadas nesta aba. O caminho nunca muda de conteúdo. */
const cache = new Map<string, Promise<string | null>>();

function baixar(caminho: string) {
  let pedido = cache.get(caminho);
  if (!pedido) {
    pedido = (async () => {
      const token = tokenAtual();
      if (!token) return null;
      try {
        const resposta = await fetch(`${FUNCAO}?c=${encodeURIComponent(caminho)}`, {
          headers: { "x-sessao": token },
        });
        if (!resposta.ok) return null;
        return URL.createObjectURL(await resposta.blob());
      } catch {
        return null;
      }
    })();
    cache.set(caminho, pedido);
    // Falhou: esquece, para a próxima tentativa buscar de novo.
    void pedido.then((url) => {
      if (!url) cache.delete(caminho);
    });
  }
  return pedido;
}

/** O endereço local de uma mídia, quando terminar de baixar. */
export function useMidiaUrl(caminho: string | undefined) {
  const [estado, setEstado] = useState<{ caminho: string; url: string | null; falhou: boolean } | null>(null);

  useEffect(() => {
    if (!caminho) return;
    let vivo = true;
    void baixar(caminho).then((url) => {
      if (vivo) setEstado({ caminho, url, falhou: !url });
    });
    return () => {
      vivo = false;
    };
  }, [caminho]);

  const atual = estado && estado.caminho === caminho ? estado : null;
  return { url: atual?.url ?? null, carregando: Boolean(caminho) && !atual, falhou: atual?.falhou ?? false };
}

export function tamanhoLegivel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

export function descreverMidia(midia: Midia | null) {
  if (!midia) return "";
  if (midia.tipo === "imagem") return "Foto";
  if (midia.tipo === "audio") return "Áudio";
  if (midia.tipo === "video") return "Vídeo";
  return midia.nome || "Arquivo";
}
