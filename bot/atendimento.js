/**
 * O atendimento em si, sem nada de WhatsApp.
 *
 * Fica separado da conexão para dar para testar a regra inteira (cadastrar
 * cliente, gravar conversa, responder, criar pedido) sem precisar de um
 * celular do outro lado.
 */
import Anthropic from "@anthropic-ai/sdk";
import {
  AGENT_INSTRUCOES_PEDIDO,
  AGENT_MAX_TOKENS,
  AGENT_MODEL,
  AGENT_SYSTEM_PROMPT,
} from "../src/lib/agent-config.ts";
import { extrairContexto, montarTextoDoContexto } from "../src/lib/agente-contexto.ts";
import { precoAtual, STATUS_PEDIDO_LABEL } from "../src/lib/db/types.ts";
import { alterarLoja, lerLoja } from "./banco.js";

/** Quantas mensagens da conversa seguem para o modelo a cada resposta. */
const HISTORICO = 14;
/** Teto de idas e vindas com a ferramenta numa mesma resposta. */
const MAXIMO_VOLTAS = 3;

export function novoId(prefixo) {
  return `${prefixo}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Marca a resposta do agente que registrou um pedido. */
const PREFIXO_FECHOU_PEDIDO = "msg-ped";

/** Prefixo das conversas que nasceram de uma mensagem do cliente no WhatsApp. */
export const PREFIXO_CONVERSA_WHATSAPP = "cnv-wa";

/**
 * "5527999998888" vira "(27) 99999-8888", o mesmo formato que a loja digita
 * no cadastro. Número de fora do Brasil fica como veio, com o +.
 */
export function formatarTelefone(digitos) {
  const nacional = digitos.startsWith("55") && digitos.length >= 12 ? digitos.slice(2) : null;
  if (!nacional) return `+${digitos}`;
  const ddd = nacional.slice(0, 2);
  const numero = nacional.slice(2);
  return `(${ddd}) ${numero.slice(0, numero.length - 4)}-${numero.slice(-4)}`;
}

/** Os 10 ou 11 dígitos finais, para casar "(27) 9..." com "5527 9...". */
function finalDoTelefone(telefone) {
  return telefone.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
}

function mesmoTelefone(a, b) {
  const x = finalDoTelefone(a);
  const y = finalDoTelefone(b);
  return x.length >= 8 && x === y;
}

function semAcento(texto) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function reais(valor) {
  return `R$ ${valor.toFixed(2).replace(".", ",")}`;
}

/* ------------------------------------------------------------------
   Gravar o que chegou
   ------------------------------------------------------------------ */

/**
 * Registra a mensagem do cliente: cadastra (ou acha) o cliente pelo número
 * real, abre (ou continua) a conversa e guarda o texto.
 *
 * Devolve a conversa como ficou e se o agente deve responder. Quando alguém
 * da loja assumiu a conversa, o agente fica quieto.
 */
export async function registrarEntrada({ digitos, nomeWhatsapp, texto }) {
  const telefone = formatarTelefone(digitos);
  const agora = Date.now();
  const idCliente = novoId("cli");
  const idConversa = novoId(PREFIXO_CONVERSA_WHATSAPP);
  const idMensagem = novoId("msg");
  const nome = (nomeWhatsapp ?? "").trim().slice(0, 60) || `WhatsApp ${telefone}`;

  let conversaId = "";
  const resultado = await alterarLoja((d) => {
    let clientes = d.clientes;
    if (!clientes.some((c) => mesmoTelefone(c.telefone, telefone))) {
      clientes = [
        {
          id: idCliente,
          nome,
          telefone,
          // Escrever para a loja não é autorização para receber campanha.
          consentimento: false,
          observacao: "Cadastrado automaticamente pelo WhatsApp.",
          endereco: "",
          criadoEm: agora,
        },
        ...clientes,
      ];
    }
    const cliente = clientes.find((c) => mesmoTelefone(c.telefone, telefone));

    const mensagem = { id: idMensagem, origem: "cliente", texto, em: agora, autor: "" };
    const aberta = d.conversas.find(
      (c) => c.status !== "resolvida" && mesmoTelefone(c.telefone, telefone),
    );

    let conversas;
    if (aberta) {
      conversaId = aberta.id;
      if (aberta.mensagens.some((m) => m.id === idMensagem)) return d;
      conversas = d.conversas.map((c) =>
        c.id === aberta.id
          ? { ...c, mensagens: [...c.mensagens, mensagem], atualizadaEm: agora }
          : c,
      );
    } else {
      conversaId = idConversa;
      conversas = [
        {
          id: idConversa,
          cliente: cliente.nome,
          telefone,
          status: "aberta",
          mensagens: [mensagem],
          atualizadaEm: agora,
          assumidaPor: "",
          assumidaEm: 0,
          criadaEm: agora,
        },
        ...d.conversas,
      ];
    }

    const evento = {
      id: idMensagem.replace("msg", "evt"),
      tipo: "pergunta",
      titulo: `WhatsApp: ${cliente.nome}`,
      detalhe: texto.slice(0, 160),
      em: agora,
    };
    return {
      ...d,
      clientes,
      conversas,
      whatsappConectado: true,
      eventos: [evento, ...d.eventos].slice(0, 100),
    };
  });

  const conversa = resultado.dados.conversas.find((c) => c.id === conversaId);
  return { conversa, visao: { ...resultado.dados, loja: resultado.loja }, telefone };
}

/** Guarda a resposta do agente na conversa, do jeito que o painel mostra. */
export async function registrarResposta(conversaId, texto, { pedido = "" } = {}) {
  const agora = Date.now();
  // A mensagem que fecha um pedido leva uma marca no id: é dali para a
  // frente que o modelo passa a ler a conversa (ver `historico`).
  const id = novoId(pedido ? PREFIXO_FECHOU_PEDIDO : "msg");
  const titulo = pedido ? pedido.split(" registrado")[0] + " fechado pelo agente" : "Agente respondeu";
  await alterarLoja((d) => {
    if (!d.conversas.some((c) => c.id === conversaId)) return d;
    return {
      ...d,
      conversas: d.conversas.map((c) =>
        c.id === conversaId && !c.mensagens.some((m) => m.id === id)
          ? {
              ...c,
              mensagens: [...c.mensagens, { id, origem: "agente", texto, em: agora, autor: "" }],
              atualizadaEm: agora,
            }
          : c,
      ),
      eventos: [
        { id: `evt-${id}`, tipo: "resposta", titulo, detalhe: texto.slice(0, 160), em: agora },
        ...d.eventos,
      ].slice(0, 100),
    };
  });
}

/* ------------------------------------------------------------------
   Pedido
   ------------------------------------------------------------------ */

const FERRAMENTA_PEDIDO = {
  name: "registrar_pedido",
  description:
    "Registra o pedido no sistema da loja, que a equipe vê na hora na tela de Pedidos. Use só depois de o cliente confirmar o resumo (itens, quantidades, total, retirada ou entrega). Devolve o número do pedido ou o motivo de não ter registrado.",
  input_schema: {
    type: "object",
    properties: {
      itens: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          properties: {
            produto: {
              type: "string",
              description: "Nome do produto exatamente como está no catálogo.",
            },
            quantidade: { type: "integer", minimum: 1 },
          },
          required: ["produto", "quantidade"],
        },
      },
      forma_entrega: { type: "string", enum: ["retirada", "entrega"] },
      endereco_entrega: {
        type: "string",
        description: "Endereço completo. Obrigatório quando a forma é entrega.",
      },
      nome_cliente: { type: "string" },
      observacao: { type: "string" },
    },
    required: ["itens", "forma_entrega", "nome_cliente"],
  },
};

const FERRAMENTA_EQUIPE = {
  name: "chamar_equipe",
  description:
    "Avisa a equipe da loja no painel que este cliente precisa de uma pessoa: dúvida para o farmacêutico, pedido para falar com atendente ou reclamação.",
  input_schema: {
    type: "object",
    properties: {
      motivo: { type: "string", enum: ["farmaceutico", "atendente", "reclamacao"] },
      resumo: { type: "string", description: "A dúvida ou o pedido do cliente, em uma frase." },
    },
    required: ["motivo", "resumo"],
  },
};

const MOTIVOS = {
  farmaceutico: "Dúvida para o farmacêutico",
  atendente: "Cliente quer falar com alguém",
  reclamacao: "Reclamação",
};

/** Deixa o alerta no painel. A conversa continua com o agente até alguém assumir. */
async function chamarEquipe(entrada, conversa) {
  const agora = Date.now();
  const id = novoId("evt");
  const titulo = `${MOTIVOS[entrada?.motivo] ?? "Chamado"}: ${conversa.cliente}`;
  await alterarLoja((d) =>
    d.eventos.some((e) => e.id === id)
      ? d
      : {
          ...d,
          eventos: [
            { id, tipo: "erro", titulo, detalhe: String(entrada?.resumo ?? "").slice(0, 160), em: agora },
            ...d.eventos,
          ].slice(0, 100),
        },
  );
  return "Equipe avisada no painel. Diga ao cliente que alguém da loja vai responder por aqui.";
}

/**
 * Cria o pedido de verdade, conferindo tudo contra o catálogo.
 *
 * O modelo escolhe os itens, mas quem decide preço, estoque e se o item
 * exige receita é o banco. Nada do que o modelo escreve vira preço.
 */
async function criarPedido(entrada, conversa) {
  const pedidos = Array.isArray(entrada?.itens) ? entrada.itens : [];
  if (pedidos.length === 0) return "Não registrei: o pedido veio sem itens.";

  const { dados, loja } = await lerLoja();
  const itens = [];
  for (const pedido of pedidos) {
    const procurado = semAcento(String(pedido.produto ?? ""));
    const produto =
      dados.produtos.find((p) => semAcento(p.nome) === procurado) ??
      dados.produtos.find((p) => semAcento(p.nome).startsWith(procurado) && procurado.length >= 6);
    if (!produto) {
      return `Não registrei: "${pedido.produto}" não está no catálogo. Confirme o item com o cliente.`;
    }
    const quantidade = Math.max(1, Math.floor(Number(pedido.quantidade) || 1));
    if (produto.estoque < quantidade) {
      return `Não registrei: ${produto.nome} tem só ${produto.estoque} em estoque.`;
    }
    itens.push({
      produtoId: produto.id,
      nome: produto.nome,
      precoUnitario: precoAtual(produto),
      quantidade,
      exigeReceita: produto.exigeReceita,
    });
  }

  const entrega = entrada.forma_entrega === "entrega";
  if (entrega && !loja?.temMotoboy) return "Não registrei: esta loja não faz entrega, só retirada.";
  const endereco = String(entrada.endereco_entrega ?? "").trim();
  if (entrega && endereco.length < 8) return "Não registrei: falta o endereço completo da entrega.";

  const subtotal = itens.reduce((s, i) => s + i.precoUnitario * i.quantidade, 0);
  const taxaEntrega = entrega ? (loja?.taxaEntrega ?? 0) : 0;
  const nome = String(entrada.nome_cliente ?? "").trim().slice(0, 60) || conversa.cliente;
  const temReceita = itens.some((i) => i.exigeReceita);
  const agora = Date.now();
  const id = novoId("ped");

  let numero = 0;
  await alterarLoja((d) => {
    if (d.pedidos.some((p) => p.id === id)) return d;
    numero = d.pedidos.reduce((maior, p) => Math.max(maior, p.numero), 0) + 1;
    const novo = {
      id,
      numero,
      cliente: nome,
      telefone: conversa.telefone,
      origem: "whatsapp",
      itens,
      subtotal,
      taxaEntrega,
      total: subtotal + taxaEntrega,
      // Pagamento pelo WhatsApp é sempre na retirada ou na entrega: o Pix
      // automático ainda não dá baixa sozinho.
      status: temReceita ? "aguardando_receita" : "em_preparo",
      formaPagamento: "balcao",
      formaEntrega: entrega ? "entrega" : "retirada",
      enderecoEntrega: entrega ? endereco : "",
      pago: false,
      receitaConferidaPor: "",
      observacao: String(entrada.observacao ?? "").slice(0, 300),
      criadoEm: agora,
      atualizadoEm: agora,
    };
    return {
      ...d,
      pedidos: [novo, ...d.pedidos],
      // O cliente disse o nome e o endereço: o cadastro passa a ter os dois.
      clientes: d.clientes.map((c) =>
        mesmoTelefone(c.telefone, conversa.telefone)
          ? {
              ...c,
              nome: c.nome.startsWith("WhatsApp ") ? nome : c.nome,
              endereco: entrega ? endereco : c.endereco,
            }
          : c,
      ),
      conversas: d.conversas.map((c) =>
        c.id === conversa.id && c.cliente.startsWith("WhatsApp ") ? { ...c, cliente: nome } : c,
      ),
      eventos: [
        {
          id: id.replace("ped", "evt"),
          tipo: "sistema",
          titulo: `Pedido #${numero} pelo WhatsApp`,
          detalhe: `${nome}, ${reais(subtotal + taxaEntrega)}, ${entrega ? "entrega" : "retirada"}`,
          em: agora,
        },
        ...d.eventos,
      ].slice(0, 100),
    };
  });

  return [
    `Pedido #${numero} registrado.`,
    `Total ${reais(subtotal + taxaEntrega)}${taxaEntrega > 0 ? ` (com ${reais(taxaEntrega)} de entrega)` : ""}.`,
    `Situação: ${STATUS_PEDIDO_LABEL[temReceita ? "aguardando_receita" : "em_preparo"]}.`,
    temReceita ? "Tem item com receita: o farmacêutico confere antes de separar." : "",
    "Pagamento na retirada ou na entrega.",
  ]
    .filter(Boolean)
    .join(" ");
}

/* ------------------------------------------------------------------
   Responder
   ------------------------------------------------------------------ */

/**
 * As mensagens da conversa no formato do modelo, alternando os papéis.
 *
 * Só entra o que veio depois do último pedido fechado. Com a conversa
 * inteira, o modelo juntava os itens do pedido anterior no pedido novo,
 * mesmo instruído a não fazer isso; o pedido fechado continua visível para
 * ele no contexto, na lista de pedidos do cliente.
 */
function historico(conversa) {
  const fechou = conversa.mensagens.findLastIndex((m) => m.id.startsWith(PREFIXO_FECHOU_PEDIDO));
  const falas = [];
  for (const m of conversa.mensagens.slice(fechou + 1).slice(-HISTORICO)) {
    const role = m.origem === "cliente" ? "user" : "assistant";
    const ultima = falas[falas.length - 1];
    if (ultima?.role === role) ultima.content += `\n${m.texto}`;
    else falas.push({ role, content: m.texto });
  }
  while (falas.length && falas[0].role !== "user") falas.shift();
  return falas;
}

function pedidosDoCliente(visao, telefone) {
  const abertos = visao.pedidos
    .filter((p) => mesmoTelefone(p.telefone, telefone))
    .slice(0, 3)
    .map(
      (p) =>
        `- #${p.numero} (já registrado, fechado): ${p.itens.map((i) => `${i.quantidade}x ${i.nome}`).join(", ")}; ${STATUS_PEDIDO_LABEL[p.status]}, ${reais(p.total)}`,
    );
  return abertos.length ? ["Pedidos recentes deste cliente:", ...abertos].join("\n") : "";
}

export function criarAtendente(apiKey) {
  const claude = new Anthropic({ apiKey });

  return async function responder({ conversa, visao, telefone }) {
    const sistema = [
      AGENT_SYSTEM_PROMPT,
      AGENT_INSTRUCOES_PEDIDO,
      "## Contexto desta conversa",
      `Canal: WhatsApp. Cliente: ${conversa.cliente}, telefone ${telefone}.`,
      pedidosDoCliente(visao, telefone),
      montarTextoDoContexto(extrairContexto(visao)),
    ]
      .filter(Boolean)
      .join("\n\n");

    const mensagens = historico(conversa);
    if (mensagens.length === 0) return null;

    let registrou = "";
    for (let volta = 0; volta < MAXIMO_VOLTAS; volta++) {
      const resposta = await claude.messages.create({
        model: AGENT_MODEL,
        max_tokens: AGENT_MAX_TOKENS,
        system: sistema,
        tools: [FERRAMENTA_PEDIDO, FERRAMENTA_EQUIPE],
        messages: mensagens,
      });

      const usos = resposta.content.filter((b) => b.type === "tool_use");
      if (resposta.stop_reason !== "tool_use" || usos.length === 0) {
        const texto = resposta.content
          .filter((b) => b.type === "text")
          .map((b) => b.text)
          .join("\n")
          .trim();
        return { texto: texto || registrou, pedido: registrou };
      }

      mensagens.push({ role: "assistant", content: resposta.content });
      const resultados = [];
      for (const uso of usos) {
        let conteudo;
        try {
          conteudo =
            uso.name === "registrar_pedido"
              ? await criarPedido(uso.input, conversa)
              : uso.name === "chamar_equipe"
                ? await chamarEquipe(uso.input, conversa)
                : `Ferramenta desconhecida: ${uso.name}`;
        } catch (erro) {
          conteudo = `Não registrei: falha ao gravar no sistema (${erro.message}). Diga ao cliente que a equipe vai confirmar.`;
        }
        if (conteudo.startsWith("Pedido #")) registrou = conteudo;
        resultados.push({ type: "tool_result", tool_use_id: uso.id, content: conteudo });
      }
      mensagens.push({ role: "user", content: resultados });
    }
    return { texto: registrou || "Já te respondo, um instante.", pedido: registrou };
  };
}
