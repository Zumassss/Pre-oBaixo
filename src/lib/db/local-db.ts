"use client";

import { rpc } from "./nuvem";
import {
  type Banco,
  bancoVazio,
  completarDados,
  type DadosLoja,
  type Loja,
  type Sessao,
  type Usuario,
} from "./types";

/**
 * Sincronização com a nuvem.
 *
 * O nome do arquivo ficou da época em que tudo morava no navegador. Hoje o
 * dono dos dados é o banco na nuvem, e este módulo mantém uma cópia local
 * para a tela responder na hora.
 *
 * O modelo, em uma frase: a tela mostra o último estado confirmado pelo
 * servidor (`base`) com as mudanças ainda não confirmadas (`pendentes`)
 * aplicadas por cima.
 *
 * Toda mudança é uma FUNÇÃO do banco para o banco, não um valor pronto. Isso
 * é o que resolve conflito: se o bot do WhatsApp gravou uma conversa no meio
 * do caminho, o servidor recusa a gravação pela versão, a gente relê o
 * estado novo e aplica a mesma função de novo. A conversa do bot fica, a
 * mudança da tela também, e ninguém apaga o trabalho de ninguém.
 */

type Mudanca = (banco: Banco) => Banco;
type Ouvinte = (banco: Banco) => void;

const CHAVE_TOKEN = "preco-baixo:token";
const CHAVE_LOJA = "preco-baixo:loja-selecionada";
/** De quanto em quanto tempo a tela pergunta se algo mudou no servidor. */
const INTERVALO_CONSULTA = 4000;

const ouvintes = new Set<Ouvinte>();

/** Último estado confirmado pelo servidor, sem a sessão. */
let base: Banco = bancoVazio();
let versaoRede = 0;
let versoesLojas: Record<string, number> = {};

/** A sessão é só deste navegador: qual loja o admin está olhando. */
let sessao: Sessao | null = null;
let token: string | null = null;

let pendentes: Mudanca[] = [];
let cache: Banco = bancoVazio();

let estado: "parado" | "iniciando" | "pronto" = "parado";
let fila: Promise<void> = Promise.resolve();
let consulta: ReturnType<typeof setInterval> | null = null;
let falhaDeGravacao = false;

function ehServidor() {
  return typeof window === "undefined";
}

function lerArmazenado(chave: string) {
  try {
    return window.localStorage.getItem(chave);
  } catch {
    return null;
  }
}

function gravarArmazenado(chave: string, valor: string | null) {
  try {
    if (valor === null) window.localStorage.removeItem(chave);
    else window.localStorage.setItem(chave, valor);
  } catch {
    // Modo privado: a sessão vale até fechar a aba, e tudo bem.
  }
}

/** Recalcula o que a tela mostra e avisa quem estiver ouvindo. */
function recompor() {
  const comSessao: Banco = { ...base, sessao };
  cache = pendentes.reduce((estadoAtual, mudanca) => mudanca(estadoAtual), comSessao);
  ouvintes.forEach((ouvinte) => ouvinte(cache));
}

/* ------------------------------------------------------------------
   Leitura
   ------------------------------------------------------------------ */

export function lerBanco(): Banco {
  return cache;
}

export function estaPronto() {
  return estado === "pronto";
}

/** Se a última tentativa de salvar falhou por falta de conexão. */
export function temFalhaDeGravacao() {
  return falhaDeGravacao;
}

export function inscrever(ouvinte: Ouvinte) {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

type RespostaRede = {
  ok: boolean;
  erro?: string;
  usuario: Usuario;
  lojas: Loja[];
  versaoRede: number;
  dados: Record<string, { dados: DadosLoja; versao: number }>;
};

/** Baixa tudo o que esta sessão pode ver e troca a base. */
async function baixarRede(): Promise<"ok" | "sessao" | "rede"> {
  if (!token) return "sessao";
  const r = await rpc<RespostaRede & { ok: boolean }>("ler_rede", { p_token: token });

  if (!r.ok) return r.erro === "sessao" ? "sessao" : "rede";

  const dados: Record<string, DadosLoja> = {};
  const versoes: Record<string, number> = {};
  for (const [id, bloco] of Object.entries(r.dados ?? {})) {
    dados[id] = completarDados(bloco.dados);
    versoes[id] = bloco.versao;
  }

  base = { usuarios: [r.usuario], lojas: r.lojas ?? [], dados, sessao: null };
  versaoRede = r.versaoRede ?? 0;
  versoesLojas = versoes;

  // A loja aberta: quem opera uma loja fica na dele; o admin volta para a
  // última que estava olhando neste navegador.
  const lembrada = lerArmazenado(CHAVE_LOJA);
  const lojaSelecionada =
    r.usuario.papel === "loja"
      ? (r.usuario.lojaId ?? "")
      : base.lojas.some((l) => l.id === sessao?.lojaSelecionada)
        ? (sessao?.lojaSelecionada ?? "")
        : base.lojas.some((l) => l.id === lembrada)
          ? (lembrada ?? "")
          : (base.lojas[0]?.id ?? "");

  sessao = { usuarioId: r.usuario.id, lojaSelecionada, em: sessao?.em ?? Date.now() };
  return "ok";
}

function encerrarLocalmente() {
  token = null;
  sessao = null;
  base = bancoVazio();
  pendentes = [];
  versaoRede = 0;
  versoesLojas = {};
  gravarArmazenado(CHAVE_TOKEN, null);
  pararConsulta();
  recompor();
}

/* ------------------------------------------------------------------
   Consulta periódica
   ------------------------------------------------------------------ */

/**
 * Pergunta ao servidor se algo mudou.
 *
 * A pergunta é só pelos números de versão, que é barato. A rede inteira só
 * é baixada quando um número mudou: é assim que a conversa que o bot gravou
 * aparece no painel sem ninguém apertar F5.
 */
async function verificarMudancas() {
  if (!token || pendentes.length > 0) return;
  if (!ehServidor() && document.visibilityState === "hidden") return;

  const r = await rpc<{
    ok: boolean;
    erro?: string;
    versaoRede: number;
    lojas: Record<string, number>;
  }>("versoes", { p_token: token });

  if (!r.ok) {
    if (r.erro === "sessao") encerrarLocalmente();
    return;
  }

  const mudouRede = (r.versaoRede ?? 0) !== versaoRede;
  const lojas = r.lojas ?? {};
  const mudouLoja =
    Object.keys(lojas).length !== Object.keys(versoesLojas).length ||
    Object.entries(lojas).some(([id, v]) => versoesLojas[id] !== v);

  // Se uma mudança local entrou enquanto a pergunta viajava, esperamos a
  // próxima volta: baixar agora atropelaria o que acabou de ser feito.
  if ((mudouRede || mudouLoja) && pendentes.length === 0) {
    const resultado = await baixarRede();
    if (resultado === "sessao") encerrarLocalmente();
    else if (pendentes.length === 0) recompor();
  }
}

function iniciarConsulta() {
  if (ehServidor() || consulta) return;
  consulta = setInterval(verificarMudancas, INTERVALO_CONSULTA);
  window.addEventListener("focus", verificarMudancas);
}

function pararConsulta() {
  if (consulta) clearInterval(consulta);
  consulta = null;
  if (!ehServidor()) window.removeEventListener("focus", verificarMudancas);
}

/**
 * Começa a sincronizar. Chamada uma vez, quando a primeira tela monta.
 * Chamar de novo não faz nada.
 */
export async function iniciarSincronizacao() {
  if (ehServidor() || estado !== "parado") return;
  estado = "iniciando";

  token = lerArmazenado(CHAVE_TOKEN);
  if (token) {
    const resultado = await baixarRede();
    if (resultado === "sessao") encerrarLocalmente();
    else if (resultado === "ok") iniciarConsulta();
  }

  estado = "pronto";
  recompor();
}

/* ------------------------------------------------------------------
   Acesso
   ------------------------------------------------------------------ */

export async function entrarNoServidor(
  usuario: string,
  senha: string,
): Promise<{ ok: true; usuario: Usuario } | { ok: false; erro: string }> {
  const r = await rpc<{ ok: boolean; erro?: string; token?: string; usuario?: Usuario }>(
    "entrar",
    { p_usuario: usuario, p_senha: senha },
  );

  if (!r.ok || !r.token || !r.usuario) {
    return {
      ok: false,
      erro:
        r.erro === "rede" || r.erro?.startsWith("http")
          ? "Sem conexão com o servidor. Confira a internet e tente de novo."
          : (r.erro ?? "Não foi possível entrar."),
    };
  }

  token = r.token;
  gravarArmazenado(CHAVE_TOKEN, token);
  sessao = null;

  const resultado = await baixarRede();
  if (resultado !== "ok") {
    encerrarLocalmente();
    return { ok: false, erro: "Entrou, mas não conseguiu carregar os dados. Tente de novo." };
  }

  iniciarConsulta();
  recompor();
  return { ok: true, usuario: r.usuario };
}

export function sairDoServidor() {
  const antigo = token;
  encerrarLocalmente();
  if (antigo) void rpc("sair", { p_token: antigo });
}

/** Muda só a sessão deste navegador. Não vai para o servidor. */
export function atualizarSessao(mudanca: (atual: Sessao | null, banco: Banco) => Sessao | null) {
  sessao = mudanca(sessao, cache);
  if (sessao?.lojaSelecionada) gravarArmazenado(CHAVE_LOJA, sessao.lojaSelecionada);
  recompor();
}

/* ------------------------------------------------------------------
   Gravação
   ------------------------------------------------------------------ */

/**
 * Tenta gravar uma mudança no servidor.
 *
 * Calcula a mudança em cima da base confirmada, manda só o que mudou (a
 * lista de lojas e/ou o bloco de cada loja tocada) e, se o servidor
 * recusar por versão velha, relê e tenta de novo.
 */
async function sincronizar(mudanca: Mudanca): Promise<"ok" | "rede" | "sessao"> {
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    if (!token) return "sessao";

    const antes: Banco = { ...base, sessao };
    const depois = mudanca(antes);
    let conflito = false;

    if (depois.lojas !== antes.lojas) {
      const r = await rpc<{ ok: boolean; erro?: string; conflito?: boolean; versao?: number }>(
        "gravar_lojas",
        { p_token: token, p_lojas: depois.lojas, p_versao: versaoRede },
      );
      if (r.ok) {
        versaoRede = r.versao ?? versaoRede + 1;
        base = { ...base, lojas: depois.lojas };
      } else if (r.conflito) {
        conflito = true;
      } else {
        return r.erro === "sessao" ? "sessao" : "rede";
      }
    }

    if (!conflito) {
      for (const id of Object.keys(depois.dados)) {
        if (depois.dados[id] === antes.dados[id]) continue;
        const r = await rpc<{ ok: boolean; erro?: string; conflito?: boolean; versao?: number }>(
          "gravar_dados",
          {
            p_token: token,
            p_loja_id: id,
            p_dados: depois.dados[id],
            p_versao: versoesLojas[id] ?? 0,
          },
        );
        if (r.ok) {
          versoesLojas = { ...versoesLojas, [id]: r.versao ?? 1 };
          base = { ...base, dados: { ...base.dados, [id]: depois.dados[id] } };
        } else if (r.conflito) {
          conflito = true;
          break;
        } else {
          return r.erro === "sessao" ? "sessao" : "rede";
        }
      }
    }

    if (!conflito) return "ok";

    // Alguém gravou antes. Relê e a próxima volta reaplica a mesma mudança
    // em cima do estado novo.
    const releitura = await baixarRede();
    if (releitura !== "ok") return releitura;
  }
  return "rede";
}

/**
 * Aplica uma mudança: na tela na hora, no servidor em seguida.
 *
 * As gravações entram numa fila e saem uma de cada vez, na ordem em que
 * foram feitas. Sem a fila, duas mudanças rápidas sairiam com a mesma
 * versão e a segunda seria sempre recusada.
 */
export function atualizarBanco(mudanca: Mudanca): Banco {
  pendentes = [...pendentes, mudanca];
  recompor();

  fila = fila.then(async () => {
    let resultado = await sincronizar(mudanca);

    // Sem conexão: espera e tenta de novo, sem perder a mudança. Ela continua
    // visível na tela enquanto isso.
    for (let espera = 2000; resultado === "rede" && espera <= 16000; espera *= 2) {
      falhaDeGravacao = true;
      recompor();
      await new Promise((r) => setTimeout(r, espera));
      resultado = await sincronizar(mudanca);
    }

    falhaDeGravacao = resultado === "rede";
    pendentes = pendentes.filter((m) => m !== mudanca);

    if (resultado === "sessao") encerrarLocalmente();
    else recompor();
  });

  return cache;
}

export function novoId(prefixo: string) {
  return `${prefixo}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
