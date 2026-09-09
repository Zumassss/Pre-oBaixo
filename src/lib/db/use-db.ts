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
  type ItemPedido,
  type Loja,
  type Mensagem,
  type Pagamentos,
  type Pedido,
  type Produto,
  type StatusPedido,
  pedidoExigeReceita,
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
   Pedidos
   ------------------------------------------------------------------ */

/**
 * Onde um pedido novo entra na fila.
 *
 * Item de tarja para na conferência da receita, sempre. Sem tarja, quem vai
 * pagar por Pix espera o pagamento; quem paga no balcão já vai para o
 * preparo, porque o dinheiro entra na hora da retirada.
 */
function statusInicial(
  itens: ItemPedido[],
  forma: Pedido["formaPagamento"],
): StatusPedido {
  if (itens.some((i) => i.exigeReceita)) return "aguardando_receita";
  return forma === "pix" ? "aguardando_pagamento" : "em_preparo";
}

/** A etapa seguinte, ou null quando o pedido já acabou. */
export function proximaEtapa(pedido: Pedido): StatusPedido | null {
  switch (pedido.status) {
    case "aguardando_receita":
      return pedido.formaPagamento === "pix" && !pedido.pago
        ? "aguardando_pagamento"
        : "em_preparo";
    case "aguardando_pagamento":
      return "em_preparo";
    case "em_preparo":
      return "pronto";
    case "pronto":
      return "entregue";
    default:
      return null;
  }
}

export function criarPedido(dados: {
  cliente: string;
  telefone: string;
  origem: Pedido["origem"];
  itens: ItemPedido[];
  formaPagamento: Pedido["formaPagamento"];
  observacao?: string;
}) {
  const total = dados.itens.reduce(
    (soma, i) => soma + i.precoUnitario * i.quantidade,
    0,
  );
  const agora = Date.now();

  let criado: Pedido | null = null;
  atualizarBanco((banco) => {
    const numero =
      banco.pedidos.reduce((maior, p) => Math.max(maior, p.numero), 0) + 1;
    criado = {
      id: novoId("ped"),
      numero,
      cliente: dados.cliente,
      telefone: dados.telefone,
      origem: dados.origem,
      itens: dados.itens,
      total,
      status: statusInicial(dados.itens, dados.formaPagamento),
      formaPagamento: dados.formaPagamento,
      pago: false,
      receitaConferidaPor: "",
      observacao: dados.observacao ?? "",
      criadoEm: agora,
      atualizadoEm: agora,
    };
    return { ...banco, pedidos: [criado, ...banco.pedidos] };
  });
  return criado as Pedido | null;
}

function alterarPedido(id: string, mudanca: (p: Pedido) => Pedido) {
  atualizarBanco((banco) => ({
    ...banco,
    pedidos: banco.pedidos.map((p) =>
      p.id === id ? { ...mudanca(p), atualizadoEm: Date.now() } : p,
    ),
  }));
}

/**
 * Registra que o farmacêutico conferiu a receita.
 *
 * Isso não é detalhe de interface: item de tarja não pode ser separado nem
 * entregue sem alguém responsável ter olhado. Guardamos o nome de quem
 * conferiu justamente para o registro existir.
 */
export function aprovarReceita(id: string, conferidaPor: string) {
  alterarPedido(id, (p) => ({
    ...p,
    receitaConferidaPor: conferidaPor,
    status:
      p.status === "aguardando_receita"
        ? p.formaPagamento === "pix" && !p.pago
          ? "aguardando_pagamento"
          : "em_preparo"
        : p.status,
  }));
}

export function registrarPagamento(id: string) {
  alterarPedido(id, (p) => ({
    ...p,
    pago: true,
    status: p.status === "aguardando_pagamento" ? "em_preparo" : p.status,
  }));
}

/**
 * Empurra o pedido para a etapa seguinte.
 *
 * A baixa de estoque acontece na entrega, que é quando o produto sai da
 * loja de verdade. Quem paga no balcão tem o pagamento registrado no mesmo
 * momento, pelo mesmo motivo.
 */
export function avancarPedido(id: string) {
  atualizarBanco((banco) => {
    const pedido = banco.pedidos.find((p) => p.id === id);
    if (!pedido) return banco;

    const proxima = proximaEtapa(pedido);
    if (!proxima) return banco;
    if (proxima === "em_preparo" && pedidoExigeReceita(pedido) && !pedido.receitaConferidaPor) {
      return banco;
    }

    const entregando = proxima === "entregue";
    const atualizado: Pedido = {
      ...pedido,
      status: proxima,
      pago: entregando ? true : pedido.pago,
      atualizadoEm: Date.now(),
    };

    const produtos = entregando
      ? banco.produtos.map((produto) => {
          const item = pedido.itens.find((i) => i.produtoId === produto.id);
          if (!item) return produto;
          return {
            ...produto,
            estoque: Math.max(0, produto.estoque - item.quantidade),
          };
        })
      : banco.produtos;

    return {
      ...banco,
      produtos,
      pedidos: banco.pedidos.map((p) => (p.id === id ? atualizado : p)),
    };
  });
}

export function cancelarPedido(id: string) {
  alterarPedido(id, (p) => ({ ...p, status: "cancelado" }));
}

export function removerPedido(id: string) {
  atualizarBanco((banco) => ({
    ...banco,
    pedidos: banco.pedidos.filter((p) => p.id !== id),
  }));
}

/* ------------------------------------------------------------------
   Pagamentos
   ------------------------------------------------------------------ */

export function salvarPagamentos(dados: Partial<Pagamentos>) {
  atualizarBanco((banco) => ({
    ...banco,
    pagamentos: { ...banco.pagamentos, ...dados },
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
