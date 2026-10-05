/**
 * Bot de WhatsApp da Preço Baixo, em teste.
 *
 * Usa o Baileys, que entra no WhatsApp como se fosse o WhatsApp Web, lendo o
 * QR code com o celular. Serve para testar com um chip reserva sem custo; não
 * é a API oficial da Meta, e o WhatsApp pode banir o número se for usado para
 * disparo em massa. Por isso este bot só fala com quem escreveu primeiro.
 *
 * Duas coisas separadas aqui, de propósito:
 *
 *  1. O WhatsApp. Toda mensagem que chega vai para o painel na hora, com foto,
 *     áudio e arquivo. Tudo que a equipe escreve no painel sai pelo WhatsApp.
 *     Isso funciona sempre, mesmo sem agente.
 *  2. O agente. Responde sozinho quando está ligado e ninguém da loja assumiu
 *     a conversa. Se a IA falhar (sem crédito, fora do ar), a conversa ganha
 *     um alerta no painel e a equipe assume; o WhatsApp não para por isso.
 *
 * Rodar: `npm install` nesta pasta, depois `npm start` (ou `./manter-ligado.sh`
 * para reiniciar sozinho se cair). O QR aparece em `qr.png` na primeira vez;
 * depois a sessão fica salva em `sessao/`.
 */
import makeWASocket, {
  DisconnectReason,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import pino from "pino";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tipoDaMidia } from "../src/lib/db/types.ts";
import { alterarLoja, iniciarBanco, lerLoja, ouvirMudancas, puxar } from "./banco.js";
import {
  criarAtendente,
  descreverMidia,
  mesmoTelefone,
  registrarEntrada,
  registrarResposta,
} from "./atendimento.js";
import { baixarMidia, guardarMidia, paraVoz } from "./midia.js";

const pasta = (arquivo) => new URL(arquivo, import.meta.url).pathname;
const logger = pino({ level: "silent" });

// A chave da Anthropic vem do .env.local do projeto e nunca é impressa. Sem
// ela o bot roda do mesmo jeito: só o agente fica sem responder.
const arquivoEnv = pasta("../.env.local");
const chaveApi = existsSync(arquivoEnv)
  ? readFileSync(arquivoEnv, "utf8").match(/^ANTHROPIC_API_KEY=(.+)$/m)?.[1]?.trim()
  : undefined;
const responder = chaveApi ? criarAtendente(chaveApi) : null;

/** Respostas automáticas por contato por dia, para a conta não fugir. */
const LIMITE_POR_CONTATO = 60;
/** Espera depois da última mensagem do cliente antes de responder. */
const JUNTAR_MS = 2500;
/** De quanto em quanto tempo o bot pergunta ao banco o que mudou. */
const CONSULTA_MS = 3000;
/** De quanto em quanto tempo o bot avisa o painel que está vivo. */
const SINAL_MS = 60000;

let sock = null;
let conectado = false;
const usoDoDia = new Map();
const esperando = new Map(); // jid -> timer da resposta
const filas = new Map(); // jid -> promessa da vez
const enviando = new Set(); // ids de mensagem/envio saindo agora

/**
 * Quem escreveu para este WhatsApp, visto pelo próprio WhatsApp.
 *
 * É a única fonte que decide se o bot pode mandar mensagem para um número.
 * O banco não serve para isso: o painel grava cliente e conversa, então um
 * cadastro forjado (telefone trocado, "já escreveu" marcado à mão) faria o
 * bot escrever para quem nunca pediu, que é o que bane o número. Este
 * arquivo só cresce com mensagem que chegou de verdade, e fica fora do git.
 */
const ARQUIVO_CONTATOS = pasta("contatos.json");
const jidPorTelefone = new Map(); // 8 dígitos finais -> jid de quem escreveu
let contatosSemArquivo = !existsSync(ARQUIVO_CONTATOS);
try {
  if (!contatosSemArquivo) {
    for (const [fim, jid] of Object.entries(JSON.parse(readFileSync(ARQUIVO_CONTATOS, "utf8")))) {
      if (/^\d{8}$/.test(fim) && typeof jid === "string") jidPorTelefone.set(fim, jid);
    }
  }
} catch {
  contatosSemArquivo = true;
}
let gravarContatos = null;
function lembrarContato(fim, jid) {
  if (jidPorTelefone.get(fim) === jid) return;
  jidPorTelefone.set(fim, jid);
  clearTimeout(gravarContatos);
  gravarContatos = setTimeout(() => {
    try {
      writeFileSync(ARQUIVO_CONTATOS, JSON.stringify(Object.fromEntries(jidPorTelefone)), { mode: 0o600 });
    } catch (erro) {
      log("lista de contatos não gravada:", erro.message);
    }
  }, 500);
}

function log(...partes) {
  console.log(new Date().toISOString().slice(11, 19), ...partes);
}

/** Últimos 4 dígitos, para o log nunca guardar o número inteiro. */
function mascara(digitos) {
  return `***${String(digitos).slice(-4)}`;
}

function contarUso(digitos) {
  const hoje = new Date().toISOString().slice(0, 10);
  const chave = `${hoje}:${digitos}`;
  const total = (usoDoDia.get(chave) ?? 0) + 1;
  usoDoDia.set(chave, total);
  return total;
}

/** Uma coisa por vez por contato: a ordem das mensagens importa. */
function naFila(jid, tarefa) {
  const anterior = filas.get(jid) ?? Promise.resolve();
  const vez = anterior.then(tarefa).catch((erro) => log("erro:", erro.message));
  filas.set(jid, vez);
  return vez;
}

/* ------------------------------------------------------------------
   Estado da conexão, para o painel saber a verdade
   ------------------------------------------------------------------ */

async function avisarEstado() {
  try {
    const numero = sock?.user?.id ? sock.user.id.split(":")[0].split("@")[0] : "";
    await alterarLoja((d) => ({
      ...d,
      whatsapp: { conectado, vistoEm: Date.now(), numero: numero ? `***${numero.slice(-4)}` : "" },
    }));
  } catch (erro) {
    log("não avisou o estado:", erro.message);
  }
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

/** O conteúdo de verdade, tirando os envelopes (efêmera, visualização única). */
function conteudo(msg) {
  let m = msg.message ?? {};
  for (let i = 0; i < 3; i++) {
    const dentro = m.ephemeralMessage?.message ?? m.viewOnceMessage?.message ?? m.viewOnceMessageV2?.message ?? m.documentWithCaptionMessage?.message;
    if (!dentro) break;
    m = dentro;
  }
  return m;
}

const TIPOS_MIDIA = ["imageMessage", "audioMessage", "videoMessage", "documentMessage", "stickerMessage"];

/** Texto, mídia e citação de uma mensagem que chegou. */
async function lerMensagem(msg, lojaId) {
  const m = conteudo(msg);
  const tipo = TIPOS_MIDIA.find((t) => m[t]);
  const corpo = tipo ? m[tipo] : m.extendedTextMessage;
  const texto = (m.conversation || m.extendedTextMessage?.text || corpo?.caption || "").trim();
  const citadaWaId = corpo?.contextInfo?.stanzaId ?? m.extendedTextMessage?.contextInfo?.stanzaId ?? "";

  let midia = null;
  if (tipo) {
    try {
      const buffer = await downloadMediaMessage(msg, "buffer", {}, { logger, reuploadRequest: sock.updateMediaMessage });
      const mime = (corpo.mimetype || (tipo === "stickerMessage" ? "image/webp" : "application/octet-stream")).split(";")[0];
      const caminho = await guardarMidia(lojaId, buffer, mime);
      midia = {
        caminho,
        tipo: tipoDaMidia(mime),
        mime,
        nome: corpo.fileName || "",
        tamanho: buffer.length,
        ...(corpo.seconds ? { duracao: corpo.seconds } : {}),
      };
    } catch (erro) {
      log("mídia não guardada:", erro.message);
      return { texto: texto || "[mídia que não deu para abrir]", midia: null, citadaWaId };
    }
  }
  return { texto, midia, citadaWaId };
}

async function chegou(msg) {
  const jid = msg.key.remoteJid;
  const digitos = await numeroReal(msg);
  if (!digitos) {
    log("mensagem sem número identificável, ignorada");
    return;
  }
  lembrarContato(digitos.slice(-8), jid);
  const { lojaId } = lerLoja();
  const { texto, midia, citadaWaId } = await lerMensagem(msg, lojaId);
  if (!texto && !midia) return;

  const entrada = await registrarEntrada({
    digitos,
    nomeWhatsapp: msg.pushName,
    texto: texto.slice(0, 2000),
    midia,
    wa: { id: msg.key.id, jid, deMim: false },
    citadaWaId,
  });
  log("mensagem de", mascara(digitos), midia ? descreverMidia(midia) : "", entrada.responder ? "" : `(${entrada.motivoSilencio})`);

  if (!entrada.responder) return;
  // A resposta espera o cliente terminar de escrever: quem manda três
  // mensagens seguidas recebe uma resposta só, sobre as três.
  clearTimeout(esperando.get(jid));
  esperando.set(
    jid,
    setTimeout(() => {
      esperando.delete(jid);
      naFila(jid, () => responderConversa(jid, entrada.conversa.id, digitos));
    }, JUNTAR_MS),
  );
}

async function responderConversa(jid, conversaId, digitos) {
  const { dados, loja } = lerLoja();
  const conversa = dados.conversas.find((c) => c.id === conversaId);
  // Pode ter mudado enquanto esperava: alguém assumiu, ou desligou o agente.
  if (!conversa || conversa.status !== "aberta" || !dados.agenteLigado.ativo) return;

  const uso = contarUso(digitos);
  if (uso > LIMITE_POR_CONTATO) {
    if (uso === LIMITE_POR_CONTATO + 1) await pedirPessoa(jid, conversa, "Limite diário de respostas automáticas deste contato.");
    return;
  }
  if (!responder) {
    await pedirPessoa(jid, conversa, "O agente está sem chave da IA configurada.");
    return;
  }

  await sock.sendPresenceUpdate("composing", jid).catch(() => {});
  let resposta;
  try {
    resposta = await responder({ conversa, dados, loja, telefone: conversa.telefone });
  } catch (erro) {
    log("o agente falhou:", erro.message);
    await pedirPessoa(jid, conversa, `O agente não conseguiu responder (${erro.status ?? "erro"}).`);
    return;
  } finally {
    await sock.sendPresenceUpdate("paused", jid).catch(() => {});
  }
  if (!resposta?.texto) return;

  const enviada = await sock.sendMessage(jid, { text: resposta.texto });
  await registrarResposta(conversa.id, resposta.texto, {
    pedido: resposta.pedido,
    wa: enviada?.key ? { id: enviada.key.id, jid, deMim: true } : null,
  });
  log("respondido", mascara(digitos), resposta.pedido ? `(${resposta.pedido.split(".")[0]})` : "");
}

/**
 * Quando o agente não pode responder, a pessoa do outro lado não fica no
 * vácuo: recebe um aviso uma vez, e a conversa ganha um alerta no painel.
 */
async function pedirPessoa(jid, conversa, motivo) {
  const jaAvisou = conversa.alerta?.tipo === "atendente";
  await alterarLoja((d) => ({
    ...d,
    conversas: d.conversas.map((c) =>
      c.id === conversa.id ? { ...c, alerta: { tipo: "atendente", resumo: motivo, em: Date.now() } } : c,
    ),
  }));
  if (jaAvisou) return;
  const texto = "Recebi sua mensagem! Já já alguém da nossa equipe te responde por aqui.";
  const enviada = await sock.sendMessage(jid, { text: texto });
  await registrarResposta(conversa.id, texto, {
    wa: enviada?.key ? { id: enviada.key.id, jid, deMim: true } : null,
  });
}

/* ------------------------------------------------------------------
   A equipe escreveu no painel
   ------------------------------------------------------------------ */

/** Para onde mandar: o jid da última mensagem da pessoa, ou o número. */
/**
 * Para onde mandar: só o endereço de quem escreveu para este WhatsApp.
 * Número que nunca escreveu não tem endereço, e o envio é recusado. Nunca
 * monta o endereço a partir do telefone do cadastro.
 */
function jidDoTelefone(telefone) {
  const fim = String(telefone ?? "").replace(/\D/g, "").slice(-8);
  return fim.length === 8 ? (jidPorTelefone.get(fim) ?? null) : null;
}

async function montarConteudo(texto, midia) {
  if (!midia) return { text: texto };
  const buffer = await baixarMidia(midia.caminho);
  if (midia.tipo === "imagem") return { image: buffer, caption: texto || undefined };
  if (midia.tipo === "video") return { video: buffer, caption: texto || undefined };
  if (midia.tipo === "audio") {
    return { audio: await paraVoz(buffer), mimetype: "audio/ogg; codecs=opus", ptt: true };
  }
  return { document: buffer, mimetype: midia.mime, fileName: midia.nome || "arquivo", caption: texto || undefined };
}

async function marcarEnvio(conversaId, mensagemId, envio, wa) {
  await alterarLoja((d) => ({
    ...d,
    conversas: d.conversas.map((c) =>
      c.id === conversaId
        ? { ...c, mensagens: c.mensagens.map((m) => (m.id === mensagemId ? { ...m, envio, wa: wa ?? m.wa } : m)) }
        : c,
    ),
  }));
}

/** Manda o que a equipe escreveu e ainda está pendente. */
async function levarMensagensDaEquipe() {
  if (!conectado) return;
  const { dados } = lerLoja();
  if (!dados) return;
  for (const conversa of dados.conversas) {
    if (conversa.canal !== "whatsapp") continue;
    for (const m of conversa.mensagens) {
      if (m.origem !== "atendente" || m.envio !== "pendente" || enviando.has(m.id)) continue;
      enviando.add(m.id);
      const jid = jidDoTelefone(conversa.telefone);
      if (!jid) {
        log("recusado: número que nunca escreveu", mascara(conversa.telefone));
        void marcarEnvio(conversa.id, m.id, "falhou")
          .catch(() => {})
          .finally(() => enviando.delete(m.id));
        continue;
      }
      naFila(jid, async () => {
        try {
          const citada = m.citada ? conversa.mensagens.find((x) => x.id === m.citada.id) : null;
          const opcoes = citada?.wa
            ? {
                quoted: {
                  key: { remoteJid: jid, id: citada.wa.id, fromMe: Boolean(citada.wa.deMim) },
                  message: { conversation: citada.texto || descreverMidia(citada.midia) },
                },
              }
            : {};
          const enviada = await sock.sendMessage(jid, await montarConteudo(m.texto, m.midia), opcoes);
          await marcarEnvio(conversa.id, m.id, "enviado", enviada?.key ? { id: enviada.key.id, jid, deMim: true } : null);
          log("mensagem da equipe entregue", mascara(conversa.telefone));
        } catch (erro) {
          log("mensagem da equipe falhou:", erro.message);
          await marcarEnvio(conversa.id, m.id, "falhou").catch(() => {});
        } finally {
          enviando.delete(m.id);
        }
      });
    }
  }
}

/** Testes de campanha pedidos no painel. */
async function levarEnvios() {
  if (!conectado) return;
  const { dados } = lerLoja();
  if (!dados) return;
  for (const envio of dados.envios) {
    if (envio.status !== "pendente" || enviando.has(envio.id)) continue;
    enviando.add(envio.id);
    const marcar = (status, motivo = "") =>
      alterarLoja((d) => ({
        ...d,
        envios: d.envios.map((e) =>
          e.id === envio.id ? { ...e, status, motivo, enviadoEm: status === "enviado" ? Date.now() : 0 } : e,
        ),
      }));
    const jid = jidDoTelefone(envio.telefone);
    if (!jid) {
      void marcar("recusado", "Esse número nunca escreveu para este WhatsApp. O teste só vai para quem já mandou mensagem.")
        .catch(() => {})
        .finally(() => enviando.delete(envio.id));
      continue;
    }
    naFila(jid, async () => {
      try {
        const cliente = lerLoja().dados.clientes.find((c) => mesmoTelefone(c.telefone, envio.telefone));
        const texto = envio.texto.replaceAll("{nome}", cliente?.nome.split(" ")[0] || "tudo bem");
        await sock.sendMessage(jid, await montarConteudo(texto, envio.midia));
        await marcar("enviado");
        log("teste de campanha enviado", mascara(envio.telefone));
      } catch (erro) {
        await marcar("falhou", erro.message.slice(0, 120)).catch(() => {});
      } finally {
        enviando.delete(envio.id);
      }
    });
  }
}

/* ------------------------------------------------------------------
   Conexão
   ------------------------------------------------------------------ */

async function conectar() {
  const { state, saveCreds } = await useMultiFileAuthState(pasta("sessao"));
  const { version } = await fetchLatestBaileysVersion();
  sock = makeWASocket({ version, auth: state, logger });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      await QRCode.toFile(pasta("qr.png"), qr, { scale: 8, margin: 2 });
      log("QR_PRONTO: abra qr.png e leia com o WhatsApp do chip do bot");
    }
    if (connection === "open") {
      conectado = true;
      log("CONECTADO");
      await avisarEstado();
      void levarMensagensDaEquipe();
      void levarEnvios();
    }
    if (connection === "close") {
      conectado = false;
      const codigo = lastDisconnect?.error?.output?.statusCode;
      log("FECHOU", codigo, lastDisconnect?.error?.message ?? "");
      await avisarEstado();
      if (codigo !== DisconnectReason.loggedOut) setTimeout(conectar, 3000);
      else log("DESLOGADO: apague a pasta sessao e leia o QR de novo");
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const msg of messages) {
      const jid = msg.key.remoteJid;
      if (msg.key.fromMe || !jid) continue;
      if (jid.endsWith("@g.us") || jid.endsWith("@broadcast") || jid.endsWith("@newsletter")) continue;
      naFila(jid, () => chegou(msg));
    }
  });
}

async function iniciar() {
  await iniciarBanco();
  log("BANCO CARREGADO");
  // Primeira vez com a lista de contatos: aproveita quem o próprio bot já
  // registrou como "escreveu" até aqui. Depois disso, só o WhatsApp alimenta.
  if (contatosSemArquivo) {
    for (const c of lerLoja().dados?.clientes ?? []) {
      const digitos = String(c.telefone ?? "").replace(/\D/g, "");
      if (c.primeiraMensagemEm > 0 && digitos.length >= 10) {
        lembrarContato(digitos.slice(-8), `${digitos.length <= 11 ? `55${digitos}` : digitos}@s.whatsapp.net`);
      }
    }
    contatosSemArquivo = false;
    log("lista de contatos criada:", jidPorTelefone.size);
  }
  ouvirMudancas(() => {
    void levarMensagensDaEquipe();
    void levarEnvios();
  });
  setInterval(() => void puxar().catch((e) => log("consulta falhou:", e.message)), CONSULTA_MS);
  setInterval(() => void avisarEstado(), SINAL_MS);
  await conectar();
}

async function encerrar() {
  conectado = false;
  await avisarEstado();
  process.exit(0);
}
process.on("SIGTERM", encerrar);
process.on("SIGINT", encerrar);

iniciar().catch((erro) => {
  log("não iniciou:", erro.message);
  process.exit(1);
});
