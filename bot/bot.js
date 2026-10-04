/**
 * Bot de WhatsApp da Preço Baixo, em teste.
 *
 * Usa o Baileys, que entra no WhatsApp como se fosse o WhatsApp Web, lendo o
 * QR code com o celular. Serve para testar com um chip reserva sem custo; não
 * é a API oficial da Meta e o WhatsApp pode banir o número se for usado para
 * disparo em massa. Por isso este bot só responde quem escreveu primeiro.
 *
 * Tudo que acontece aqui vai para o mesmo banco do painel: o cliente é
 * cadastrado com o número real, a conversa aparece em Conversas, o pedido
 * aparece em Pedidos. Quando alguém da loja assume a conversa no painel, o
 * bot para de responder e passa a entregar no WhatsApp o que a pessoa
 * escreveu lá.
 *
 * Rodar: `npm install` nesta pasta, depois `npm start`. O QR aparece em
 * `qr.png` na primeira vez; depois a sessão fica salva em `sessao/`.
 */
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import pino from "pino";
import { readFileSync, writeFileSync } from "node:fs";
import { lerLoja } from "./banco.js";
import {
  PREFIXO_CONVERSA_WHATSAPP,
  criarAtendente,
  registrarEntrada,
  registrarResposta,
} from "./atendimento.js";

const pasta = (arquivo) => new URL(arquivo, import.meta.url).pathname;

// A chave da Anthropic vem do .env.local do projeto e nunca é impressa.
const env = readFileSync(pasta("../.env.local"), "utf8");
const chaveApi = env.match(/^ANTHROPIC_API_KEY=(.+)$/m)?.[1]?.trim();
if (!chaveApi) throw new Error("ANTHROPIC_API_KEY ausente no .env.local");
const responder = criarAtendente(chaveApi);

/** Mensagens que o agente responde por contato por dia, para a conta não fugir. */
const LIMITE_POR_CONTATO = 60;
/** Espera para juntar mensagens seguidas do cliente numa resposta só. */
const JUNTAR_MS = 2500;
/** De quanto em quanto tempo o bot olha se alguém da loja escreveu. */
const CONSULTA_MS = 5000;

let sock = null;
const usoDoDia = new Map();
const pendentes = new Map(); // jid -> { textos, timer, digitos, nome }
const filas = new Map(); // jid -> promessa da vez

function log(...partes) {
  console.log(new Date().toISOString().slice(11, 19), ...partes);
}

/** Últimos 4 dígitos, para o log nunca guardar o número inteiro. */
function mascara(digitos) {
  return `***${digitos.slice(-4)}`;
}

function contarUso(digitos) {
  const hoje = new Date().toISOString().slice(0, 10);
  const chave = `${hoje}:${digitos}`;
  const total = (usoDoDia.get(chave) ?? 0) + 1;
  usoDoDia.set(chave, total);
  return total;
}

/* ------------------------------------------------------------------
   Cliente escreveu
   ------------------------------------------------------------------ */

/**
 * O número de verdade de quem escreveu.
 *
 * O WhatsApp agora pode esconder o número atrás de um identificador (@lid).
 * Nesse caso o número real vem em `remoteJidAlt`; sem ele, pergunta ao
 * mapeamento do próprio Baileys.
 */
async function numeroReal(msg) {
  const jid = msg.key.remoteJid;
  let pn = jid.endsWith("@lid") ? msg.key.remoteJidAlt : jid;
  if (!pn && jid.endsWith("@lid")) {
    pn = await sock.signalRepository?.lidMapping?.getPNForLID?.(jid).catch(() => null);
  }
  return pn ? pn.split("@")[0].split(":")[0] : null;
}

async function atender(jid, digitos, nome, texto) {
  const { conversa, visao, telefone } = await registrarEntrada({
    digitos,
    nomeWhatsapp: nome,
    texto,
  });
  if (!conversa) return;

  if (conversa.status === "com_atendente") {
    log("conversa com atendente, agente quieto", mascara(digitos));
    return;
  }

  const uso = contarUso(digitos);
  if (uso > LIMITE_POR_CONTATO) {
    if (uso === LIMITE_POR_CONTATO + 1) {
      await enviar(jid, "Vou pedir para alguém da equipe continuar com você por aqui.");
    }
    log("limite do dia atingido", mascara(digitos));
    return;
  }

  await sock.sendPresenceUpdate("composing", jid).catch(() => {});
  let resposta;
  try {
    resposta = await responder({ conversa, visao, telefone });
  } catch (erro) {
    log("erro no Claude:", erro.message);
    resposta = { texto: "Tive um problema para responder agora. Já já alguém da equipe te atende.", pedido: "" };
  }
  if (!resposta?.texto) return;

  await enviar(jid, resposta.texto);
  await registrarResposta(conversa.id, resposta.texto, { pedido: resposta.pedido });
  log("respondido", mascara(digitos), resposta.pedido ? `(${resposta.pedido.split(".")[0]})` : "");
}

async function enviar(jid, texto) {
  await sock.sendMessage(jid, { text: texto });
}

/** Junta mensagens seguidas e garante uma resposta por vez por contato. */
function receber(jid, digitos, nome, texto) {
  const atual = pendentes.get(jid) ?? { textos: [], timer: null, digitos, nome };
  atual.textos.push(texto);
  clearTimeout(atual.timer);
  atual.timer = setTimeout(() => {
    pendentes.delete(jid);
    const junto = atual.textos.join("\n");
    const anterior = filas.get(jid) ?? Promise.resolve();
    const vez = anterior
      .then(() => atender(jid, atual.digitos, atual.nome, junto))
      .catch((erro) => log("erro ao atender:", erro.message));
    filas.set(jid, vez);
  }, JUNTAR_MS);
  pendentes.set(jid, atual);
}

/* ------------------------------------------------------------------
   Alguém da loja escreveu no painel
   ------------------------------------------------------------------ */

const ARQUIVO_ENTREGUES = pasta("estado-entregues.json");
let entregues = null;

function lerEntregues() {
  try {
    return new Set(JSON.parse(readFileSync(ARQUIVO_ENTREGUES, "utf8")));
  } catch {
    return null;
  }
}

/**
 * Leva para o WhatsApp o que o atendente escreveu na tela de Conversas.
 *
 * Só em conversa que o cliente começou pelo WhatsApp: conversa aberta no
 * painel para alguém que nunca escreveu não vira mensagem, porque mandar
 * mensagem para quem não pediu é o caminho mais rápido para o número ser
 * banido.
 */
async function levarRespostasDoPainel() {
  if (!sock?.user) return;
  const { dados } = await lerLoja();
  const daLoja = [];
  for (const c of dados.conversas) {
    if (!c.id.startsWith(PREFIXO_CONVERSA_WHATSAPP)) continue;
    for (const m of c.mensagens) {
      if (m.origem === "atendente") daLoja.push({ conversa: c, mensagem: m });
    }
  }

  // Na primeira volta, o que já existe conta como entregue: o bot não
  // reenvia o histórico inteiro toda vez que reinicia.
  if (entregues === null) {
    entregues = lerEntregues() ?? new Set(daLoja.map((x) => x.mensagem.id));
    writeFileSync(ARQUIVO_ENTREGUES, JSON.stringify([...entregues]));
  }

  for (const { conversa, mensagem } of daLoja) {
    if (entregues.has(mensagem.id)) continue;
    const digitos = conversa.telefone.replace(/\D/g, "");
    const jid = `${digitos.length <= 11 ? `55${digitos}` : digitos}@s.whatsapp.net`;
    await enviar(jid, mensagem.texto);
    entregues.add(mensagem.id);
    writeFileSync(ARQUIVO_ENTREGUES, JSON.stringify([...entregues]));
    log("mensagem do atendente entregue", mascara(digitos));
  }
}

/* ------------------------------------------------------------------
   Conexão
   ------------------------------------------------------------------ */

async function iniciar() {
  const { state, saveCreds } = await useMultiFileAuthState(pasta("sessao"));
  const { version } = await fetchLatestBaileysVersion();
  sock = makeWASocket({ version, auth: state, logger: pino({ level: "silent" }) });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      await QRCode.toFile(pasta("qr.png"), qr, { scale: 8, margin: 2 });
      log("QR_PRONTO: abra qr.png e leia com o WhatsApp do chip do bot");
    }
    if (connection === "open") log("CONECTADO");
    if (connection === "close") {
      const codigo = lastDisconnect?.error?.output?.statusCode;
      log("FECHOU", codigo, lastDisconnect?.error?.message ?? "");
      if (codigo !== DisconnectReason.loggedOut) setTimeout(iniciar, 3000);
      else log("DESLOGADO: apague a pasta sessao e leia o QR de novo");
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const msg of messages) {
      const jid = msg.key.remoteJid;
      if (msg.key.fromMe || !jid) continue;
      if (jid.endsWith("@g.us") || jid.endsWith("@broadcast") || jid.endsWith("@newsletter")) continue;
      const texto = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || "").trim();
      if (!texto) continue;
      const digitos = await numeroReal(msg);
      if (!digitos) {
        log("mensagem sem número identificável, ignorada");
        continue;
      }
      log("mensagem de", mascara(digitos));
      receber(jid, digitos, msg.pushName, texto.slice(0, 1000));
    }
  });
}

iniciar();
setInterval(() => {
  levarRespostasDoPainel().catch((erro) => log("erro ao levar respostas:", erro.message));
}, CONSULTA_MS);
