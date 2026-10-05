/**
 * Regras da loja que não podem depender do modelo de IA: se está aberta
 * agora e quanto custa a entrega.
 *
 * O agente recebe o resultado pronto. Pedir ao modelo para calcular horário
 * ou taxa é pedir para ele errar de vez em quando, e erro de preço com
 * cliente real é o pior tipo de erro.
 *
 * Este arquivo roda no site e no bot (Node), por isso o import tem extensão.
 */
import { type AjustesAgente, type AjustesEntrega, DIAS_SEMANA, type DiaSemana } from "./db/types.ts";

const FUSO = "America/Sao_Paulo";
const ORDEM: DiaSemana[] = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];

/** Dia da semana e minuto do dia em Brasília, seja qual for o fuso do servidor. */
export function agoraNaLoja(agora = new Date()) {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: FUSO,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(agora);
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  const dias: Record<string, DiaSemana> = {
    Sun: "dom", Mon: "seg", Tue: "ter", Wed: "qua", Thu: "qui", Fri: "sex", Sat: "sab",
  };
  const hora = Number(valor("hour")) % 24;
  return { dia: dias[valor("weekday")] ?? "seg", minuto: hora * 60 + Number(valor("minute")) };
}

function minutos(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function hora(hhmm: string) {
  const [h, m] = hhmm.split(":");
  return m && m !== "00" ? `${Number(h)}h${m}` : `${Number(h)}h`;
}

/**
 * Se a loja está aberta agora, e até quando (ou quando abre).
 * Fechamento depois da meia-noite (ex.: 08:00 às 02:00) é tratado como
 * avançando para o dia seguinte.
 */
export function situacaoDaLoja(ajustes: AjustesAgente, agora = new Date()) {
  const { dia, minuto } = agoraNaLoja(agora);
  const hoje = ajustes.horarios[dia];
  const indice = ORDEM.indexOf(dia);
  const ontem = ajustes.horarios[ORDEM[(indice + 6) % 7]];

  // Plantão que começou ontem e ainda não fechou.
  if (ontem?.aberto && minutos(ontem.fecha) < minutos(ontem.abre) && minuto < minutos(ontem.fecha)) {
    return { aberta: true, texto: `aberta agora, fecha às ${hora(ontem.fecha)}` };
  }
  if (hoje?.aberto) {
    const abre = minutos(hoje.abre);
    let fecha = minutos(hoje.fecha);
    if (fecha <= abre) fecha += 24 * 60;
    if (minuto >= abre && minuto < fecha) {
      return { aberta: true, texto: `aberta agora, fecha às ${hora(hoje.fecha)}` };
    }
    if (minuto < abre) return { aberta: false, texto: `fechada agora, abre hoje às ${hora(hoje.abre)}` };
  }
  for (let passo = 1; passo <= 7; passo++) {
    const proximo = ORDEM[(indice + passo) % 7];
    const h = ajustes.horarios[proximo];
    if (h?.aberto) {
      const nome = passo === 1 ? "amanhã" : DIAS_SEMANA.find((d) => d.id === proximo)!.nome.toLowerCase();
      return { aberta: false, texto: `fechada agora, abre ${nome} às ${hora(h.abre)}` };
    }
  }
  return { aberta: false, texto: "fechada" };
}

/** "Segunda a sábado das 8h às 22h, domingo das 8h às 20h". */
export function textoDosHorarios(ajustes: AjustesAgente) {
  const grupos: { dias: string[]; texto: string }[] = [];
  for (const { id, nome } of DIAS_SEMANA) {
    const h = ajustes.horarios[id];
    const texto = h.aberto ? `das ${hora(h.abre)} às ${hora(h.fecha)}` : "fechado";
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.texto === texto) ultimo.dias.push(nome.toLowerCase());
    else grupos.push({ dias: [nome.toLowerCase()], texto });
  }
  const frase = grupos
    .map((g) => {
      const dias = g.dias.length > 2 ? `${g.dias[0]} a ${g.dias[g.dias.length - 1]}` : g.dias.join(" e ");
      return `${dias} ${g.texto}`;
    })
    .join(", ");
  return frase.charAt(0).toUpperCase() + frase.slice(1);
}

/* ------------------------------------------------------------------
   Entrega
   ------------------------------------------------------------------ */

function semAcento(texto: string) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Distância em linha reta, em km. */
export function distanciaKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Rua não é linha reta. 1,3 é o fator usual para cidade com quarteirão;
 * a tela avisa que a distância é estimada.
 */
export const FATOR_RUA = 1.3;

export type CalculoEntrega =
  | { ok: true; taxa: number; detalhe: string }
  | { ok: false; motivo: string };

/**
 * Quanto custa entregar, pelas regras da loja.
 *
 * `bairro` vale para o modo por bairro. `km` (já com o fator de rua) vale
 * para o modo por distância; sem ele, não dá para calcular e a resposta diz
 * isso em vez de chutar.
 */
export function calcularEntrega(
  entrega: AjustesEntrega,
  pedido: { subtotal: number; bairro?: string; km?: number | null },
): CalculoEntrega {
  if (entrega.pedidoMinimo > 0 && pedido.subtotal < entrega.pedidoMinimo) {
    return { ok: false, motivo: `O pedido mínimo para entrega é R$ ${reais(entrega.pedidoMinimo)}.` };
  }
  const gratis = entrega.freteGratisAcima > 0 && pedido.subtotal >= entrega.freteGratisAcima;

  let taxa = 0;
  let detalhe = "";
  if (entrega.modo === "fixa") {
    taxa = entrega.taxaFixa;
    detalhe = "taxa fixa";
  } else if (entrega.modo === "bairro") {
    const procurado = semAcento(pedido.bairro ?? "");
    const linha = entrega.bairros.find((b) => semAcento(b.nome) === procurado);
    if (linha) {
      taxa = linha.taxa;
      detalhe = `bairro ${linha.nome}`;
    } else if (!procurado) {
      return { ok: false, motivo: "Falta o bairro para calcular a entrega." };
    } else if (entrega.foraDaTabela === "taxa_padrao") {
      taxa = entrega.taxaPadrao;
      detalhe = "bairro fora da tabela, taxa padrão";
    } else {
      return { ok: false, motivo: `A loja não entrega no bairro ${pedido.bairro}.` };
    }
  } else {
    if (pedido.km === null || pedido.km === undefined) {
      return { ok: false, motivo: "Não foi possível localizar o endereço para calcular a distância." };
    }
    if (entrega.raioMaximoKm > 0 && pedido.km > entrega.raioMaximoKm) {
      return { ok: false, motivo: `O endereço fica a uns ${pedido.km.toFixed(1).replace(".", ",")} km, fora do raio de entrega.` };
    }
    const extra = Math.max(0, pedido.km - entrega.kmInclusos);
    taxa = entrega.taxaBase + Math.ceil(extra) * entrega.porKm;
    detalhe = `cerca de ${pedido.km.toFixed(1).replace(".", ",")} km`;
  }

  taxa = Math.round(taxa * 100) / 100;
  if (gratis) return { ok: true, taxa: 0, detalhe: `frete grátis acima de R$ ${reais(entrega.freteGratisAcima)}` };
  return { ok: true, taxa, detalhe };
}

function reais(valor: number) {
  return valor.toFixed(2).replace(".", ",");
}

/**
 * Coordenadas de um endereço pelo OpenStreetMap (Nominatim). Gratuito, com
 * limite de uma consulta por segundo: serve para o volume de uma farmácia,
 * não para disparo em lote.
 *
 * Tenta do mais exato para o mais simples, sempre com o bairro: "Rua Sete
 * de Setembro" existe em mais de um bairro de Vila Velha, e sem o bairro a
 * distância sairia de outra rua com o mesmo nome. No pior caso, usa o
 * centro do bairro, que basta para uma taxa por distância.
 */
export async function localizarEndereco(
  partes: { rua?: string; numero?: string; bairro?: string; cidade: string; uf: string },
  agente = "PrecoBaixo/1.0 (sistema de gestao MAZUS)",
): Promise<{ lat: number; lon: number; precisao: "rua" | "bairro" } | null> {
  const local = [partes.cidade, partes.uf].filter(Boolean).join(", ");
  const tentativas: { q: string; precisao: "rua" | "bairro" }[] = [];
  if (partes.rua) {
    tentativas.push({ q: [`${partes.rua}${partes.numero ? `, ${partes.numero}` : ""}`, partes.bairro, local].filter(Boolean).join(", "), precisao: "rua" });
    if (partes.numero) tentativas.push({ q: [partes.rua, partes.bairro, local].filter(Boolean).join(", "), precisao: "rua" });
  }
  if (partes.bairro) tentativas.push({ q: [partes.bairro, local].join(", "), precisao: "bairro" });

  for (let i = 0; i < tentativas.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 1100));
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(tentativas[i].q)}`;
      const cabecalhos: Record<string, string> = { "Accept-Language": "pt-BR" };
      if (typeof window === "undefined") cabecalhos["User-Agent"] = agente;
      const resposta = await fetch(url, { headers: cabecalhos });
      if (!resposta.ok) continue;
      const lista = (await resposta.json()) as { lat: string; lon: string }[];
      if (lista[0]) {
        return { lat: Number(lista[0].lat), lon: Number(lista[0].lon), precisao: tentativas[i].precisao };
      }
    } catch {
      // Sem resposta: tenta a próxima forma.
    }
  }
  return null;
}
