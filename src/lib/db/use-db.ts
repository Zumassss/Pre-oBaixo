"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  atualizarBanco,
  atualizarSessao,
  entrarNoServidor,
  estaPronto,
  iniciarSincronizacao,
  inscrever,
  lerBanco,
  novoId,
  sairDoServidor,
  temFalhaDeGravacao,
} from "./local-db";
import type { ResultadoGravacao } from "./sincronia";
import {
  type AjustesAgente,
  type Banco,
  bancoVazio,
  type Campanha,
  type Cliente,
  CLIENTE_PADRAO,
  type Conversa,
  dadosVazios,
  type DadosLoja,
  type Envio,
  type EventoAgente,
  type ItemPedido,
  type Loja,
  lojaAtiva,
  type Mensagem,
  MENSAGEM_PADRAO,
  type Midia,
  novaLoja,
  type Pagamentos,
  type Pedido,
  type Produto,
  type StatusPedido,
  usuarioDaSessao,
  type VisaoLoja,
  visaoAtiva,
  visaoVazia,
  pedidoExigeReceita,
  whatsappNoAr,
} from "./types";

/* ------------------------------------------------------------------
   Leitura
   ------------------------------------------------------------------ */

/**
 * O banco inteiro, com tudo que esta sessão pode ver.
 *
 * A primeira renderização usa o banco vazio para bater com o HTML do
 * servidor. A sincronização com a nuvem começa na montagem, e `carregado` só
 * vira verdadeiro quando a primeira leitura terminou: antes disso a tela de
 * entrada não sabe se a pessoa já está logada.
 *
 * Só telas de administrador usam isto. Tela de loja usa `useBanco`.
 */
export function useRede() {
  const [rede, setRede] = useState<Banco>(bancoVazio);
  const [carregado, setCarregado] = useState(false);
  const [semConexao, setSemConexao] = useState(false);

  useEffect(() => {
    const atualizar = (banco: Banco) => {
      setRede(banco);
      setCarregado(estaPronto());
      setSemConexao(temFalhaDeGravacao());
    };
    const cancelar = inscrever(atualizar);
    const inicial = setTimeout(() => {
      if (estaPronto()) atualizar(lerBanco());
      void iniciarSincronizacao();
    }, 0);
    return () => {
      clearTimeout(inicial);
      cancelar();
    };
  }, []);

  return { rede, carregado, semConexao };
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
  const { rede, carregado, semConexao } = useRede();
  const usuario = useMemo(() => usuarioDaSessao(rede), [rede]);
  const loja = useMemo(() => lojaAtiva(rede), [rede]);
  return { usuario, loja, rede, carregado, semConexao };
}

/* ------------------------------------------------------------------
   Acesso
   ------------------------------------------------------------------ */

/**
 * Confere o acesso no servidor e abre a sessão.
 *
 * A senha não fica no navegador: vai para a função `entrar` no banco, que
 * compara com o hash e devolve um token de sessão. Errar 5 vezes seguidas
 * trava o acesso por 15 minutos.
 */
export function entrar(usuario: string, senha: string) {
  return entrarNoServidor(usuario, senha);
}

export function sair() {
  sairDoServidor();
}

/**
 * Troca a loja que o administrador está olhando.
 *
 * Quem opera uma loja não passa por aqui: o acesso dele está preso à unidade
 * dele e a troca é simplesmente ignorada. É uma escolha deste navegador, não
 * vai para o servidor.
 */
export function selecionarLoja(lojaId: string) {
  atualizarSessao((atual, banco) => {
    const usuario = usuarioDaSessao(banco);
    if (!usuario || usuario.papel !== "admin" || !atual) return atual;
    if (!banco.lojas.some((l) => l.id === lojaId)) return atual;
    return { ...atual, lojaSelecionada: lojaId };
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
function alterarDados(mudanca: (dados: DadosLoja) => DadosLoja): Promise<ResultadoGravacao> {
  // A loja é decidida AGORA, não quando a mudança for reaplicada. Se o
  // administrador trocar de loja enquanto a gravação ainda está na fila, a
  // mudança tem que cair na loja em que ele estava quando clicou.
  const lojaId = lojaAtiva(lerBanco())?.id;
  if (!lojaId) return Promise.resolve("erro");
  return atualizarBanco((banco) => {
    if (!banco.lojas.some((l) => l.id === lojaId)) return banco;
    const atuais = banco.dados[lojaId] ?? dadosVazios();
    return {
      ...banco,
      dados: { ...banco.dados, [lojaId]: mudanca(atuais) },
    };
  });
}

/**
 * Zera os cadastros da loja aberta. Não mexe em nenhuma outra, nem nos
 * ajustes da loja (horários, entrega, chave Pix): esses só mudam na área
 * protegida.
 */
export function apagarDadosDaLoja() {
  return alterarDados((d) => {
    const vazio = dadosVazios();
    return {
      ...d,
      clientes: vazio.clientes,
      produtos: vazio.produtos,
      campanhas: vazio.campanhas,
      conversas: vazio.conversas,
      pedidos: vazio.pedidos,
      eventos: vazio.eventos,
      envios: vazio.envios,
    };
  });
}

/* ------------------------------------------------------------------
   Lojas
   ------------------------------------------------------------------ */

/** Salva o cadastro da loja ativa. Precisa da área de ajustes aberta. */
export function salvarLoja(dados: Partial<Loja>) {
  const lojaId = lojaAtiva(lerBanco())?.id;
  if (!lojaId) return Promise.resolve<ResultadoGravacao>("erro");
  return atualizarBanco((banco) => ({
    ...banco,
    lojas: banco.lojas.map((l) =>
      l.id === lojaId
        ? comStatusDeConfiguracao({ ...l, ...dados, id: l.id })
        : l,
    ),
  }));
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
  if (usuarioDaSessao(lerBanco())?.papel !== "admin") return null;

  // Criada fora da mudança: se a gravação precisar ser reaplicada, a loja
  // continua com o mesmo id, e quem recebeu o retorno não fica com um id
  // que nunca chegou ao servidor.
  const criada = novaLoja(novoId("loja"), nome.trim() || "Nova loja");
  atualizarBanco((banco) => {
    if (banco.lojas.some((l) => l.id === criada.id)) return banco;
    return {
      ...banco,
      lojas: [...banco.lojas, criada],
      dados: { ...banco.dados, [criada.id]: dadosVazios() },
    };
  });
  return criada;
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

export function criarCliente(
  dados: Pick<Cliente, "nome" | "telefone"> & Partial<Omit<Cliente, "id" | "criadoEm">>,
) {
  const cliente: Cliente = {
    ...CLIENTE_PADRAO,
    ...dados,
    id: novoId("cli"),
    criadoEm: Date.now(),
  };
  alterarDados((d) => ({ ...d, clientes: [cliente, ...d.clientes] }));
  return cliente;
}

export function atualizarCliente(id: string, dados: Partial<Omit<Cliente, "id" | "criadoEm">>) {
  return alterarDados((d) => ({
    ...d,
    clientes: d.clientes.map((c) => (c.id === id ? { ...c, ...dados } : c)),
  }));
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

/**
 * Põe ou tira um produto da promoção. Zero tira.
 *
 * Produto com receita é recusado aqui também, não só na tela: a regra não
 * pode depender de alguém lembrar de desabilitar um campo.
 */
export function definirPromocao(id: string, promocao: number) {
  alterarDados((d) => ({
    ...d,
    produtos: d.produtos.map((p) =>
      p.id === id && !p.exigeReceita
        ? { ...p, promocao: promocao > 0 && promocao < p.preco ? promocao : 0 }
        : p,
    ),
  }));
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

export function atualizarCampanha(id: string, dados: Partial<Omit<Campanha, "id" | "criadoEm">>) {
  return alterarDados((d) => ({
    ...d,
    campanhas: d.campanhas.map((c) => (c.id === id ? { ...c, ...dados } : c)),
  }));
}

/**
 * Pede ao bot para mandar a campanha a um número, para ver como ela chega.
 *
 * O bot só manda para quem já escreveu para a loja. Para qualquer outro
 * número ele recusa e o motivo aparece na tela.
 */
export function enviarTesteDeCampanha(campanha: Campanha, telefone: string, texto: string) {
  const envio: Envio = {
    id: novoId("env"),
    tipo: "teste_campanha",
    telefone,
    texto,
    midia: campanha.imagem,
    campanhaId: campanha.id,
    status: "pendente",
    motivo: "",
    criadoEm: Date.now(),
    enviadoEm: 0,
  };
  alterarDados((d) => ({ ...d, envios: [envio, ...d.envios] }));
  return envio;
}

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

export function criarConversa(
  cliente: string,
  telefone: string,
  canal: Conversa["canal"] = "interno",
) {
  const agora = Date.now();
  const conversa: Conversa = {
    id: novoId(canal === "whatsapp" ? "cnv-wa" : "cnv"),
    cliente,
    telefone,
    status: canal === "whatsapp" ? "com_atendente" : "aberta",
    canal,
    alerta: null,
    etapa: "conversa",
    mensagens: [],
    atualizadaEm: agora,
    assumidaPor: "",
    assumidaEm: 0,
    criadaEm: agora,
  };
  alterarDados((d) => ({ ...d, conversas: [conversa, ...d.conversas] }));
  return conversa;
}

/**
 * Abre (ou reaproveita) a conversa com um cliente.
 *
 * Pelo WhatsApp só quando a pessoa já escreveu para a loja alguma vez. Quem
 * nunca escreveu ganha uma conversa interna, de registro: puxar conversa
 * com quem não pediu é o caminho mais rápido para o número ser banido.
 */
export function abrirConversaComCliente(cliente: Cliente, atendente: string) {
  const banco = lerBanco();
  const lojaId = lojaAtiva(banco)?.id;
  const dados = lojaId ? banco.dados[lojaId] : undefined;
  const digitos = cliente.telefone.replace(/\D/g, "").slice(-8);
  const aberta = dados?.conversas.find(
    (c) => c.status !== "resolvida" && c.telefone.replace(/\D/g, "").endsWith(digitos),
  );
  if (aberta) return aberta;

  const canal: Conversa["canal"] = cliente.primeiraMensagemEm > 0 ? "whatsapp" : "interno";
  const conversa = criarConversa(cliente.nome, cliente.telefone, canal);
  if (canal === "whatsapp") assumirConversa(conversa.id, atendente);
  return conversa;
}

export function adicionarMensagem(
  conversaId: string,
  origem: Mensagem["origem"],
  texto: string,
  autor = "",
  extras: { midia?: Midia | null; citada?: Mensagem["citada"] } = {},
) {
  const agora = Date.now();
  const id = novoId("msg");
  let criada: Mensagem | null = null;
  alterarDados((d) => ({
    ...d,
    conversas: d.conversas.map((c) => {
      if (c.id !== conversaId) return c;
      if (c.mensagens.some((m) => m.id === id)) return c;

      const mensagem: Mensagem = {
        ...MENSAGEM_PADRAO,
        id,
        origem,
        texto,
        em: agora,
        autor: origem === "atendente" ? autor : "",
        midia: extras.midia ?? null,
        citada: extras.citada ?? null,
        // Mensagem da equipe em conversa de WhatsApp vai para a fila do bot.
        envio: origem === "atendente" && c.canal === "whatsapp" ? "pendente" : null,
      };
      criada = mensagem;

      // Quem escreve, assume. Exigir o botão antes de poder responder só
      // atrapalharia quem está com o cliente esperando do outro lado.
      const assumindo = origem === "atendente" && !c.assumidaPor;

      return {
        ...c,
        mensagens: [...c.mensagens, mensagem],
        atualizadaEm: agora,
        status: origem === "atendente" ? "com_atendente" : c.status,
        assumidaPor: assumindo ? autor : c.assumidaPor,
        assumidaEm: assumindo ? agora : c.assumidaEm,
        // Alguém da loja respondeu: o alerta foi atendido.
        alerta: origem === "atendente" ? null : c.alerta,
      };
    }),
  }));
  return criada as Mensagem | null;
}

/** Marca ou desmarca uma mensagem para achar depois. */
export function alternarMarcacao(conversaId: string, mensagemId: string) {
  alterarDados((d) => ({
    ...d,
    conversas: d.conversas.map((c) =>
      c.id === conversaId
        ? {
            ...c,
            mensagens: c.mensagens.map((m) =>
              m.id === mensagemId ? { ...m, marcada: !m.marcada } : m,
            ),
          }
        : c,
    ),
  }));
}

/** Tenta de novo uma mensagem que o bot não conseguiu entregar. */
export function reenviarMensagem(conversaId: string, mensagemId: string) {
  alterarDados((d) => ({
    ...d,
    conversas: d.conversas.map((c) =>
      c.id === conversaId
        ? {
            ...c,
            mensagens: c.mensagens.map((m) =>
              m.id === mensagemId && m.envio === "falhou" ? { ...m, envio: "pendente" } : m,
            ),
          }
        : c,
    ),
  }));
}

/** Tira o alerta sem responder (a dúvida foi resolvida por telefone, por exemplo). */
export function resolverAlerta(conversaId: string) {
  alterarDados((d) => ({
    ...d,
    conversas: d.conversas.map((c) => (c.id === conversaId ? { ...c, alerta: null } : c)),
  }));
}

/**
 * Alguém da loja passa a responder no lugar do agente.
 *
 * A conversa sai da fila do agente e o nome de quem assumiu fica visível
 * para todo mundo que abrir a tela. O bot do WhatsApp lê o status antes de
 * responder: conversa assumida, o agente fica quieto.
 */
export function assumirConversa(id: string, atendente: string) {
  const agora = Date.now();
  alterarDados((d) => ({
    ...d,
    conversas: d.conversas.map((c) =>
      c.id === id
        ? {
            ...c,
            status: "com_atendente",
            assumidaPor: atendente || "equipe da loja",
            assumidaEm: agora,
          }
        : c,
    ),
  }));
}

/** Devolve a conversa ao agente, que volta a responder sozinho. */
export function devolverAoAgente(id: string) {
  alterarDados((d) => ({
    ...d,
    conversas: d.conversas.map((c) =>
      c.id === id
        ? { ...c, status: "aberta", assumidaPor: "", assumidaEm: 0 }
        : c,
    ),
  }));
}

export function mudarStatusConversa(id: string, status: Conversa["status"]) {
  alterarDados((d) => ({
    ...d,
    conversas: d.conversas.map((c) =>
      c.id === id
        ? {
            ...c,
            status,
            // Reabrir devolve ao agente: se a loja quiser assumir de novo,
            // assume de novo, e aí fica registrado que foi uma segunda vez.
            assumidaPor: status === "aberta" ? "" : c.assumidaPor,
            assumidaEm: status === "aberta" ? 0 : c.assumidaEm,
            atualizadaEm: Date.now(),
          }
        : c,
    ),
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
  // O id nasce fora da mudança pelo mesmo motivo da loja nova: se a
  // gravação for reaplicada, o pedido que a tela recebeu continua sendo o
  // pedido que foi para o servidor.
  const id = novoId("ped");

  let criado: Pedido | null = null;
  alterarDados((d) => {
    if (d.pedidos.some((p) => p.id === id)) return d;
    // O contador vive no banco: a tela só carrega os pedidos recentes, e o
    // maior número à vista nem sempre é o maior que existe.
    const numero =
      Math.max(d.contadores.pedido, ...d.pedidos.map((p) => p.numero), 0) + 1;
    criado = {
      id,
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
    return {
      ...d,
      pedidos: [criado, ...d.pedidos],
      contadores: { ...d.contadores, pedido: numero },
      clientes: somarCompra(d.clientes, dados.telefone, subtotal + taxaEntrega, agora, 1),
    };
  });
  return criado as Pedido | null;
}

/**
 * Atualiza o resumo de compras do cliente daquele telefone. `sinal` -1
 * desfaz (pedido cancelado).
 */
export function somarCompra(
  clientes: Cliente[],
  telefone: string,
  valor: number,
  em: number,
  sinal: 1 | -1,
): Cliente[] {
  const fim = telefone.replace(/\D/g, "").slice(-8);
  if (fim.length < 8) return clientes;
  let tocou = false;
  const novos = clientes.map((c) => {
    if (tocou || !c.telefone.replace(/\D/g, "").endsWith(fim)) return c;
    tocou = true;
    return {
      ...c,
      compras: {
        quantidade: Math.max(0, c.compras.quantidade + sinal),
        total: Math.max(0, c.compras.total + sinal * valor),
        ultimaEm: sinal > 0 ? em : c.compras.ultimaEm,
      },
    };
  });
  return tocou ? novos : clientes;
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
  alterarDados((d) => {
    const pedido = d.pedidos.find((p) => p.id === id);
    if (!pedido || pedido.status === "cancelado") return d;
    return {
      ...d,
      pedidos: d.pedidos.map((p) =>
        p.id === id ? { ...p, status: "cancelado", atualizadoEm: Date.now() } : p,
      ),
      clientes: somarCompra(d.clientes, pedido.telefone, pedido.total, pedido.criadoEm, -1),
    };
  });
}

export function removerPedido(id: string) {
  alterarDados((d) => ({ ...d, pedidos: d.pedidos.filter((p) => p.id !== id) }));
}

/* ------------------------------------------------------------------
   Pagamentos
   ------------------------------------------------------------------ */

/** Chave Pix e recebedor. Área protegida. */
export function salvarPagamentos(dados: Partial<Pagamentos>) {
  return alterarDados((d) => ({ ...d, pagamentos: { ...d.pagamentos, ...dados } }));
}

/** O que o agente sabe da loja. Área protegida. */
export function salvarAjustesAgente(dados: AjustesAgente) {
  return alterarDados((d) => ({ ...d, agente: dados }));
}

/* ------------------------------------------------------------------
   Eventos do agente
   ------------------------------------------------------------------ */

/**
 * Registra algo que realmente aconteceu. Todos ficam no banco; a tela
 * carrega os 150 mais recentes.
 */
export function registrarEvento(dados: Omit<EventoAgente, "id" | "em">) {
  const evento: EventoAgente = { ...dados, id: novoId("evt"), em: Date.now() };
  alterarDados((d) => ({ ...d, eventos: [evento, ...d.eventos] }));
  return evento;
}

/* ------------------------------------------------------------------
   Conexão do WhatsApp
   ------------------------------------------------------------------ */

/**
 * Liga ou desliga as respostas automáticas do agente no WhatsApp.
 *
 * Desligado, o WhatsApp continua funcionando: as mensagens chegam ao painel
 * e a equipe responde por lá. É o botão de emergência, por isso não pede a
 * senha de ajustes: se o agente disser algo errado, qualquer pessoa da loja
 * precisa conseguir pará-lo na hora.
 */
export function definirAgenteLigado(ativo: boolean, quem: string) {
  return alterarDados((d) => ({
    ...d,
    agenteLigado: { ativo, alteradoPor: quem, em: Date.now() },
  }));
}

/**
 * Se o WhatsApp está no ar agora, pelo sinal que o bot manda a cada minuto.
 * Reavalia a cada 20 segundos: sem isso, um bot que parou de dar sinal
 * continuaria aparecendo como conectado até alguém mexer na tela.
 */
export function useWhatsappNoAr(estado: VisaoLoja["whatsapp"]) {
  const [agora, setAgora] = useState(0);
  useEffect(() => {
    const tick = () => setAgora(Date.now());
    const primeira = setTimeout(tick, 0);
    const id = setInterval(tick, 20000);
    return () => {
      clearTimeout(primeira);
      clearInterval(id);
    };
  }, []);
  return agora > 0 && whatsappNoAr(estado, agora);
}

/** Ajuda telas que precisam recarregar algo manualmente. */
export function useAcoes() {
  const [, forcar] = useState(0);
  const recarregar = useCallback(() => forcar((n) => n + 1), []);
  return { recarregar };
}
