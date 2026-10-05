/**
 * O bot lendo e gravando no mesmo banco que o painel usa.
 *
 * Usa a mesma réplica do site (`src/lib/db/sincronia.ts`): carrega a loja uma
 * vez, depois pergunta a cada poucos segundos só o que mudou, e grava item a
 * item com versão. Se o painel mexeu no mesmo item, a mudança do bot é
 * refeita em cima do que a loja acabou de gravar, em vez de apagar.
 *
 * O bot não tem usuário nem senha: tem uma chave própria, guardada em
 * `.chave-bot` (fora do git), que só abre os dados de UMA loja, e só as
 * coleções de atendimento (nunca catálogo, cadastro da loja ou ajustes). No
 * banco fica só o hash dela.
 */
import { readFileSync } from "node:fs";
import { rpc } from "../src/lib/db/nuvem.ts";
import { Replica } from "../src/lib/db/sincronia.ts";

export const CHAVE = readFileSync(new URL(".chave-bot", import.meta.url), "utf8").trim();

let lojaId = "";

const replica = new Replica({
  carregar: async () => {
    const r = await rpc("bot_carregar", { p_chave: CHAVE });
    if (r.ok) lojaId = r.lojaId;
    return r;
  },
  mudancas: (desde) => rpc("bot_mudancas", { p_chave: CHAVE, p_desde: desde }),
  gravar: (ops) => rpc("bot_gravar_ops", { p_chave: CHAVE, p_ops: ops }),
});

const ouvintes = new Set();

/** Carrega a loja. Tenta até conseguir: sem banco, o bot não tem o que fazer. */
export async function iniciarBanco() {
  for (let espera = 2000; ; espera = Math.min(espera * 2, 60000)) {
    const r = await replica.recarregar();
    if (r === "ok") return;
    if (r === "sessao") throw new Error("Chave do bot recusada pelo banco.");
    console.log("banco fora do ar, tentando de novo em", espera / 1000, "s");
    await new Promise((ok) => setTimeout(ok, espera));
  }
}

/** A loja do bot: cadastro e dados, como o painel enxerga. */
export function lerLoja() {
  const { lojas, dados } = replica.ler();
  const loja = lojas.find((l) => l.id === lojaId) ?? null;
  return { lojaId, loja, dados: dados[lojaId] };
}

/** Avisa quando algo mudou no banco (mensagem da equipe, envio novo). */
export function ouvirMudancas(ouvinte) {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

/** Pergunta ao banco o que mudou. Chamada a cada poucos segundos. */
export async function puxar() {
  const { resultado, mudou } = await replica.puxar();
  if (mudou) for (const o of ouvintes) o();
  return resultado;
}

/**
 * Aplica uma mudança nos dados da loja e grava.
 *
 * `mudanca(dados, loja)` devolve os dados novos, ou os mesmos quando não há
 * nada a gravar. Ela pode rodar mais de uma vez (conflito com o painel), por
 * isso ids e horários nascem fora dela.
 */
export async function alterarLoja(mudanca) {
  for (let espera = 1000; ; espera *= 2) {
    const resultado = await replica.gravar((estado) => {
      const atuais = estado.dados[lojaId];
      if (!atuais) return estado;
      const loja = estado.lojas.find((l) => l.id === lojaId) ?? null;
      const novos = mudanca(atuais, loja);
      if (novos === atuais) return estado;
      return { lojas: estado.lojas, dados: { ...estado.dados, [lojaId]: novos } };
    });
    if (resultado === "ok") return lerLoja();
    if (resultado !== "rede" || espera > 16000) {
      throw new Error(`gravação recusada: ${resultado} ${replica.ultimoErro}`);
    }
    await new Promise((ok) => setTimeout(ok, espera));
  }
}
