/**
 * Fotos, áudios e arquivos das lojas.
 *
 * Os arquivos ficam num balde privado (`midia`). Ninguém lê o balde direto:
 * tudo passa por aqui, e aqui se pergunta ao banco (função `acesso_midia`)
 * se quem está pedindo pode ver aquela loja. Quem pede se identifica pelo
 * token de sessão do painel (`x-sessao`) ou pela chave do bot (`x-bot`).
 *
 * A chave de serviço só existe dentro do Supabase. Não vai para o site,
 * nem para o bot, nem para o repositório.
 *
 * POST /midia?loja=<id>   corpo = o arquivo, content-type = o tipo dele
 * GET  /midia?c=<caminho> devolve o arquivo
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;
const CHAVE_SERVICO =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}")["default"];

const banco = createClient(URL_SUPABASE, CHAVE_SERVICO, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BALDE = "midia";
const LIMITE = 16 * 1024 * 1024;

/** O que a loja pode guardar. Executável e página da web ficam de fora. */
const TIPOS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "audio/ogg": ".ogg",
  "audio/mpeg": ".mp3",
  "audio/mp4": ".m4a",
  "audio/webm": ".webm",
  "audio/aac": ".aac",
  "video/mp4": ".mp4",
  "application/pdf": ".pdf",
  "text/plain": ".txt",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "content-type, x-sessao, x-bot, x-nome, apikey, authorization, x-client-info",
  "Access-Control-Max-Age": "86400",
};

function json(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

async function podeVer(req: Request, loja: string) {
  if (!/^[a-z0-9-]{1,80}$/i.test(loja)) return false;
  const { data, error } = await banco.rpc("acesso_midia", {
    p_token: req.headers.get("x-sessao") ?? "",
    p_chave: req.headers.get("x-bot") ?? "",
    p_loja: loja,
  });
  return !error && data === true;
}

/** "audio/ogg; codecs=opus" vira "audio/ogg". */
function tipoBase(tipo: string | null) {
  return (tipo ?? "").split(";")[0].trim().toLowerCase();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const url = new URL(req.url);

  if (req.method === "POST") {
    const loja = url.searchParams.get("loja") ?? "";
    if (!(await podeVer(req, loja))) return json({ ok: false, erro: "Sem acesso." }, 403);

    const tipo = tipoBase(req.headers.get("content-type"));
    const extensao = TIPOS[tipo];
    if (!extensao) return json({ ok: false, erro: "Tipo de arquivo não aceito." }, 415);

    const corpo = new Uint8Array(await req.arrayBuffer());
    if (corpo.byteLength === 0) return json({ ok: false, erro: "Arquivo vazio." }, 400);
    if (corpo.byteLength > LIMITE) {
      return json({ ok: false, erro: "Arquivo maior que 16 MB." }, 413);
    }

    const mes = new Date().toISOString().slice(0, 7);
    const caminho = `${loja}/${mes}/${crypto.randomUUID()}${extensao}`;
    const { error } = await banco.storage.from(BALDE).upload(caminho, corpo, {
      contentType: req.headers.get("content-type") ?? tipo,
      upsert: false,
    });
    if (error) return json({ ok: false, erro: "Não foi possível guardar o arquivo." }, 500);

    return json({ ok: true, caminho, tipo, tamanho: corpo.byteLength });
  }

  if (req.method === "GET") {
    const caminho = url.searchParams.get("c") ?? "";
    if (!/^[a-z0-9-]+\/\d{4}-\d{2}\/[0-9a-f-]{36}\.[a-z0-9]{2,5}$/i.test(caminho)) {
      return json({ ok: false, erro: "Caminho inválido." }, 400);
    }
    const loja = caminho.split("/")[0];
    if (!(await podeVer(req, loja))) return json({ ok: false, erro: "Sem acesso." }, 403);

    const { data, error } = await banco.storage.from(BALDE).download(caminho);
    if (error || !data) return json({ ok: false, erro: "Arquivo não encontrado." }, 404);

    return new Response(data, {
      headers: {
        ...CORS,
        "Content-Type": data.type || "application/octet-stream",
        // O caminho nunca muda de conteúdo: a tela pode guardar à vontade,
        // mas só no navegador de quem tem acesso.
        "Cache-Control": "private, max-age=86400, immutable",
      },
    });
  }

  return json({ ok: false, erro: "Método não aceito." }, 405);
});
