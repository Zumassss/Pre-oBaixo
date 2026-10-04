/**
 * Conversa com o banco na nuvem (Supabase).
 *
 * O endereço e a chave abaixo são PÚBLICOS por natureza: vão no código do
 * site e qualquer pessoa pode lê-los. Isso é seguro porque essa chave não
 * abre tabela nenhuma. Tudo passa por funções no banco que conferem a
 * sessão de quem chama (ver `supabase/migrations`). A chave secreta de
 * serviço nunca entra neste repositório.
 */

export const URL_NUVEM = "https://ztfgcpcwmzqlhnpaefup.supabase.co";
export const CHAVE_PUBLICA = "sb_publishable_jy92mK19ylmlV47iI33enQ_Lsye7hX0";

export type RespostaNuvem = { ok: boolean; erro?: string; conflito?: boolean } & Record<
  string,
  unknown
>;

/**
 * Chama uma função do banco.
 *
 * Nunca lança: erro de rede volta como `{ ok: false, erro: "rede" }`, para
 * quem chama decidir se tenta de novo em vez de a tela quebrar.
 */
export async function rpc<T extends RespostaNuvem = RespostaNuvem>(
  funcao: string,
  argumentos: Record<string, unknown>,
): Promise<T> {
  try {
    const resposta = await fetch(`${URL_NUVEM}/rest/v1/rpc/${funcao}`, {
      method: "POST",
      headers: {
        apikey: CHAVE_PUBLICA,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(argumentos),
      cache: "no-store",
    });
    if (!resposta.ok) {
      return { ok: false, erro: `http ${resposta.status}` } as T;
    }
    return (await resposta.json()) as T;
  } catch {
    return { ok: false, erro: "rede" } as T;
  }
}
