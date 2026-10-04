/**
 * O bot lendo e gravando no mesmo banco que o painel usa.
 *
 * O bot não tem usuário nem senha: tem uma chave própria, guardada em
 * `.chave-bot` (fora do git), que só abre os dados de UMA loja. No banco fica
 * só o hash dela. Quem pegar esta pasta sem a chave não lê nada.
 */
import { readFileSync } from "node:fs";
import { rpc } from "../src/lib/db/nuvem.ts";
import { completarDados } from "../src/lib/db/types.ts";

const CHAVE = readFileSync(new URL(".chave-bot", import.meta.url), "utf8").trim();

/** Os dados da loja do bot, com o cadastro dela e a versão gravada. */
export async function lerLoja() {
  const r = await rpc("bot_ler", { p_chave: CHAVE });
  if (!r.ok) throw new Error(`bot_ler: ${r.erro ?? "falhou"}`);
  return {
    lojaId: r.lojaId,
    loja: r.loja,
    dados: completarDados(r.dados ?? undefined),
    versao: r.versao,
  };
}

/**
 * Aplica uma mudança nos dados da loja.
 *
 * O painel pode ter gravado entre a leitura e a gravação do bot. Nesse caso
 * o banco recusa (a versão mudou) e a mudança é refeita em cima do que está
 * lá agora, em vez de apagar o que a loja acabou de fazer. Por isso
 * `mudanca` precisa poder rodar mais de uma vez: ids e horários nascem fora
 * dela.
 *
 * `mudanca` devolve os dados novos, ou os mesmos dados quando não há nada a
 * gravar.
 */
export async function alterarLoja(mudanca) {
  for (let tentativa = 0; tentativa < 6; tentativa++) {
    const atual = await lerLoja();
    const novos = mudanca(atual.dados, atual.loja);
    if (novos === atual.dados) return atual;
    const r = await rpc("bot_gravar", {
      p_chave: CHAVE,
      p_dados: novos,
      p_versao: atual.versao,
    });
    if (r.ok) return { ...atual, dados: novos, versao: r.versao };
    if (!r.conflito && r.erro !== "rede") throw new Error(`bot_gravar: ${r.erro}`);
    await new Promise((ok) => setTimeout(ok, 300 * (tentativa + 1)));
  }
  throw new Error("bot_gravar: o painel gravou várias vezes seguidas, desisti");
}
