"use client";

import { rpc } from "./nuvem";
import { type EstadoReplica, type Registro, Replica, type ResultadoGravacao } from "./sincronia";
import { type Banco, bancoVazio, type Sessao, type Usuario } from "./types";

/**
 * Sincronização do site com a nuvem.
 *
 * O nome do arquivo ficou da época em que tudo morava no navegador. Hoje o
 * dono dos dados é o banco, e este módulo mantém uma réplica local (ver
 * `sincronia.ts`) para a tela responder na hora.
 *
 * A tela mostra o último estado confirmado com as mudanças ainda não
 * confirmadas (`pendentes`) aplicadas por cima. Cada mudança é uma função do
 * banco para o banco: se outra tela ou o bot gravou no meio do caminho, a
 * réplica relê só os itens em conflito e aplica a mesma função de novo.
 * Ninguém apaga o trabalho de ninguém.
 *
 * A cada 2,5 segundos a tela pergunta "o que mudou depois do número X?" e
 * recebe só os registros novos. Não baixa a loja inteira de novo.
 */

type Mudanca = (banco: Banco) => Banco;
type Ouvinte = (banco: Banco) => void;

const CHAVE_TOKEN = "preco-baixo:token";
const CHAVE_LOJA = "preco-baixo:loja-selecionada";
/** De quanto em quanto tempo a tela pergunta se algo mudou no servidor. */
const INTERVALO_CONSULTA = 2500;

const ouvintes = new Set<Ouvinte>();

let token: string | null = null;
let usuario: Usuario | null = null;
/** A sessão é só deste navegador: qual loja o admin está olhando. */
let sessao: Sessao | null = null;
/** Até quando a área de ajustes está aberta (milissegundos). */
let ajustesAte = 0;

const replica = new Replica({
  carregar: () => rpc("carregar", { p_token: token }),
  mudancas: (desde) => rpc("mudancas", { p_token: token, p_desde: desde }),
  gravar: (ops) => rpc("gravar", { p_token: token, p_ops: ops }),
});

let pendentes: Mudanca[] = [];
let cache: Banco = bancoVazio();

let estado: "parado" | "iniciando" | "pronto" = "parado";
let fila: Promise<unknown> = Promise.resolve();
let consulta: ReturnType<typeof setInterval> | null = null;
let consultando = false;
let falhaDeGravacao = false;
/** Última vez que o servidor respondeu. É o que o "Ao vivo" do topo mostra. */
let ultimoContato = 0;

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

/** O banco confirmado, no formato que as telas conhecem. */
function confirmado(): Banco {
  const { lojas, dados } = replica.ler();
  return { usuarios: usuario ? [usuario] : [], lojas, dados, sessao };
}

/**
 * Escolhe a loja aberta: quem opera uma loja fica na dele; o admin volta para
 * a última que estava olhando neste navegador.
 */
function ajustarSessao() {
  if (!usuario) {
    sessao = null;
    return;
  }
  const { lojas } = replica.ler();
  const lembrada = lerArmazenado(CHAVE_LOJA);
  const lojaSelecionada =
    usuario.papel === "loja"
      ? (usuario.lojaId ?? "")
      : lojas.some((l) => l.id === sessao?.lojaSelecionada)
        ? (sessao?.lojaSelecionada ?? "")
        : lojas.some((l) => l.id === lembrada)
          ? (lembrada ?? "")
          : (lojas[0]?.id ?? "");
  sessao = { usuarioId: usuario.id, lojaSelecionada, em: sessao?.em ?? Date.now() };
}

/** Recalcula o que a tela mostra e avisa quem estiver ouvindo. */
function recompor() {
  cache = pendentes.reduce((atual, mudanca) => mudanca(atual), confirmado());
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

export function tokenAtual() {
  return token;
}

/** Como está a ligação com o servidor, para o indicador do topo. */
/** Cabeçalho que as rotas de /api exigem para saber quem está chamando. */
export function cabecalhoDaSessao(): Record<string, string> {
  return token ? { "x-sessao": token } : {};
}

export function estadoConexao() {
  return { logado: Boolean(token), ultimoContato, falhaDeGravacao };
}

export function inscrever(ouvinte: Ouvinte) {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/* ------------------------------------------------------------------
   Avisos para a tela (gravação recusada, sem conexão)
   ------------------------------------------------------------------ */

export type Aviso = {
  id: number;
  tipo: "erro" | "info" | "alerta" | "pedido" | "mensagem";
  texto: string;
  detalhe?: string;
  /** Para onde o aviso leva quando clicado. */
  href?: string;
};
type OuvinteAviso = (aviso: Aviso) => void;
const ouvintesAviso = new Set<OuvinteAviso>();
let proximoAviso = 1;

export function avisar(
  tipo: Aviso["tipo"],
  texto: string,
  extras: { detalhe?: string; href?: string } = {},
) {
  const aviso: Aviso = { id: proximoAviso++, tipo, texto, ...extras };
  ouvintesAviso.forEach((o) => o(aviso));
}

export function ouvirAvisos(ouvinte: OuvinteAviso) {
  ouvintesAviso.add(ouvinte);
  return () => {
    ouvintesAviso.delete(ouvinte);
  };
}

/* ------------------------------------------------------------------
   Carga e consulta periódica
   ------------------------------------------------------------------ */

type RespostaCarregar = {
  ok: boolean;
  erro?: string;
  usuario?: Usuario;
  seq?: number;
  ajustesAte?: number;
  registros?: Registro[];
};

/** Baixa tudo o que esta sessão pode ver. */
async function carregarTudo(): Promise<"ok" | "sessao" | "rede"> {
  if (!token) return "sessao";
  const r = await rpc<RespostaCarregar & { ok: boolean }>("carregar", { p_token: token });
  if (!r.ok) return r.erro === "sessao" ? "sessao" : "rede";

  usuario = r.usuario ?? null;
  ajustesAte = r.ajustesAte ?? 0;
  ultimoContato = Date.now();
  replica.limpar();
  replica.aplicar(r.registros ?? []);
  replica.cursor = r.seq ?? 0;
  ajustarSessao();
  return "ok";
}

function encerrarLocalmente() {
  token = null;
  usuario = null;
  sessao = null;
  ajustesAte = 0;
  pendentes = [];
  replica.limpar();
  gravarArmazenado(CHAVE_TOKEN, null);
  pararConsulta();
  recompor();
}

/**
 * Pergunta ao servidor o que mudou. É assim que a conversa que o bot gravou
 * aparece no painel sem ninguém apertar F5.
 */
async function verificarMudancas() {
  if (!token || consultando) return;
  if (!ehServidor() && document.visibilityState === "hidden") return;
  consultando = true;
  try {
    const { resultado, mudou } = await replica.puxar();
    if (resultado === "ok") ultimoContato = Date.now();
    if (resultado === "sessao") encerrarLocalmente();
    else if (mudou) {
      ajustarSessao();
      recompor();
    }
  } finally {
    consultando = false;
  }
}

function aoVoltar() {
  if (document.visibilityState === "visible") void verificarMudancas();
}

function iniciarConsulta() {
  if (ehServidor() || consulta) return;
  consulta = setInterval(verificarMudancas, INTERVALO_CONSULTA);
  window.addEventListener("focus", verificarMudancas);
  document.addEventListener("visibilitychange", aoVoltar);
}

function pararConsulta() {
  if (consulta) clearInterval(consulta);
  consulta = null;
  if (!ehServidor()) {
    window.removeEventListener("focus", verificarMudancas);
    document.removeEventListener("visibilitychange", aoVoltar);
  }
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
    const resultado = await carregarTudo();
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
  nomeDeUsuario: string,
  senha: string,
): Promise<{ ok: true; usuario: Usuario } | { ok: false; erro: string }> {
  const r = await rpc<{ ok: boolean; erro?: string; token?: string; usuario?: Usuario }>(
    "entrar",
    { p_usuario: nomeDeUsuario, p_senha: senha },
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

  const resultado = await carregarTudo();
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
   Área protegida (dados da loja e do agente)
   ------------------------------------------------------------------ */

export function ajustesLiberadosAte() {
  return ajustesAte;
}

/** Confere a senha de ajustes no servidor. Abre por 20 minutos. */
export async function liberarAjustes(pin: string): Promise<{ ok: boolean; erro?: string }> {
  if (!token) return { ok: false, erro: "Sessão encerrada. Entre de novo." };
  const r = await rpc<{ ok: boolean; erro?: string; ate?: number }>("liberar_ajustes", {
    p_token: token,
    p_pin: pin,
  });
  if (!r.ok) {
    return {
      ok: false,
      erro: r.erro === "rede" || r.erro?.startsWith("http") ? "Sem conexão com o servidor." : r.erro,
    };
  }
  ajustesAte = r.ate ?? Date.now() + 20 * 60 * 1000;
  recompor();
  return { ok: true };
}

export async function encerrarAjustes() {
  ajustesAte = 0;
  recompor();
  if (token) await rpc("encerrar_ajustes", { p_token: token });
}

export async function trocarPin(lojaId: string, novo: string) {
  if (!token) return { ok: false, erro: "Sessão encerrada." };
  return rpc<{ ok: boolean; erro?: string }>("trocar_pin", {
    p_token: token,
    p_loja: lojaId,
    p_novo: novo,
  });
}

/**
 * Troca a senha de quem está logado. O servidor pede a atual, aplica a regra
 * mínima e derruba as outras sessões desse acesso.
 */
export async function trocarSenha(atual: string, nova: string): Promise<{ ok: boolean; erro?: string }> {
  if (!token) return { ok: false, erro: "Sessão encerrada. Entre de novo." };
  const r = await rpc<{ ok: boolean; erro?: string }>("trocar_senha", {
    p_token: token,
    p_atual: atual,
    p_nova: nova,
  }).catch(() => ({ ok: false, erro: "Sem conexão com o servidor." }));
  if (r.ok && usuario) {
    usuario = { ...usuario, senhaFraca: false };
    recompor();
  }
  if (!r.ok && r.erro === "sessao") return { ok: false, erro: "Sessão encerrada. Entre de novo." };
  return r;
}

/* ------------------------------------------------------------------
   Histórico sob demanda
   ------------------------------------------------------------------ */

/**
 * Busca no servidor registros antigos que a tela não carrega ao abrir:
 * pedidos de meses atrás, conversas resolvidas há tempo.
 */
export async function buscarNoServidor(
  lojaId: string,
  colecao: "pedidos" | "conversas" | "eventos" | "envios",
  de: number,
  ate: number,
  limite = 5000,
): Promise<{ ok: boolean; registros: Registro[] }> {
  if (!token) return { ok: false, registros: [] };
  const r = await rpc<{ ok: boolean; registros?: Registro[] }>("buscar", {
    p_token: token,
    p_loja: lojaId,
    p_colecao: colecao,
    p_de: de,
    p_ate: ate,
    p_limite: limite,
  });
  return { ok: r.ok, registros: r.registros ?? [] };
}

/** Todas as conversas e pedidos de um telefone, de todos os tempos. */
export async function historicoNoServidor(lojaId: string, telefone: string) {
  if (!token) return { ok: false, registros: [] as Registro[] };
  const r = await rpc<{ ok: boolean; registros?: Registro[] }>("historico_cliente", {
    p_token: token,
    p_loja: lojaId,
    p_digitos: telefone,
  });
  return { ok: r.ok, registros: r.registros ?? [] };
}

/* ------------------------------------------------------------------
   Gravação
   ------------------------------------------------------------------ */

const MENSAGENS: Partial<Record<ResultadoGravacao, string>> = {
  protegido: "Essa alteração precisa da senha de ajustes. Abra a área protegida em Configurações.",
  conflito: "Outra tela mexeu no mesmo item várias vezes seguidas. Confira e tente de novo.",
};

/**
 * Aplica uma mudança: na tela na hora, no servidor em seguida.
 *
 * As gravações entram numa fila e saem uma de cada vez, na ordem em que
 * foram feitas. Devolve o resultado para quem quiser esperar (a área de
 * ajustes espera; um clique em "avançar pedido" não precisa).
 */
export function atualizarBanco(mudanca: Mudanca): Promise<ResultadoGravacao> {
  pendentes = [...pendentes, mudanca];
  recompor();

  const paraReplica = (e: EstadoReplica): EstadoReplica => {
    const depois = mudanca({ usuarios: usuario ? [usuario] : [], lojas: e.lojas, dados: e.dados, sessao });
    return { lojas: depois.lojas, dados: depois.dados };
  };

  const vez = fila.then(async () => {
    let resultado = await replica.gravar(paraReplica);

    // Sem conexão: espera e tenta de novo, sem perder a mudança. Ela continua
    // visível na tela enquanto isso.
    for (let espera = 2000; resultado === "rede" && espera <= 16000; espera *= 2) {
      falhaDeGravacao = true;
      recompor();
      await new Promise((r) => setTimeout(r, espera));
      resultado = await replica.gravar(paraReplica);
    }

    falhaDeGravacao = resultado === "rede";
    pendentes = pendentes.filter((m) => m !== mudanca);

    if (resultado === "sessao") {
      encerrarLocalmente();
    } else {
      if (resultado === "rede") avisar("erro", "Sem conexão: a última alteração não foi salva.");
      else if (resultado === "erro") avisar("erro", replica.ultimoErro);
      else if (MENSAGENS[resultado]) avisar("erro", MENSAGENS[resultado]!);
      recompor();
    }
    return resultado;
  });
  fila = vez.catch(() => undefined);
  return vez;
}

export function novoId(prefixo: string) {
  return `${prefixo}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
