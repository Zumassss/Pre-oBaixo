/**
 * Fotos, áudios e arquivos entre o WhatsApp e o painel.
 *
 * O arquivo vai para o armazenamento da loja pela função `midia` do
 * Supabase, identificada pela chave do bot. O painel lê pelo mesmo caminho,
 * com a sessão de quem está logado.
 *
 * Áudio gravado no painel sai do navegador em webm ou mp4. O WhatsApp só
 * mostra como mensagem de voz (com a onda e o play) se for ogg/opus, então o
 * bot converte com o ffmpeg antes de mandar.
 */
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpeg from "ffmpeg-static";
import { URL_NUVEM } from "../src/lib/db/nuvem.ts";
import { CHAVE } from "./banco.js";

const FUNCAO = `${URL_NUVEM}/functions/v1/midia`;

export async function guardarMidia(lojaId, buffer, mime) {
  const resposta = await fetch(`${FUNCAO}?loja=${encodeURIComponent(lojaId)}`, {
    method: "POST",
    headers: { "content-type": mime, "x-bot": CHAVE },
    body: buffer,
  });
  const r = await resposta.json().catch(() => ({ ok: false }));
  if (!r.ok) throw new Error(`não guardou a mídia: ${r.erro ?? resposta.status}`);
  return r.caminho;
}

export async function baixarMidia(caminho) {
  const resposta = await fetch(`${FUNCAO}?c=${encodeURIComponent(caminho)}`, {
    headers: { "x-bot": CHAVE },
  });
  if (!resposta.ok) throw new Error(`não baixou a mídia: ${resposta.status}`);
  return Buffer.from(await resposta.arrayBuffer());
}

/** Converte qualquer áudio para ogg/opus, o formato de mensagem de voz. */
export async function paraVoz(buffer) {
  const pasta = await mkdtemp(join(tmpdir(), "voz-"));
  try {
    const entrada = join(pasta, "entrada");
    const saida = join(pasta, "saida.ogg");
    await writeFile(entrada, buffer);
    await new Promise((ok, falha) =>
      execFile(
        ffmpeg,
        ["-y", "-i", entrada, "-vn", "-c:a", "libopus", "-b:a", "32k", "-ac", "1", "-ar", "48000", saida],
        { timeout: 60000 },
        (erro) => (erro ? falha(erro) : ok()),
      ),
    );
    return await readFile(saida);
  } finally {
    await rm(pasta, { recursive: true, force: true });
  }
}
