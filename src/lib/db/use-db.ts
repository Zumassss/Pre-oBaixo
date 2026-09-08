"use client";

import { useCallback, useEffect, useState } from "react";
import { atualizarBanco, inscrever, lerBanco, novoId } from "./local-db";
import {
  BANCO_VAZIO,
  type BancoLocal,
  type Campanha,
  type Cliente,
  type Conversa,
  type EventoAgente,
  type Loja,
  type Mensagem,
  type Produto,
} from "./types";

/**
 * Acesso ao banco local.
 *
 * A primeira renderização usa o banco vazio para bater com o HTML do
 * servidor. Depois da montagem, o conteúdo salvo entra e a tela atualiza.
 * Sem isso o React acusaria divergência de hidratação.
 */
export function useBanco() {
  const [banco, setBanco] = useState<BancoLocal>(BANCO_VAZIO);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    const inicial = setTimeout(() => {
      setBanco(lerBanco());
      setCarregado(true);
    }, 0);
    const cancelar = inscrever(setBanco);
    return () => {
      clearTimeout(inicial);
      cancelar();
    };
  }, []);

  return { banco, carregado };
}

/* ------------------------------------------------------------------
   Loja
   ------------------------------------------------------------------ */

export function salvarLoja(dados: Partial<Loja>) {
  atualizarBanco((banco) => {
    const loja = { ...banco.loja, ...dados };
    // Só consideramos configurada quando o essencial para atender existe.
    loja.configurada = Boolean(
      loja.nome.trim() && loja.endereco.trim() && loja.cidade.trim(),
    );
    return { ...banco, loja };
  });
}

/* ------------------------------------------------------------------
   Clientes
   ------------------------------------------------------------------ */

export function criarCliente(dados: Omit<Cliente, "id" | "criadoEm">) {
  const cliente: Cliente = { ...dados, id: novoId("cli"), criadoEm: Date.now() };
  atualizarBanco((banco) => ({
    ...banco,
    clientes: [cliente, ...banco.clientes],
  }));
  return cliente;
}

export function removerCliente(id: string) {
  atualizarBanco((banco) => ({
    ...banco,
    clientes: banco.clientes.filter((c) => c.id !== id),
  }));
}

/* ------------------------------------------------------------------
   Produtos
   ------------------------------------------------------------------ */

export function criarProduto(dados: Omit<Produto, "id" | "criadoEm">) {
  const produto: Produto = { ...dados, id: novoId("sku"), criadoEm: Date.now() };
  atualizarBanco((banco) => ({
    ...banco,
    produtos: [produto, ...banco.produtos],
  }));
  return produto;
}

export function atualizarEstoque(id: string, estoque: number) {
  atualizarBanco((banco) => ({
    ...banco,
    produtos: banco.produtos.map((p) => (p.id === id ? { ...p, estoque } : p)),
  }));
}

export function removerProduto(id: string) {
  atualizarBanco((banco) => ({
    ...banco,
    produtos: banco.produtos.filter((p) => p.id !== id),
  }));
}

/* ------------------------------------------------------------------
   Campanhas
   ------------------------------------------------------------------ */

export function criarCampanha(dados: Omit<Campanha, "id" | "criadoEm">) {
  const campanha: Campanha = {
    ...dados,
    id: novoId("cmp"),
    criadoEm: Date.now(),
  };
  atualizarBanco((banco) => ({
    ...banco,
    campanhas: [campanha, ...banco.campanhas],
  }));
  return campanha;
}

export function mudarStatusCampanha(id: string, status: Campanha["status"]) {
  atualizarBanco((banco) => ({
    ...banco,
    campanhas: banco.campanhas.map((c) => (c.id === id ? { ...c, status } : c)),
  }));
}

export function removerCampanha(id: string) {
  atualizarBanco((banco) => ({
    ...banco,
    campanhas: banco.campanhas.filter((c) => c.id !== id),
  }));
}

/* ------------------------------------------------------------------
   Conversas
   ------------------------------------------------------------------ */

export function criarConversa(cliente: string, telefone: string) {
  const conversa: Conversa = {
    id: novoId("cnv"),
    cliente,
    telefone,
    status: "aberta",
    mensagens: [],
    atualizadaEm: Date.now(),
  };
  atualizarBanco((banco) => ({
    ...banco,
    conversas: [conversa, ...banco.conversas],
  }));
  return conversa;
}

export function adicionarMensagem(
  conversaId: string,
  origem: Mensagem["origem"],
  texto: string,
) {
  const mensagem: Mensagem = {
    id: novoId("msg"),
    origem,
    texto,
    em: Date.now(),
  };
  atualizarBanco((banco) => ({
    ...banco,
    conversas: banco.conversas.map((c) =>
      c.id === conversaId
        ? {
            ...c,
            mensagens: [...c.mensagens, mensagem],
            atualizadaEm: Date.now(),
            status: origem === "atendente" ? "com_atendente" : c.status,
          }
        : c,
    ),
  }));
  return mensagem;
}

export function mudarStatusConversa(id: string, status: Conversa["status"]) {
  atualizarBanco((banco) => ({
    ...banco,
    conversas: banco.conversas.map((c) => (c.id === id ? { ...c, status } : c)),
  }));
}

/* ------------------------------------------------------------------
   Eventos do agente
   ------------------------------------------------------------------ */

/** Registra algo que realmente aconteceu. Guarda os 100 mais recentes. */
export function registrarEvento(dados: Omit<EventoAgente, "id" | "em">) {
  const evento: EventoAgente = { ...dados, id: novoId("evt"), em: Date.now() };
  atualizarBanco((banco) => ({
    ...banco,
    eventos: [evento, ...banco.eventos].slice(0, 100),
  }));
  return evento;
}

/* ------------------------------------------------------------------
   Conexão do WhatsApp
   ------------------------------------------------------------------ */

export function definirWhatsapp(conectado: boolean) {
  atualizarBanco((banco) => ({ ...banco, whatsappConectado: conectado }));
}

/** Ajuda telas que precisam recarregar algo manualmente. */
export function useAcoes() {
  const [, forcar] = useState(0);
  const recarregar = useCallback(() => forcar((n) => n + 1), []);
  return { recarregar };
}
