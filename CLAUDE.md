@AGENTS.md

# Preço Baixo · Sistema de Gestão

Painel de gestão do atendimento automatizado das Farmácias Preço Baixo.
Cliente da **MAZUS**. Todo texto de interface é em **português do Brasil**.

## Onde as coisas ficam

```
src/app/                telas (App Router) — uma rota por página do sistema
src/components/shell/   sidebar, topbar, camadas de fundo
src/components/globe/   esfera 3D de partículas (Three.js / R3F)
src/components/charts/  gráficos em SVG escritos à mão
src/components/agent/   fluxo de atividade do agente ao vivo
src/lib/mock/           dados simulados — o único ponto a trocar pela API real
src/hooks/              fluxo do agente, relógio, contadores
docs/referencias/       imagens que definiram a direção visual
```

## Regras deste projeto

- **Dados simulados vivem só em `src/lib/mock/`.** Nenhuma tela inventa
  número por conta própria. Ao integrar a API, o contrato dos tipos deve ser
  mantido para as telas não precisarem mudar.
- **Nada de biblioteca de gráfico.** Os gráficos são SVG próprio em
  `src/components/charts`. Mantenha assim: é mais leve e o traço combina com
  o resto da interface.
- **Trigonometria que chega ao DOM precisa ser arredondada** (`quantize` em
  `charts/index.tsx`, `q` em `mock/metrics.ts`). `Math.sin`/`Math.cos` diferem
  nos últimos dígitos entre Node e navegador e quebram a hidratação.
- **Nada de `Math.random()` durante o render.** Use semente fixa
  (`seededRandom` no globo) ou gere dentro de efeito/callback.
- **Não atualize estado de forma síncrona no corpo de um `useEffect`.** O
  ESLint do React 19 barra. Use um callback (`setTimeout(fn, 0)`, intervalo,
  assinatura).
- **Animações só em `transform` e `opacity`.** Desfoque grande dentro de
  painel com `backdrop-filter` fica caro e acinzenta a cor — prefira
  gradiente radial puro.
- **Objetos 3D precisam de escala na própria malha**, não só na animação:
  qualquer nó que saia cedo do laço de quadro renderiza no tamanho da
  geometria crua.

## Regra de produto que não se negocia

O agente **nunca** indica, sugere ou opina sobre medicamento, dose ou
interação — isso é transferido ao farmacêutico responsável. Conteúdo de
orientação só sai se estiver revisado e assinado por profissional. Campanha
só alcança quem tem opt-in registrado. Qualquer funcionalidade nova precisa
respeitar isso; não é preferência de projeto, é exigência regulatória e de
LGPD.

## Antes de dar o trabalho por pronto

```bash
npx eslint .     # precisa passar limpo
npm run build    # precisa compilar sem erro
```

Mudança visual só está verificada depois de aberta no navegador — a
interface é o produto aqui.
