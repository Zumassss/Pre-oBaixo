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
import {
  CLIENTE_PADRAO,
  MENSAGEM_PADRAO,
  precoAtual,
  STATUS_PEDIDO_LABEL,
} from "../src/lib/db/types.ts";
import { calcularEntrega, distanciaKm, FATOR_RUA, localizarEndereco } from "../src/lib/loja-regras.ts";
import { alterarLoja, lerLoja } from "./banco.js";
import { baixarMidia } from "./midia.js";

/** Quantas mensagens da conversa seguem para o modelo a cada resposta. */
const HISTORICO = 14;
/** Teto de idas e vindas com as ferramentas numa mesma resposta. */
const MAXIMO_VOLTAS = 4;
/** Marca a resposta do agente que registrou um pedido. */
const PREFIXO_FECHOU_PEDIDO = "msg-ped";

export function novoId(prefixo) {
  return `${prefixo}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

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

/** Os 8 dígitos finais: casam "(27) 9..." com "5527 9..." e com o 9 extra. */
function fimDoTelefone(telefone) {
  return telefone.replace(/\D/g, "").slice(-8);
}

export function mesmoTelefone(a, b) {
  const x = fimDoTelefone(a);
  return x.length === 8 && x === fimDoTelefone(b);
}

function semAcento(texto) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function reais(valor) {
  return `R$ ${valor.toFixed(2).replace(".", ",")}`;
}

/** O que aparece no lugar de uma mídia, para quem lê só o texto. */
export function descreverMidia(midia) {
  if (!midia) return "";
  if (midia.tipo === "imagem") return "[foto]";
  if (midia.tipo === "audio") return "[áudio]";
  if (midia.tipo === "video") return "[vídeo]";
  return `[arquivo: ${midia.nome || "documento"}]`;
}

/* ------------------------------------------------------------------
   Gravar o que chegou
   ------------------------------------------------------------------ */

/**
 * Registra a mensagem do cliente: cadastra (ou acha) o cliente pelo número
 * real, abre (ou continua) a conversa e guarda o texto, a mídia e a citação.
 *
 * Devolve a conversa como ficou e se o agente deve responder: não responde
 * quando alguém da loja assumiu a conversa ou quando o agente está desligado.
 * Nos dois casos a mensagem fica no painel do mesmo jeito.
 */
export async function registrarEntrada({ digitos, nomeWhatsapp, texto, midia = null, wa = null, citadaWaId = "" }) {
  const telefone = formatarTelefone(digitos);
  const agora = Date.now();
  const idCliente = novoId("cli");
  const idConversa = novoId("cnv-wa");
  const idMensagem = novoId("msg");
  const nome = (nomeWhatsapp ?? "").trim().slice(0, 60) || `WhatsApp ${telefone}`;

  let conversaId = "";
  const { dados, loja } = await alterarLoja((d) => {
    let clientes = d.clientes;
    const existente = clientes.find((c) => mesmoTelefone(c.telefone, telefone));
    if (!existente) {
      clientes = [
        {
          ...CLIENTE_PADRAO,
          id: idCliente,
          nome,
          telefone,
          // Escrever para a loja não é autorização para receber campanha.
          consentimento: false,
          origem: "whatsapp",
          observacao: "Cadastrado automaticamente pelo WhatsApp.",
          criadoEm: agora,
          primeiraMensagemEm: agora,
          ultimaMensagemEm: agora,
        },
        ...clientes,
      ];
    } else if (existente.ultimaMensagemEm < agora) {
      clientes = clientes.map((c) =>
        c.id === existente.id
          ? { ...c, primeiraMensagemEm: c.primeiraMensagemEm || agora, ultimaMensagemEm: agora }
          : c,
      );
    }
    const cliente = clientes.find((c) => mesmoTelefone(c.telefone, telefone));

    const aberta = d.conversas.find((c) => c.status !== "resolvida" && mesmoTelefone(c.telefone, telefone));
    const citada = citadaWaId
      ? aberta?.mensagens.find((m) => m.wa?.id === citadaWaId)
      : null;

    const mensagem = {
      ...MENSAGEM_PADRAO,
      id: idMensagem,
      origem: "cliente",
      texto,
      em: agora,
      midia,
      wa,
      citada: citada
        ? { id: citada.id, texto: citada.texto || descreverMidia(citada.midia), origem: citada.origem }
        : null,
    };

    let conversas;
    if (aberta) {
      conversaId = aberta.id;
      if (aberta.mensagens.some((m) => m.id === idMensagem)) return d;
      conversas = d.conversas.map((c) =>
        c.id === aberta.id
          ? {
              ...c,
              canal: "whatsapp",
              mensagens: [...c.mensagens, mensagem],
              atualizadaEm: agora,
            }
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
          canal: "whatsapp",
          alerta: null,
          etapa: "conversa",
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
      id: `evt-${idMensagem}`,
      tipo: "pergunta",
      titulo: `WhatsApp: ${cliente.nome}`,
      detalhe: (texto || descreverMidia(midia)).slice(0, 160),
      em: agora,
    };
    return { ...d, clientes, conversas, eventos: [evento, ...d.eventos] };
  });

  const conversa = dados.conversas.find((c) => c.id === conversaId);
  const motivoSilencio = !conversa
    ? "sem conversa"
    : conversa.status === "com_atendente"
      ? "com atendente"
      : !dados.agenteLigado.ativo
        ? "agente desligado"
        : "";
  return { conversa, dados, loja, telefone, responder: !motivoSilencio, motivoSilencio };
}

/**
 * Até onde a conversa chegou no caminho da venda. Só avança: uma conversa que
 * já virou pedido não volta a ser "pediu preço".
 */
function proximaEtapa(atual, texto, fechouPedido) {
  const ordem = ["conversa", "orcamento", "carrinho", "pedido"];
  let nova = "conversa";
  if (fechouPedido) nova = "pedido";
  else if (/R\$\s?\d/.test(texto) && /confirm|posso registrar|fechar o pedido|tá certo/i.test(texto)) nova = "carrinho";
  else if (/R\$\s?\d/.test(texto)) nova = "orcamento";
  return ordem.indexOf(nova) > ordem.indexOf(atual ?? "conversa") ? nova : atual;
}

/** Guarda a resposta do agente na conversa, do jeito que o painel mostra. */
export async function registrarResposta(conversaId, texto, { pedido = "", wa = null } = {}) {
  const agora = Date.now();
  // A mensagem que fecha um pedido leva uma marca no id: é dali para a
  // frente que o modelo passa a ler a conversa (ver `historico`).
  const id = novoId(pedido ? PREFIXO_FECHOU_PEDIDO : "msg");
  const titulo = pedido ? `${pedido.split(" registrado")[0]} fechado pelo agente` : "Agente respondeu";
  await alterarLoja((d) => {
    if (!d.conversas.some((c) => c.id === conversaId)) return d;
    return {
      ...d,
      conversas: d.conversas.map((c) =>
        c.id === conversaId && !c.mensagens.some((m) => m.id === id)
          ? {
              ...c,
              mensagens: [...c.mensagens, { ...MENSAGEM_PADRAO, id, origem: "agente", texto, em: agora, wa }],
              atualizadaEm: agora,
              etapa: proximaEtapa(c.etapa, texto, Boolean(pedido)),
            }
          : c,
      ),
      eventos: [
        { id: `evt-${id}`, tipo: "resposta", titulo, detalhe: texto.slice(0, 160), em: agora },
        ...d.eventos,
      ],
    };
  });
}

/* ------------------------------------------------------------------
   Ferramentas
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
            produto: { type: "string", description: "Nome do produto exatamente como está no catálogo." },
            quantidade: { type: "integer", minimum: 1 },
          },
          required: ["produto", "quantidade"],
        },
      },
      forma_entrega: { type: "string", enum: ["retirada", "entrega"] },
      rua: { type: "string", description: "Rua e número, quando for entrega." },
      complemento: { type: "string", description: "Apartamento, bloco, referência." },
      bairro: { type: "string", description: "Bairro, quando for entrega." },
      nome_cliente: { type: "string" },
      pagamento: {
        type: "string",
        description: "Como o cliente vai pagar: dinheiro, cartão, Pix. Se for dinheiro, diga para quanto é o troco.",
      },
      observacao: { type: "string" },
    },
    required: ["itens", "forma_entrega", "nome_cliente"],
  },
};

const FERRAMENTA_ENTREGA = {
  name: "calcular_entrega",
  description:
    "Calcula a taxa de entrega para um endereço, pelas regras da loja (fixa, por bairro ou por distância). Use antes de dizer o valor da entrega ao cliente.",
  input_schema: {
    type: "object",
    properties: {
      rua: { type: "string", description: "Rua e número." },
      bairro: { type: "string" },
      subtotal: { type: "number", description: "Soma dos produtos, sem a entrega." },
    },
    required: ["bairro", "subtotal"],
  },
};

const FERRAMENTA_EQUIPE = {
  name: "chamar_equipe",
  description:
    "Avisa a equipe da loja no painel que este cliente precisa de uma pessoa: dúvida para o farmacêutico (remédio, dose, sintoma, interação, receita), pedido para falar com atendente ou reclamação. A conversa fica destacada e toca um aviso no painel.",
  input_schema: {
    type: "object",
    properties: {
      motivo: { type: "string", enum: ["farmaceutico", "atendente", "reclamacao"] },
      resumo: { type: "string", description: "A dúvida ou o pedido do cliente, em uma frase." },
    },
    required: ["motivo", "resumo"],
  },
};

const ROTULO_ALERTA = {
  farmaceutico: "Dúvida para o farmacêutico",
  atendente: "Cliente quer falar com alguém",
  reclamacao: "Reclamação",
};

/** Marca a conversa e deixa o alerta no painel. O agente segue respondendo o resto. */
async function chamarEquipe(entrada, conversa) {
  const agora = Date.now();
  const tipo = ROTULO_ALERTA[entrada?.motivo] ? entrada.motivo : "atendente";
  const resumo = String(entrada?.resumo ?? "").slice(0, 200);
  const id = novoId("evt");
  await alterarLoja((d) => {
    if (d.eventos.some((e) => e.id === id)) return d;
    return {
      ...d,
      conversas: d.conversas.map((c) =>
        c.id === conversa.id ? { ...c, alerta: { tipo, resumo, em: agora } } : c,
      ),
      eventos: [
        { id, tipo: "erro", titulo: `${ROTULO_ALERTA[tipo]}: ${conversa.cliente}`, detalhe: resumo, em: agora },
        ...d.eventos,
      ],
    };
  });
  return "Equipe avisada no painel. Diga ao cliente que alguém da loja vai responder por aqui, sem prometer prazo.";
}

/* Endereços já localizados nesta execução, para não repetir consulta. */
const localizados = new Map();

async function localizar(partes) {
  const chave = JSON.stringify(partes);
  if (!localizados.has(chave)) localizados.set(chave, await localizarEndereco(partes));
  return localizados.get(chave);
}

/** Separa "Rua X, 45" em rua e número. */
function separarNumero(rua) {
  const m = String(rua ?? "").match(/^(.*?)[,\s]+(\d+[a-zA-Z]?)\b/);
  return m ? { rua: m[1].trim(), numero: m[2] } : { rua: String(rua ?? "").trim(), numero: "" };
}

/** A taxa de entrega pelas regras da loja. Nunca pelo que o modelo calculou. */
async function taxaDaEntrega(dados, loja, { rua, bairro, subtotal }) {
  if (!loja?.temMotoboy) return { ok: false, motivo: "Esta loja não faz entrega, só retirada." };
  const entrega = dados.agente.entrega;
  let km = null;
  if (entrega.modo === "distancia") {
    const origem =
      dados.agente.localizacao ??
      (await localizar({
        ...separarNumero(loja.endereco),
        bairro: loja.bairro,
        cidade: loja.cidade,
        uf: loja.uf,
      }));
    const destino = await localizar({ ...separarNumero(rua), bairro, cidade: loja.cidade, uf: loja.uf });
    if (origem && destino) km = distanciaKm(origem, destino) * FATOR_RUA;
  }
  return calcularEntrega(entrega, { subtotal: Number(subtotal) || 0, bairro, km });
}

async function calcularEntregaFerramenta(entrada) {
  const { dados, loja } = lerLoja();
  const r = await taxaDaEntrega(dados, loja, {
    rua: entrada?.rua,
    bairro: String(entrada?.bairro ?? ""),
    subtotal: entrada?.subtotal,
  });
  return r.ok
    ? `Taxa de entrega: ${reais(r.taxa)} (${r.detalhe}).`
    : `Não dá para entregar assim: ${r.motivo}`;
}

/**
 * Cria o pedido de verdade, conferindo tudo contra o catálogo.
 *
 * O modelo escolhe os itens, mas quem decide preço, estoque, taxa de entrega
 * e se o item exige receita é o banco. Nada do que o modelo escreve vira
 * preço.
 */
async function criarPedido(entrada, conversa) {
  const pedidos = Array.isArray(entrada?.itens) ? entrada.itens : [];
  if (pedidos.length === 0) return "Não registrei: o pedido veio sem itens.";

  const { dados, loja } = lerLoja();
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

  const subtotal = itens.reduce((s, i) => s + i.precoUnitario * i.quantidade, 0);
  const entrega = entrada.forma_entrega === "entrega";
  let taxaEntrega = 0;
  let endereco = "";
  if (entrega) {
    const rua = String(entrada.rua ?? "").trim();
    const bairro = String(entrada.bairro ?? "").trim();
    if (rua.length < 5 || !bairro) return "Não registrei: falta rua, número e bairro da entrega.";
    const calculo = await taxaDaEntrega(dados, loja, { rua, bairro, subtotal });
    if (!calculo.ok) return `Não registrei: ${calculo.motivo}`;
    taxaEntrega = calculo.taxa;
    endereco = [rua, String(entrada.complemento ?? "").trim(), bairro].filter(Boolean).join(", ");
  }

  const nome = String(entrada.nome_cliente ?? "").trim().slice(0, 60) || conversa.cliente;
  const temReceita = itens.some((i) => i.exigeReceita);
  const observacao = [String(entrada.pagamento ?? "").trim() && `Pagamento: ${String(entrada.pagamento).trim()}`, String(entrada.observacao ?? "").trim()]
    .filter(Boolean)
    .join(". ")
    .slice(0, 300);
  const agora = Date.now();
  const id = novoId("ped");
  const total = subtotal + taxaEntrega;

  let numero = 0;
  await alterarLoja((d) => {
    if (d.pedidos.some((p) => p.id === id)) return d;
    numero = Math.max(d.contadores.pedido, ...d.pedidos.map((p) => p.numero), 0) + 1;
    const novo = {
      id,
      numero,
      cliente: nome,
      telefone: conversa.telefone,
      origem: "whatsapp",
      itens,
      subtotal,
      taxaEntrega,
      total,
      // Pagamento pelo WhatsApp é sempre na retirada ou na entrega: o Pix
      // automático ainda não dá baixa sozinho.
      status: temReceita ? "aguardando_receita" : "em_preparo",
      formaPagamento: "balcao",
      formaEntrega: entrega ? "entrega" : "retirada",
      enderecoEntrega: endereco,
      pago: false,
      receitaConferidaPor: "",
      observacao,
      criadoEm: agora,
      atualizadoEm: agora,
    };
    let tocou = false;
    return {
      ...d,
      pedidos: [novo, ...d.pedidos],
      contadores: { ...d.contadores, pedido: numero },
      // O cliente disse o nome e o endereço: o cadastro passa a ter os dois,
      // e o resumo de compras dele cresce.
      clientes: d.clientes.map((c) => {
        if (tocou || !mesmoTelefone(c.telefone, conversa.telefone)) return c;
        tocou = true;
        return {
          ...c,
          nome: c.nome.startsWith("WhatsApp ") ? nome : c.nome,
          endereco: entrega ? endereco : c.endereco,
          compras: {
            quantidade: c.compras.quantidade + 1,
            total: c.compras.total + total,
            ultimaEm: agora,
          },
        };
      }),
      conversas: d.conversas.map((c) =>
        c.id === conversa.id
          ? { ...c, cliente: c.cliente.startsWith("WhatsApp ") ? nome : c.cliente, etapa: "pedido" }
          : c,
      ),
      eventos: [
        {
          id: `evt-${id}`,
          tipo: "sistema",
          titulo: `Pedido #${numero} pelo WhatsApp`,
          detalhe: `${nome}, ${reais(total)}, ${entrega ? "entrega" : "retirada"}`,
          em: agora,
        },
        ...d.eventos,
      ],
    };
  });

  return [
    `Pedido #${numero} registrado.`,
    `Total ${reais(total)}${taxaEntrega > 0 ? ` (com ${reais(taxaEntrega)} de entrega)` : ""}.`,
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
 *
 * Foto do cliente vai como imagem (o modelo enxerga), mas só a última: cada
 * foto custa como uma página de texto.
 */
async function historico(conversa) {
  const fechou = conversa.mensagens.findLastIndex((m) => m.id.startsWith(PREFIXO_FECHOU_PEDIDO));
  const recorte = conversa.mensagens.slice(fechou + 1).slice(-HISTORICO);
  const ultimaFoto = recorte.findLast((m) => m.origem === "cliente" && m.midia?.tipo === "imagem");

  const falas = [];
  for (const m of recorte) {
    const role = m.origem === "cliente" ? "user" : "assistant";
    const blocos = [];
    if (m === ultimaFoto) {
      try {
        const buffer = await baixarMidia(m.midia.caminho);
        if (buffer.length < 4_500_000) {
          blocos.push({
            type: "image",
            source: { type: "base64", media_type: m.midia.mime.split(";")[0], data: buffer.toString("base64") },
          });
        }
      } catch {
        // Sem a foto, segue com a descrição.
      }
    }
    const texto = [m.midia && !(m === ultimaFoto && blocos.length) ? descreverMidia(m.midia) : "", m.texto]
      .filter(Boolean)
      .join(" ");
    if (texto) blocos.push({ type: "text", text: texto });
    if (blocos.length === 0) continue;

    const ultima = falas[falas.length - 1];
    if (ultima?.role === role) ultima.content.push(...blocos);
    else falas.push({ role, content: blocos });
  }
  while (falas.length && falas[0].role !== "user") falas.shift();
  return falas;
}

function pedidosDoCliente(dados, telefone) {
  const lista = dados.pedidos
    .filter((p) => mesmoTelefone(p.telefone, telefone))
    .slice(0, 3)
    .map(
      (p) =>
        `- #${p.numero} (já registrado, fechado): ${p.itens.map((i) => `${i.quantidade}x ${i.nome}`).join(", ")}; ${STATUS_PEDIDO_LABEL[p.status]}, ${reais(p.total)}`,
    );
  return lista.length ? ["Pedidos recentes deste cliente:", ...lista].join("\n") : "";
}

function agoraEmBrasilia() {
  return new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function criarAtendente(apiKey) {
  const claude = new Anthropic({ apiKey });

  return async function responder({ conversa, dados, loja, telefone }) {
    const contexto = extrairContexto({ ...dados, loja });
    const sistema = [
      AGENT_SYSTEM_PROMPT,
      AGENT_INSTRUCOES_PEDIDO,
      "## Contexto desta conversa",
      `Canal: WhatsApp. Cliente: ${conversa.cliente}, telefone ${telefone}.`,
      // Sem isto ele dizia "estamos abertos" sem saber a hora, e perguntava
      // ao cliente que dia era.
      `Agora é ${agoraEmBrasilia()} (horário de Brasília). Nunca pergunte o dia ou a hora ao cliente.`,
      pedidosDoCliente(dados, telefone),
      montarTextoDoContexto(contexto),
    ]
      .filter(Boolean)
      .join("\n\n");

    const mensagens = await historico(conversa);
    if (mensagens.length === 0) return null;

    const ferramentas = [FERRAMENTA_PEDIDO, FERRAMENTA_EQUIPE];
    if (loja?.temMotoboy) ferramentas.push(FERRAMENTA_ENTREGA);

    let registrou = "";
    for (let volta = 0; volta < MAXIMO_VOLTAS; volta++) {
      const resposta = await claude.messages.create({
        model: AGENT_MODEL,
        max_tokens: AGENT_MAX_TOKENS,
        system: sistema,
        tools: ferramentas,
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
                : uso.name === "calcular_entrega"
                  ? await calcularEntregaFerramenta(uso.input)
                  : `Ferramenta desconhecida: ${uso.name}`;
        } catch (erro) {
          conteudo = `Não deu certo: falha ao gravar no sistema (${erro.message}). Diga ao cliente que a equipe vai confirmar.`;
        }
        if (conteudo.startsWith("Pedido #")) registrou = conteudo;
        resultados.push({ type: "tool_result", tool_use_id: uso.id, content: conteudo });
      }
      mensagens.push({ role: "user", content: resultados });
    }
    return { texto: registrou || "Já te respondo, um instante.", pedido: registrou };
  };
}
