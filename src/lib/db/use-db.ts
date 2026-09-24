"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { atualizarBanco, inscrever, lerBanco, novoId } from "./local-db";
import {
  type Banco,
  bancoInicial,
  type Campanha,
  type Cliente,
  type Conversa,
  dadosVazios,
  type DadosLoja,
  type EventoAgente,
  type ItemPedido,
  type Loja,
  lojaAtiva,
  type Mensagem,
  novaLoja,
  type Pagamentos,
  type Pedido,
  type Produto,
  type StatusPedido,
  type Usuario,
  usuarioDaSessao,
  type VisaoLoja,
  visaoAtiva,
  visaoVazia,
  pedidoExigeReceita,
} from "./types";

/* ------------------------------------------------------------------
   Leitura
   ------------------------------------------------------------------ */

/**
 * O banco inteiro, com a rede toda.
 *
 * A primeira renderização usa o banco inicial para bater com o HTML do
 * servidor. Depois da montagem, o conteúdo salvo entra e a tela atualiza.
 * Sem isso o React acusaria divergência de hidratação.
 *
 * Só telas de administrador usam isto. Tela de loja usa `useBanco`.
 */
export function useRede() {
  const [rede, setRede] = useState<Banco>(bancoInicial);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    const inicial = setTimeout(() => {
      setRede(lerBanco());
      setCarregado(true);
    }, 0);
    const cancelar = inscrever(setRede);
    return () => {
      clearTimeout(inicial);
      cancelar();
    };
  }, []);

  return { rede, carregado };
}

/**
 * A loja que está sendo operada agora, e só ela.
 *
 * É o que toda tela de operação consome. O recorte acontece aqui, uma vez, em
 * vez de em cada tela: assim nenhuma tela tem como mostrar dado de outra
 * unidade, nem por engano.
 */
export function useBanco() {
  const { rede, carregado } = useRede();
  const banco = useMemo<VisaoLoja>(
    () => (carregado ? visaoAtiva(rede) : visaoVazia()),
    [rede, carregado],
  );
  return { banco, carregado };
}

/** Quem está logado e em que loja. */
export function useSessao() {
  const { rede, carregado } = useRede();
  const usuario = useMemo(() => usuarioDaSessao(rede), [rede]);
  const loja = useMemo(() => lojaAtiva(rede), [rede]);
  return { usuario, loja, rede, carregado };
}

/* ------------------------------------------------------------------
   Acesso
   ------------------------------------------------------------------ */

/**
 * Confere o acesso e abre a sessão.
 *
 * Isto é conferência de demonstração, não autenticação: a senha está no
 * navegador e qualquer pessoa a lê. Antes de existir dado real de cliente,
 * tem que virar verificação no servidor.
 */
export function entrar(
  usuario: string,
  senha: string,
): { ok: true; usuario: Usuario } | { ok: false; erro: string } {
  const banco = lerBanco();
  const alvo = banco.usuarios.find(
    (u) => u.usuario.toLowerCase() === usuario.trim().toLowerCase(),
  );

  if (!alvo) return { ok: false, erro: "Este acesso não existe." };
  if (alvo.senha !== senha) return { ok: false, erro: "Senha incorreta." };

  atualizarBanco((atual) => ({
    ...atual,
    sessao: {
      usuarioId: alvo.id,
      lojaSelecionada:
        alvo.papel === "loja"
          ? (alvo.lojaId ?? atual.lojas[0]?.id ?? "")
          : (atual.sessao?.lojaSelecionada ?? atual.lojas[0]?.id ?? ""),
      em: Date.now(),
    },
  }));

  return { ok: true, usuario: alvo };
}

export function sair() {
  atualizarBanco((banco) => ({ ...banco, sessao: null }));
}

/**
 * Troca a loja que o administrador está olhando.
 *
 * Quem opera uma loja não passa por aqui: o acesso dele está preso à unidade
 * dele e a troca é simplesmente ignorada.
 */
export function selecionarLoja(lojaId: string) {
  atualizarBanco((banco) => {
    const usuario = usuarioDaSessao(banco);
    if (!usuario || usuario.papel !== "admin" || !banco.sessao) return banco;
    if (!banco.lojas.some((l) => l.id === lojaId)) return banco;
    return { ...banco, sessao: { ...banco.sessao, lojaSelecionada: lojaId } };
  });
}

/* ------------------------------------------------------------------
   Escrita dentro da loja ativa
   ------------------------------------------------------------------ */

/** Marca a loja como configurada só quando o essencial para atender existe. */
function comStatusDeConfiguracao(loja: Loja): Loja {
  return {
    ...loja,
    configurada: Boolean(
      loja.nome.trim() && loja.endereco.trim() && loja.cidade.trim(),
    ),
  };
}

/**
 * Aplica uma mudança nos dados da loja ativa.
 *
 * Todo cadastro do sistema passa por aqui, e é por isso que nenhuma operação
 * consegue escrever na loja errada: o destino vem da sessão, não de quem
 * chamou.
 */
function alterarDados(mudanca: (dados: DadosLoja) => DadosLoja) {
  atualizarBanco((banco) => {
    const loja = lojaAtiva(banco);
    if (!loja) return banco;
    const atuais = banco.dados[loja.id] ?? dadosVazios();
    return {
      ...banco,
      dados: { ...banco.dados, [loja.id]: mudanca(atuais) },
    };
  });
}

/* ------------------------------------------------------------------
   Lojas
   ------------------------------------------------------------------ */

/** Salva o cadastro da loja ativa. */
export function salvarLoja(dados: Partial<Loja>) {
  atualizarBanco((banco) => {
    const atual = lojaAtiva(banco);
    if (!atual) return banco;
    return {
      ...banco,
      lojas: banco.lojas.map((l) =>
        l.id === atual.id
          ? comStatusDeConfiguracao({ ...l, ...dados, id: l.id })
          : l,
      ),
    };
  });
}

/** Salva o cadastro de qualquer loja. Só o administrador chega aqui. */
export function salvarLojaDaRede(lojaId: string, dados: Partial<Loja>) {
  atualizarBanco((banco) => {
    const usuario = usuarioDaSessao(banco);
    if (usuario?.papel !== "admin") return banco;
    return {
      ...banco,
      lojas: banco.lojas.map((l) =>
        l.id === lojaId
          ? comStatusDeConfiguracao({ ...l, ...dados, id: l.id })
          : l,
      ),
    };
  });
}

/** Abre uma unidade nova na rede, já com o bloco de dados dela. */
export function criarLojaNaRede(nome: string) {
  let criada: Loja | null = null;
  atualizarBanco((banco) => {
    const usuario = usuarioDaSessao(banco);
    if (usuario?.papel !== "admin") return banco;

    criada = novaLoja(novoId("loja"), nome.trim() || "Nova loja");
    return {
      ...banco,
      lojas: [...banco.lojas, criada],
      dados: { ...banco.dados, [criada.id]: dadosVazios() },
    };
  });
  return criada as Loja | null;
}

/**
 * Desativa ou reativa uma unidade.
 *
 * Desativar não apaga: o histórico da loja continua nos relatórios da rede,
 * porque faturamento passado não deixa de ter acontecido.
 */
export function alternarLojaAtiva(lojaId: string) {
  atualizarBanco((banco) => {
    const usuario = usuarioDaSessao(banco);
    if (usuario?.papel !== "admin") return banco;
    return {
      ...banco,
      lojas: banco.lojas.map((l) =>
        l.id === lojaId ? { ...l, ativa: !l.ativa } : l,
      ),
    };
  });
}

/* ------------------------------------------------------------------
   Clientes
   ------------------------------------------------------------------ */

export function criarCliente(dados: Omit<Cliente, "id" | "criadoEm">) {
  const cliente: Cliente = { ...dados, id: novoId("cli"), criadoEm: Date.now() };
  alterarDados((d) => ({ ...d, clientes: [cliente, ...d.clientes] }));
  return cliente;
}

export function removerCliente(id: string) {
  alterarDados((d) => ({
    ...d,
    clientes: d.clientes.filter((c) => c.id !== id),
  }));
}

/* ------------------------------------------------------------------
   Produtos
   ------------------------------------------------------------------ */

export function criarProduto(dados: Omit<Produto, "id" | "criadoEm">) {
  const produto: Produto = { ...dados, id: novoId("sku"), criadoEm: Date.now() };
  alterarDados((d) => ({ ...d, produtos: [produto, ...d.produtos] }));
  return produto;
}

export function atualizarEstoque(id: string, estoque: number) {
  alterarDados((d) => ({
    ...d,
    produtos: d.produtos.map((p) => (p.id === id ? { ...p, estoque } : p)),
  }));
}

export function removerProduto(id: string) {
  alterarDados((d) => ({
    ...d,
    produtos: d.produtos.filter((p) => p.id !== id),
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
  alterarDados((d) => ({ ...d, campanhas: [campanha, ...d.campanhas] }));
  return campanha;
}

export function mudarStatusCampanha(id: string, status: Campanha["status"]) {
  alterarDados((d) => ({
    ...d,
    campanhas: d.campanhas.map((c) => (c.id === id ? { ...c, status } : c)),
  }));
}

export function removerCampanha(id: string) {
  alterarDados((d) => ({
    ...d,
    campanhas: d.campanhas.filter((c) => c.id !== id),
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
  alterarDados((d) => ({ ...d, conversas: [conversa, ...d.conversas] }));
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
  alterarDados((d) => ({
    ...d,
    conversas: d.conversas.map((c) =>
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
  alterarDados((d) => ({
    ...d,
    conversas: d.conversas.map((c) => (c.id === id ? { ...c, status } : c)),
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
 * preparo, porque o dinheiro entra na hora da entrega.
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
      // Retirada acaba no balcão. Entrega ainda tem a rua no meio.
      return pedido.formaEntrega === "entrega" ? "saiu_entrega" : "entregue";
    case "saiu_entrega":
      return "entregue";
    default:
      return null;
  }
}

/**
 * O momento em que o produto sai da loja de verdade, e o estoque cai.
 *
 * Na retirada é a entrega no balcão. Na entrega é a saída com o motoboy: dali
 * em diante a caixa não está mais na prateleira, mesmo que o cliente ainda
 * não tenha recebido.
 */
function saiDoEstoque(pedido: Pedido, proxima: StatusPedido) {
  return pedido.formaEntrega === "entrega"
    ? proxima === "saiu_entrega"
    : proxima === "entregue";
}

export function criarPedido(dados: {
  cliente: string;
  telefone: string;
  origem: Pedido["origem"];
  itens: ItemPedido[];
  formaPagamento: Pedido["formaPagamento"];
  formaEntrega: Pedido["formaEntrega"];
  enderecoEntrega?: string;
  taxaEntrega?: number;
  observacao?: string;
}) {
  const subtotal = dados.itens.reduce(
    (soma, i) => soma + i.precoUnitario * i.quantidade,
    0,
  );
  // Retirada nunca cobra taxa, mesmo que a loja tenha uma configurada.
  const taxaEntrega =
    dados.formaEntrega === "entrega" ? (dados.taxaEntrega ?? 0) : 0;
  const agora = Date.now();

  let criado: Pedido | null = null;
  alterarDados((d) => {
    const numero =
      d.pedidos.reduce((maior, p) => Math.max(maior, p.numero), 0) + 1;
    criado = {
      id: novoId("ped"),
      numero,
      cliente: dados.cliente,
      telefone: dados.telefone,
      origem: dados.origem,
      itens: dados.itens,
      subtotal,
      taxaEntrega,
      total: subtotal + taxaEntrega,
      status: statusInicial(dados.itens, dados.formaPagamento),
      formaPagamento: dados.formaPagamento,
      formaEntrega: dados.formaEntrega,
      enderecoEntrega:
        dados.formaEntrega === "entrega" ? (dados.enderecoEntrega ?? "") : "",
      pago: false,
      receitaConferidaPor: "",
      observacao: dados.observacao ?? "",
      criadoEm: agora,
      atualizadoEm: agora,
    };
    return { ...d, pedidos: [criado, ...d.pedidos] };
  });
  return criado as Pedido | null;
}

function alterarPedido(id: string, mudanca: (p: Pedido) => Pedido) {
  alterarDados((d) => ({
    ...d,
    pedidos: d.pedidos.map((p) =>
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
 * A baixa de estoque acontece quando o produto sai da loja. Quem paga no
 * balcão ou na mão do motoboy tem o pagamento registrado na entrega, pelo
 * mesmo motivo: é quando o dinheiro entra.
 */
export function avancarPedido(id: string) {
  alterarDados((d) => {
    const pedido = d.pedidos.find((p) => p.id === id);
    if (!pedido) return d;

    const proxima = proximaEtapa(pedido);
    if (!proxima) return d;
    if (
      proxima === "em_preparo" &&
      pedidoExigeReceita(pedido) &&
      !pedido.receitaConferidaPor
    ) {
      return d;
    }

    const atualizado: Pedido = {
      ...pedido,
      status: proxima,
      pago: proxima === "entregue" ? true : pedido.pago,
      atualizadoEm: Date.now(),
    };

    const produtos = saiDoEstoque(pedido, proxima)
      ? d.produtos.map((produto) => {
          const item = pedido.itens.find((i) => i.produtoId === produto.id);
          if (!item) return produto;
          return {
            ...produto,
            estoque: Math.max(0, produto.estoque - item.quantidade),
          };
        })
      : d.produtos;

    return {
      ...d,
      produtos,
      pedidos: d.pedidos.map((p) => (p.id === id ? atualizado : p)),
    };
  });
}

export function cancelarPedido(id: string) {
  alterarPedido(id, (p) => ({ ...p, status: "cancelado" }));
}

export function removerPedido(id: string) {
  alterarDados((d) => ({ ...d, pedidos: d.pedidos.filter((p) => p.id !== id) }));
}

/* ------------------------------------------------------------------
   Pagamentos
   ------------------------------------------------------------------ */

export function salvarPagamentos(dados: Partial<Pagamentos>) {
  alterarDados((d) => ({ ...d, pagamentos: { ...d.pagamentos, ...dados } }));
}

/* ------------------------------------------------------------------
   Eventos do agente
   ------------------------------------------------------------------ */

/** Registra algo que realmente aconteceu. Guarda os 100 mais recentes. */
export function registrarEvento(dados: Omit<EventoAgente, "id" | "em">) {
  const evento: EventoAgente = { ...dados, id: novoId("evt"), em: Date.now() };
  alterarDados((d) => ({ ...d, eventos: [evento, ...d.eventos].slice(0, 100) }));
  return evento;
}

/* ------------------------------------------------------------------
   Conexão do WhatsApp
   ------------------------------------------------------------------ */

export function definirWhatsapp(conectado: boolean) {
  alterarDados((d) => ({ ...d, whatsappConectado: conectado }));
}

/** Ajuda telas que precisam recarregar algo manualmente. */
export function useAcoes() {
  const [, forcar] = useState(0);
  const recarregar = useCallback(() => forcar((n) => n + 1), []);
  return { recarregar };
}
