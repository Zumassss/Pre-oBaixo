"use client";

/**
 * Sons de aviso, gerados na hora pelo navegador (Web Audio), sem arquivo.
 *
 * Três sons, do mais urgente ao mais discreto:
 *  - `alerta`: cliente precisa do farmacêutico. Três notas subindo, duas
 *    vezes. Chama a atenção sem ser sirene: a loja tem cliente no balcão.
 *  - `pedido`: pedido novo. Duas notas, claras e curtas.
 *  - `mensagem`: cliente escreveu numa conversa que está com a equipe.
 *
 * O navegador só deixa tocar som depois que a pessoa clicou em algo na
 * página. O contexto de áudio nasce no primeiro clique e fica pronto.
 */

export type Som = "alerta" | "pedido" | "mensagem";

const CHAVE = "preco-baixo:som";
let contexto: AudioContext | null = null;

export function somLigado() {
  try {
    return window.localStorage.getItem(CHAVE) !== "desligado";
  } catch {
    return true;
  }
}

export function definirSom(ligado: boolean) {
  try {
    window.localStorage.setItem(CHAVE, ligado ? "ligado" : "desligado");
  } catch {
    // Modo privado: vale até fechar a aba.
  }
}

/** Prepara o áudio no primeiro gesto da pessoa. Chamada pelo shell. */
export function prepararAudio() {
  if (typeof window === "undefined") return;
  const destravar = () => {
    try {
      contexto ??= new AudioContext();
      if (contexto.state === "suspended") void contexto.resume();
    } catch {
      // Navegador sem Web Audio: segue sem som.
    }
  };
  window.addEventListener("pointerdown", destravar, { once: false, passive: true });
  window.addEventListener("keydown", destravar, { once: false });
}

function nota(ctx: AudioContext, frequencia: number, inicio: number, duracao: number, volume: number) {
  // Duas camadas: triangular dá o corpo, senoidal uma oitava acima dá o
  // brilho de sino. Envelope curto na subida e longo na descida.
  for (const [tipo, mult, vol] of [
    ["triangle", 1, volume],
    ["sine", 2, volume * 0.28],
  ] as const) {
    const osc = ctx.createOscillator();
    const ganho = ctx.createGain();
    osc.type = tipo;
    osc.frequency.value = frequencia * mult;
    ganho.gain.setValueAtTime(0.0001, inicio);
    ganho.gain.exponentialRampToValueAtTime(vol, inicio + 0.012);
    ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + duracao);
    osc.connect(ganho).connect(ctx.destination);
    osc.start(inicio);
    osc.stop(inicio + duracao + 0.05);
  }
}

const SEQUENCIAS: Record<Som, { f: number; t: number; d: number; v: number }[]> = {
  // Mi, sol sustenido, si (acorde maior subindo), duas vezes.
  alerta: [
    { f: 659.25, t: 0, d: 0.32, v: 0.22 },
    { f: 830.61, t: 0.13, d: 0.32, v: 0.22 },
    { f: 987.77, t: 0.26, d: 0.55, v: 0.24 },
    { f: 659.25, t: 0.78, d: 0.32, v: 0.22 },
    { f: 830.61, t: 0.91, d: 0.32, v: 0.22 },
    { f: 987.77, t: 1.04, d: 0.7, v: 0.24 },
  ],
  pedido: [
    { f: 783.99, t: 0, d: 0.28, v: 0.16 },
    { f: 1046.5, t: 0.12, d: 0.5, v: 0.17 },
  ],
  mensagem: [{ f: 880, t: 0, d: 0.35, v: 0.11 }],
};

export function tocar(som: Som) {
  if (!somLigado() || !contexto || contexto.state !== "running") return;
  const agora = contexto.currentTime + 0.02;
  for (const n of SEQUENCIAS[som]) nota(contexto, n.f, agora + n.t, n.d, n.v);
}

/** Para o botão de testar o som. Cria o contexto se ainda não existe. */
export function testarSom(som: Som = "alerta") {
  try {
    contexto ??= new AudioContext();
    void contexto.resume().then(() => tocar(som));
  } catch {
    // Sem Web Audio.
  }
}
