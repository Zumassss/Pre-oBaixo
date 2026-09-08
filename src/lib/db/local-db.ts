"use client";

import { BANCO_VAZIO, type BancoLocal } from "./types";

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

const CHAVE = "preco-baixo:v1";

type Ouvinte = (banco: BancoLocal) => void;
const ouvintes = new Set<Ouvinte>();

let cache: BancoLocal | null = null;

function ehServidor() {
  return typeof window === "undefined";
}

export function lerBanco(): BancoLocal {
  if (ehServidor()) return BANCO_VAZIO;
  if (cache) return cache;

  try {
    const bruto = window.localStorage.getItem(CHAVE);
    if (!bruto) {
      cache = BANCO_VAZIO;
      return cache;
    }
    const salvo = JSON.parse(bruto) as Partial<BancoLocal>;
    // Mesclar com o vazio protege contra versões antigas sem algum campo.
    cache = {
      ...BANCO_VAZIO,
      ...salvo,
      loja: { ...BANCO_VAZIO.loja, ...salvo.loja },
    };
    return cache;
  } catch {
    cache = BANCO_VAZIO;
    return cache;
  }
}

function gravar(banco: BancoLocal) {
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
export function atualizarBanco(
  mudanca: (banco: BancoLocal) => BancoLocal,
): BancoLocal {
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

/** Apaga tudo e volta ao estado inicial. */
export function limparBanco() {
  gravar(BANCO_VAZIO);
}

export function novoId(prefixo: string) {
  return `${prefixo}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
