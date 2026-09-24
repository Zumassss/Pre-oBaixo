"use client";

import {
  bancoInicial,
  completarDados,
  type Banco,
  type DadosLoja,
  type Loja,
  novaLoja,
} from "./types";

/**
 * Armazenamento local.
 *
 * Enquanto não existe backend, o que você cadastra fica no navegador desta
 * máquina. A forma dos dados já é a de uma API, então trocar isto pelo
 * Supabase depois mexe só neste arquivo.
 *
 * O sistema começa vazio de propósito. Nada aqui inventa cliente, produto ou
 * número: o que aparecer na tela foi você que cadastrou.
 */

const CHAVE = "preco-baixo:v2";

/**
 * A chave da versão de loja única.
 *
 * Quem já usou o sistema antes da rede tem cadastros salvos neste endereço
 * antigo. Jogar fora seria apagar o trabalho de alguém sem avisar, então o
 * conteúdo é convertido na primeira loja e a chave velha fica onde está.
 */
const CHAVE_ANTIGA = "preco-baixo:v1";

type Ouvinte = (banco: Banco) => void;
const ouvintes = new Set<Ouvinte>();

let cache: Banco | null = null;

function ehServidor() {
  return typeof window === "undefined";
}

/**
 * Põe um banco lido do navegador na forma esperada pelo código de hoje.
 *
 * Os usuários vêm SEMPRE do código, nunca do que estava salvo. Se viessem do
 * armazenamento, uma base gravada por uma versão antiga poderia deixar alguém
 * trancado fora do sistema, sem senha para entrar e sem como consertar.
 */
function normalizar(salvo: Partial<Banco>): Banco {
  const base = bancoInicial();

  const lojas: Loja[] = (salvo.lojas ?? []).map((loja) => ({
    ...novaLoja(loja.id, loja.nome ?? ""),
    ...loja,
  }));

  // A loja da demonstração existe sempre: é a que os dois acessos usam.
  for (const padrao of base.lojas) {
    if (!lojas.some((l) => l.id === padrao.id)) lojas.unshift(padrao);
  }

  const dados: Record<string, DadosLoja> = {};
  for (const loja of lojas) {
    dados[loja.id] = completarDados(salvo.dados?.[loja.id]);
  }

  // Sessão só vale se aponta para gente e loja que ainda existem.
  const sessao =
    salvo.sessao && base.usuarios.some((u) => u.id === salvo.sessao?.usuarioId)
      ? {
          ...salvo.sessao,
          lojaSelecionada: lojas.some(
            (l) => l.id === salvo.sessao?.lojaSelecionada,
          )
            ? salvo.sessao.lojaSelecionada
            : lojas[0].id,
        }
      : null;

  return { usuarios: base.usuarios, lojas, dados, sessao };
}

/**
 * Traz o conteúdo da versão de loja única para dentro da primeira loja.
 *
 * Roda uma vez só: depois da primeira gravação a chave nova existe e este
 * caminho nunca mais é usado.
 */
function migrarDaVersaoAntiga(): Banco | null {
  let bruto: string | null = null;
  try {
    bruto = window.localStorage.getItem(CHAVE_ANTIGA);
  } catch {
    return null;
  }
  if (!bruto) return null;

  try {
    const antigo = JSON.parse(bruto) as Partial<DadosLoja> & {
      loja?: Partial<Loja>;
    };
    const banco = bancoInicial();
    const primeira = banco.lojas[0];

    banco.lojas[0] = {
      ...primeira,
      ...antigo.loja,
      // O id e o nome do acesso não mudam: são o que liga o login à loja.
      id: primeira.id,
      nome: primeira.nome,
    };
    banco.dados[primeira.id] = completarDados(antigo);

    return banco;
  } catch {
    return null;
  }
}

export function lerBanco(): Banco {
  if (ehServidor()) return bancoInicial();
  if (cache) return cache;

  try {
    const bruto = window.localStorage.getItem(CHAVE);
    if (!bruto) {
      cache = migrarDaVersaoAntiga() ?? bancoInicial();
      return cache;
    }
    cache = normalizar(JSON.parse(bruto) as Partial<Banco>);
    return cache;
  } catch {
    cache = bancoInicial();
    return cache;
  }
}

function gravar(banco: Banco) {
  cache = banco;
  if (!ehServidor()) {
    try {
      window.localStorage.setItem(CHAVE, JSON.stringify(banco));
    } catch {
      // Modo privado ou disco cheio: a sessão continua, só não persiste.
    }
  }
  ouvintes.forEach((ouvinte) => ouvinte(banco));
}

/** Aplica uma mudança e avisa quem estiver ouvindo. */
export function atualizarBanco(mudanca: (banco: Banco) => Banco): Banco {
  const proximo = mudanca(lerBanco());
  gravar(proximo);
  return proximo;
}

export function inscrever(ouvinte: Ouvinte) {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/**
 * Apaga os cadastros e volta ao estado inicial, mantendo quem está logado.
 *
 * Limpar dados não é motivo para derrubar a sessão de quem clicou no botão.
 */
export function limparBanco() {
  const sessao = lerBanco().sessao;
  gravar({ ...bancoInicial(), sessao });
}

export function novoId(prefixo: string) {
  return `${prefixo}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
