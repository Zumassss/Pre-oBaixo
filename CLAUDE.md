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

- **Nenhuma tela inventa número.** Tudo sai da camada em `src/lib/db/`, que
  hoje grava no navegador e amanhã troca por Supabase sem as telas mudarem.
  Dados de demonstração existem só em `src/lib/db/exemplos.ts` e só entram
  quando alguém clica no botão em Configurações.
- **Nada de biblioteca de gráfico.** Os gráficos são SVG próprio em
  `src/components/charts`. Mantenha assim: é mais leve e o traço combina com
  o resto da interface.
- **Item de pedido guarda `produtoId` do catálogo de verdade.** Copiar só o
  nome quebra a baixa de estoque na entrega em silêncio: o pedido fecha e o
  estoque não mexe.
- **Pix é gerado de verdade, confirmação não.** `lib/pix.ts` monta o BR Code
  com a chave da loja e funciona no app do banco; `npm run verificar:pix`
  confere o CRC e lê o payload de volta. Saber que o cliente pagou depende de
  um provedor com webhook, que não existe ainda: a tela precisa continuar
  dizendo isso em vez de simular baixa automática.
- **O Lenis não descobre sozinho que a página cresceu.** Ele guarda a altura
  em cache e só remede em `resize` da janela. Aqui a altura muda sem resize
  nenhum: navegação do App Router, dados chegando do armazenamento local,
  barra lateral recolhendo. Sem o `ResizeObserver` de
  `shell/smooth-scroll.tsx`, a rolagem trava antes do fim da página. Toda
  área rolável interna precisa de `data-lenis-prevent`.
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

Pedido com item de tarja não anda sozinho: entra em `aguardando_receita` e
só sai quando alguém registra a conferência. Não é etapa cosmética de fila, é
o que separa o sistema de um problema sanitário.

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
