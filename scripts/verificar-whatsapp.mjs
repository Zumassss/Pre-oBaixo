/**
 * Conferência do webhook do WhatsApp.
 *
 * Roda com `npm run verificar:whatsapp`. Existe porque um erro aqui é
 * silencioso e caro: assinatura mal conferida deixa qualquer um mandar
 * mensagem falsa, e extração errada faz o agente ignorar o cliente sem
 * ninguém perceber.
 */
import { readFileSync } from "node:fs";
import crypto from "node:crypto";
import { transpileModule, ModuleKind } from "typescript";

const ts = readFileSync("src/lib/whatsapp.ts", "utf8");
const js = transpileModule(ts, {
  compilerOptions: { module: ModuleKind.ESNext, target: 99 },
}).outputText;
const mod = await import(
  "data:text/javascript;base64," + Buffer.from(js).toString("base64")
);

let falhas = 0;
const check = (nome, ok, extra = "") => {
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${nome}${extra ? "  " + extra : ""}`);
};

/* ---------- assinatura ---------- */

const SEGREDO = "segredo-de-teste";
const corpo = JSON.stringify({ object: "whatsapp_business_account" });
const valida =
  "sha256=" +
  crypto.createHmac("sha256", SEGREDO).update(corpo, "utf8").digest("hex");

check("assinatura correta passa", mod.assinaturaConfere(corpo, valida, SEGREDO));
check(
  "assinatura de outro segredo é recusada",
  !mod.assinaturaConfere(
    corpo,
    "sha256=" + crypto.createHmac("sha256", "outro").update(corpo).digest("hex"),
    SEGREDO,
  ),
);
check(
  "corpo adulterado é recusado",
  !mod.assinaturaConfere(corpo + " ", valida, SEGREDO),
);
check("sem cabeçalho é recusado", !mod.assinaturaConfere(corpo, null, SEGREDO));
check(
  "cabeçalho sem o prefixo sha256 é recusado",
  !mod.assinaturaConfere(corpo, valida.slice(7), SEGREDO),
);
check(
  "cabeçalho de tamanho errado não quebra",
  !mod.assinaturaConfere(corpo, "sha256=abcd", SEGREDO),
);

/* ---------- extração ---------- */

const mensagemReal = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "123",
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: { phone_number_id: "999" },
            contacts: [{ wa_id: "5527999990000", profile: { name: "Ana" } }],
            messages: [
              {
                id: "wamid.ABC",
                from: "5527999990000",
                timestamp: "1700000000",
                type: "text",
                text: { body: "vocês abrem domingo?" },
              },
            ],
          },
        },
      ],
    },
  ],
};

const extraidas = mod.extrairMensagens(mensagemReal);
check("extrai uma mensagem de texto", extraidas.length === 1);
check("pega o texto", extraidas[0]?.texto === "vocês abrem domingo?");
check("pega o telefone", extraidas[0]?.de === "5527999990000");
check("pega o nome do perfil", extraidas[0]?.nome === "Ana");
check("pega o id da mensagem", extraidas[0]?.id === "wamid.ABC");

const statusEntrega = {
  entry: [
    {
      changes: [
        {
          value: {
            statuses: [{ id: "wamid.X", status: "delivered" }],
          },
        },
      ],
    },
  ],
};
check(
  "confirmação de entrega é ignorada",
  mod.extrairMensagens(statusEntrega).length === 0,
);

const audio = JSON.parse(JSON.stringify(mensagemReal));
audio.entry[0].changes[0].value.messages[0] = {
  id: "wamid.AUDIO",
  from: "5527999990000",
  type: "audio",
  audio: { id: "media-1" },
};
check("áudio é ignorado por enquanto", mod.extrairMensagens(audio).length === 0);

const vazia = JSON.parse(JSON.stringify(mensagemReal));
vazia.entry[0].changes[0].value.messages[0].text.body = "   ";
check("texto só com espaço é ignorado", mod.extrairMensagens(vazia).length === 0);

check("pacote estranho não quebra", mod.extrairMensagens({}).length === 0);
check("pacote nulo não quebra", mod.extrairMensagens(null).length === 0);

const duasEntradas = {
  entry: [
    mensagemReal.entry[0],
    JSON.parse(JSON.stringify(mensagemReal.entry[0])),
  ],
};
check(
  "lê mensagem de mais de uma entrada",
  mod.extrairMensagens(duasEntradas).length === 2,
);

/* ---------- trava de repetição ---------- */

check("primeira vez responde", mod.marcarComoRespondida("wamid.UNICO"));
check(
  "segunda vez não responde de novo",
  !mod.marcarComoRespondida("wamid.UNICO"),
);
check("id diferente responde", mod.marcarComoRespondida("wamid.OUTRO"));

for (let i = 0; i < 600; i++) mod.marcarComoRespondida(`enchendo-${i}`);
check(
  "memória não cresce sem limite",
  mod.marcarComoRespondida("enchendo-0") === true,
  "os mais antigos saem da lista",
);

console.log(falhas ? `\n${falhas} FALHA(S)` : "\ntudo passou");
process.exit(falhas ? 1 : 0);
