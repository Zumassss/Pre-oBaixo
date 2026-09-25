import { readFileSync } from "node:fs";

/**
 * Confere o contraste das fichas de cor, nos dois temas.
 *
 * Não abre navegador: lê o globals.css e faz a conta da WCAG sobre os pares
 * que importam. O risco de verdade mora na paleta, não em uma tela
 * específica: um cinza fraco demais reprova em todas as telas de uma vez.
 *
 * O mínimo da WCAG AA é 4,5:1 para texto pequeno e 3:1 para texto grande.
 * Aqui tudo é conferido contra 4,5 porque o sistema usa 10px e 11px em
 * bastante lugar, e é justamente esse texto que some na luz do balcão.
 */

const CSS = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

const MINIMO = 4.5;

/* ------------------------------------------------------------------
   Conta
   ------------------------------------------------------------------ */

function hexParaRgb(hex) {
  const limpo = hex.replace("#", "").trim();
  const cheio =
    limpo.length === 3
      ? limpo
          .split("")
          .map((c) => c + c)
          .join("")
      : limpo;
  return [0, 2, 4].map((i) => parseInt(cheio.slice(i, i + 2), 16));
}

/** Luminância relativa, como a WCAG define. */
function luminancia([r, g, b]) {
  const canais = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * canais[0] + 0.7152 * canais[1] + 0.0722 * canais[2];
}

/** O ponto médio entre duas cores, para medir o meio de um degradê. */
function misturar(corA, corB) {
  const a = hexParaRgb(corA);
  const b = hexParaRgb(corB);
  return (
    "#" +
    a
      .map((v, i) =>
        Math.round((v + b[i]) / 2)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

function contraste(corA, corB) {
  const a = luminancia(hexParaRgb(corA));
  const b = luminancia(hexParaRgb(corB));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/* ------------------------------------------------------------------
   Leitura das fichas
   ------------------------------------------------------------------ */

/**
 * Pega o valor de uma ficha dentro de um bloco.
 *
 * O tema claro só redefine o que muda, então quem não estiver no bloco do
 * claro herda o valor do escuro. É por isso que a busca cai para trás.
 */
function ficha(bloco, nome, reserva) {
  const achado = bloco.match(new RegExp(`${nome}:\\s*([^;]+);`));
  if (achado) return achado[1].trim();
  if (reserva !== undefined) return reserva;
  throw new Error(`ficha ausente: ${nome}`);
}

function bloco(abertura) {
  const inicio = CSS.indexOf(abertura);
  if (inicio < 0) throw new Error(`bloco ausente: ${abertura}`);
  const fim = CSS.indexOf("\n}", inicio);
  return CSS.slice(inicio, fim);
}

const escuro = bloco("@theme {");
const claro = bloco(':root[data-tema="claro"] {');

/** As fichas de um tema, já com a herança resolvida. */
function paleta(blocoDoTema) {
  const ler = (nome) => ficha(blocoDoTema, nome, ficha(escuro, nome));
  return {
    fg: ler("--color-fg"),
    "fg-muted": ler("--color-fg-muted"),
    "fg-faint": ler("--color-fg-faint"),
    "fg-ghost": ler("--color-fg-ghost"),
    positive: ler("--color-positive"),
    negative: ler("--color-negative"),
    caution: ler("--color-caution"),
    info: ler("--color-info"),
    "brand-300": ler("--color-brand-300"),
    "brand-400": ler("--color-brand-400"),
    "brand-500": ler("--color-brand-500"),
    "brand-700": ler("--color-brand-700"),
    void: ler("--color-void"),
    ink: ler("--color-ink"),
    surface: ler("--color-surface"),
    "surface-2": ler("--color-surface-2"),
  };
}

/* ------------------------------------------------------------------
   Casos
   ------------------------------------------------------------------ */

/** Os tons de texto que precisam ser lidos sobre cada superfície. */
const TEXTOS = [
  "fg",
  "fg-muted",
  "fg-faint",
  "fg-ghost",
  "positive",
  "negative",
  "caution",
  "info",
  "brand-400",
];

const FUNDOS = ["void", "ink", "surface", "surface-2"];

let falhas = 0;

for (const [nome, cores] of [
  ["escuro", paleta(escuro)],
  ["claro", paleta(claro)],
]) {
  console.log(`\n--- tema ${nome} ---`);

  for (const fundo of FUNDOS) {
    for (const texto of TEXTOS) {
      const razao = contraste(cores[texto], cores[fundo]);
      const passa = razao >= MINIMO;
      if (!passa) falhas++;
      const marca = passa ? "ok  " : "RUIM";
      if (!passa) {
        console.log(
          `${marca} ${texto} sobre ${fundo}: ${razao.toFixed(2)}:1 (mínimo ${MINIMO})`,
        );
      }
    }
  }

  // O rótulo do botão principal, branco sobre o degradê da marca.
  //
  // A conta é feita no meio do degradê, não no topo dele: o botão vai de
  // brand-500 a brand-700 em 38px de altura, e o texto fica na faixa do
  // meio. Medir só a parada mais clara acusaria um problema onde não há
  // texto nenhum.
  const meioDoBotao = misturar(cores["brand-500"], cores["brand-700"]);
  const noBotao = contraste("#ffffff", meioDoBotao);
  if (noBotao < MINIMO) {
    falhas++;
    console.log(
      `RUIM branco no botão principal (${meioDoBotao}): ${noBotao.toFixed(2)}:1 (mínimo ${MINIMO})`,
    );
  }

  console.log(`  pares conferidos: ${FUNDOS.length * TEXTOS.length + 1}`);
}

console.log(
  falhas
    ? `\n${falhas} par(es) abaixo do mínimo`
    : "\ntudo passou",
);

process.exit(falhas ? 1 : 0);
