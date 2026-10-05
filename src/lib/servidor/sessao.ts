import { NextResponse } from "next/server";
import { rpc } from "@/lib/db/nuvem";

/**
 * Confere, no servidor, se quem chamou uma rota tem sessão aberta.
 *
 * As rotas de `/api` gastam dinheiro (agente, sugestão de campanha) ou
 * processam dado de cliente (planilhas). Sem esta conferência, qualquer
 * pessoa na internet que achasse o endereço poderia usar a chave da
 * Anthropic por conta da MAZUS. O navegador manda o token no cabeçalho
 * `x-sessao`; quem decide se vale é a função `conferir_sessao` no banco.
 */

export type SessaoServidor = { usuario: string; papel: "admin" | "loja"; lojaId: string | null };

/* Lembra a resposta por um minuto, para não consultar o banco a cada clique. */
const lembradas = new Map<string, { ate: number; sessao: SessaoServidor | null }>();

async function conferir(token: string): Promise<SessaoServidor | null> {
  const agora = Date.now();
  const guardada = lembradas.get(token);
  if (guardada && guardada.ate > agora) return guardada.sessao;

  const r = await rpc<{ ok: boolean; erro?: string; usuario?: string; papel?: "admin" | "loja"; lojaId?: string | null }>(
    "conferir_sessao",
    { p_token: token },
  );
  // Falha de rede não vira "sessão inválida" guardada: tenta de novo na próxima.
  if (!r.ok && r.erro === "rede") return null;
  const sessao = r.ok && r.usuario && r.papel ? { usuario: r.usuario, papel: r.papel, lojaId: r.lojaId ?? null } : null;
  if (lembradas.size > 500) lembradas.clear();
  lembradas.set(token, { ate: agora + 60_000, sessao });
  return sessao;
}

/** Devolve a sessão, ou a resposta 401 pronta para a rota devolver. */
export async function exigirSessao(request: Request): Promise<SessaoServidor | NextResponse> {
  const token = request.headers.get("x-sessao")?.trim() ?? "";
  if (!/^[0-9a-f]{64}$/.test(token)) {
    return NextResponse.json({ error: "Entre no sistema de novo." }, { status: 401 });
  }
  const sessao = await conferir(token);
  if (!sessao) {
    return NextResponse.json({ error: "Sessão encerrada. Entre no sistema de novo." }, { status: 401 });
  }
  return sessao;
}

/**
 * Teto de uso por pessoa por dia, em memória. É freio de bolso contra
 * clique repetido ou script com sessão válida, não contabilidade: cada
 * instância do servidor tem o próprio contador.
 */
const usoPorDia = new Map<string, number>();
export function dentroDoLimite(chave: string, limite: number) {
  const dia = new Date().toISOString().slice(0, 10);
  const id = `${dia}:${chave}`;
  const usado = usoPorDia.get(id) ?? 0;
  if (usado >= limite) return false;
  if (usoPorDia.size > 2000) usoPorDia.clear();
  usoPorDia.set(id, usado + 1);
  return true;
}
