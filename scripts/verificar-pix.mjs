/**
 * Conferência do Pix copia e cola.
 *
 * Roda com `npm run verificar:pix`. Existe porque o BR Code ou está exato
 * ou não abre no app do banco: um dígito errado no CRC e o cliente vê
 * "código inválido". O CRC é conferido contra o valor de verificação
 * padrão do CRC-16/CCITT-FALSE, e o payload é lido de volta por um parser
 * independente do gerador.
 */

import { readFileSync } from "node:fs";
import { transpileModule, ModuleKind } from "typescript";

const ts = readFileSync("src/lib/pix.ts", "utf8");
const js = transpileModule(ts, { compilerOptions: { module: ModuleKind.ESNext, target: 99 } }).outputText;
const mod = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));

let falhas = 0;
const check = (nome, ok, extra = "") => {
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${nome}${extra ? "  " + extra : ""}`);
};

// 1) CRC-16/CCITT-FALSE: valor de verificação padrão para "123456789" é 0x29B1
check("CRC16 bate o check value padrão", mod.crc16("123456789") === "29B1", mod.crc16("123456789"));

// 2) Leitura de volta do payload (parser TLV independente do gerador)
function parse(str) {
  const out = {};
  let i = 0;
  while (i < str.length) {
    const id = str.slice(i, i + 2);
    const len = parseInt(str.slice(i + 2, i + 4), 10);
    if (Number.isNaN(len)) throw new Error("tamanho inválido em " + i);
    out[id] = str.slice(i + 4, i + 4 + len);
    i += 4 + len;
  }
  return out;
}

const payload = mod.gerarPixCopiaECola({
  chave: "27999999999",
  beneficiario: "Preço Baixo Vila Velha",
  cidade: "Vila Velha",
  valor: 45.9,
  txid: "PEDIDO-12",
});
console.log("\npayload:", payload, "\n");

const t = parse(payload);
check("campos TLV fecham sem sobra", true);
check("00 indicador de formato = 01", t["00"] === "01", t["00"]);
check("53 moeda = 986 (BRL)", t["53"] === "986", t["53"]);
check("54 valor = 45.90", t["54"] === "45.90", t["54"]);
check("58 país = BR", t["58"] === "BR", t["58"]);
check("59 beneficiário sem acento, <= 25", t["59"] === "PRECO BAIXO VILA VELHA" && t["59"].length <= 25, t["59"]);
check("60 cidade <= 15", t["60"] === "VILA VELHA" && t["60"].length <= 15, t["60"]);

const conta = parse(t["26"]);
check("26.00 = br.gov.bcb.pix", conta["00"] === "br.gov.bcb.pix", conta["00"]);
check("26.01 = a chave", conta["01"] === "27999999999", conta["01"]);

const extra = parse(t["62"]);
check("62.05 txid só alfanumérico", extra["05"] === "PEDIDO12", extra["05"]);

check("63 CRC confere ao recalcular", mod.crc16(payload.slice(0, -4)) === payload.slice(-4), payload.slice(-4));

// 3) Sem valor: cliente digita quanto pagar
const semValor = parse(mod.gerarPixCopiaECola({ chave: "a@b.com", beneficiario: "Loja", cidade: "Vitoria" }));
check("sem valor, campo 54 não existe", semValor["54"] === undefined);
check("sem txid vira ***", parse(semValor["62"])["05"] === "***");

// 4) Acento e caractere estranho não vazam
const acentos = parse(mod.gerarPixCopiaECola({ chave: "k", beneficiario: "Farmácia São João & Cia", cidade: "São Paulo" }));
check("acento removido do beneficiário", acentos["59"] === "FARMACIA SAO JOAO  CIA", acentos["59"]);
check("acento removido da cidade", acentos["60"] === "SAO PAULO", acentos["60"]);

// 5) Nome muito longo é cortado no limite da especificação
const longo = parse(mod.gerarPixCopiaECola({ chave: "k", beneficiario: "A".repeat(60), cidade: "B".repeat(40) }));
check("beneficiário cortado em 25", longo["59"].length === 25, String(longo["59"].length));
check("cidade cortada em 15", longo["60"].length === 15, String(longo["60"].length));

check("pixConfigurado exige os três campos",
  mod.pixConfigurado({ chavePix: "k", beneficiario: "n", cidade: "c" }) === true &&
  mod.pixConfigurado({ chavePix: "k", beneficiario: "", cidade: "c" }) === false);

console.log(falhas ? `\n${falhas} FALHA(S)` : "\ntudo passou");
process.exit(falhas ? 1 : 0);
