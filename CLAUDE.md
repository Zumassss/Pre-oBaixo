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

## O modelo de dados (leia antes de mexer em `src/lib/db/`)

O sistema atende uma **rede** de farmácias, com dois perfis de acesso.

- `Banco` é a rede inteira: usuários, lojas, o bloco de dados de cada loja e a
  sessão. Só a visão de rede e a barra lateral encostam nele.
- `VisaoLoja` é o recorte de UMA loja (os dados dela mais o cadastro). É o que
  **toda** tela de operação consome, via `useBanco()`. Nenhuma tela recebe a
  rede, então nenhuma tela consegue mostrar dado de outra unidade, nem por
  engano.
- Toda escrita passa por `alterarDados()` em `use-db.ts`, que descobre a loja
  pela **sessão**, não por quem chamou. É por isso que nenhuma operação
  consegue gravar na loja errada. Não crie caminho de escrita que receba
  `lojaId` de fora sem checar o papel do usuário, como fazem
  `salvarLojaDaRede` e `criarLojaNaRede`.
- O armazenamento é a chave `preco-baixo:v2`. Quem usou a versão de loja única
  tem cadastros em `preco-baixo:v1`, e `migrarDaVersaoAntiga()` os traz para a
  primeira loja. Apagar a chave antiga seria jogar fora o trabalho de alguém.
- **Os usuários vêm sempre do código, nunca do armazenamento.** Se viessem do
  que está salvo, uma base gravada por uma versão antiga poderia deixar
  alguém trancado fora do sistema, sem senha e sem conserto.

## O login não é autenticação

As senhas `1234` estão em texto puro no navegador e qualquer pessoa as lê. Elas
separam os dois perfis na demonstração, nada mais. **Antes de existir dado real
de cliente aqui dentro, isto tem que virar verificação no servidor.** Não
escreva texto de interface que sugira que o acesso é protegido.

## Duas peles, um sistema

O sistema tem tema claro e escuro, e os dois são o mesmo CSS: o que muda é o
valor das fichas, trocado pelo atributo `data-tema` no `<html>`.

- **Nunca escreva cor solta em componente.** `bg-white/[0.05]`, `text-white`,
  `rgba(0,0,0,0.7)` e afins funcionam no escuro e somem no claro. Use as
  fichas: `bg-nivel-1..4` (o degrau entre uma superfície e a de cima),
  `ring-anel`, `bg-veu`, `sombra-flutuante`, `vinheta`, e os `fg-*` de sempre.
  A exceção é `text-white` sobre preenchimento da marca, que é branco nos dois
  temas de propósito.
- **O tema é escrito por script embutido no `<head>`, antes do React existir**
  (`SCRIPT_TEMA` em `providers/tema.tsx`). Sem isso a página nasce escura e
  clareia depois que o React monta, e o usuário leva um flash branco a cada
  carregamento. Por isso o `<html>` tem `suppressHydrationWarning`.
- **O painel do globo fica escuro nos dois temas** (`pele-escura`). O globo é
  partícula de luz somada sobre preto: sobre branco ele vira um borrão. É a
  mesma escolha de um mapa ou de um player de vídeo dentro de uma tela clara.
  Se criar outro bloco assim, lembre de sobrescrever também `--vidro-fundo`:
  foi o que faltou da primeira vez e deixou pílula branca com texto branco.
- **`npm run verificar:contraste` precisa passar.** Ele confere, sem abrir
  navegador, se todo tom de texto tem pelo menos 4,5:1 sobre toda superfície,
  nos dois temas. Escurecer um cinza "só um pouco" costuma ser o que quebra.

## Regras deste projeto

- **Nenhuma tela inventa número.** Tudo sai da camada em `src/lib/db/`, que
  hoje grava no navegador e amanhã troca por Supabase sem as telas mudarem.
  Dados de demonstração existem só em `src/lib/db/exemplos.ts` e só entram
  quando alguém clica no botão em Configurações.
- **Nada de biblioteca de gráfico.** Os gráficos são SVG próprio em
  `src/components/charts`. Mantenha assim: é mais leve e o traço combina com
  o resto da interface.
- **A assinatura do webhook do WhatsApp é conferida sobre o corpo cru.**
  `await request.text()` antes de qualquer `JSON.parse`. Reserializar o JSON
  muda espaço e ordem de chave, e a conta do HMAC nunca fecha. Sem essa
  conferência, qualquer um que descubra a URL faz o agente responder na conta
  da loja.
- **O webhook responde 200 mesmo quando algo dá errado do nosso lado.** A Meta
  reenvia a mesma mensagem enquanto não receber 200, e aí o cliente recebe
  resposta repetida. Erro nosso vai para o log, não para o código HTTP. A
  exceção é assinatura inválida, que é recusada com 401.
- **O agente vive em `lib/agente.ts`, não em cada rota.** Chat do painel e
  WhatsApp chamam a mesma função. Com a chamada duplicada, um dia a regra de
  medicamento valeria em um canal e não no outro.
- **Item de pedido guarda `produtoId` do catálogo de verdade.** Copiar só o
  nome quebra a baixa de estoque na entrega em silêncio: o pedido fecha e o
  estoque não mexe.
- **O estoque cai exatamente uma vez, quando o produto sai da loja.** Na
  retirada, isso é a entrega no balcão; na entrega por motoboy, é o despacho,
  porque dali em diante a caixa não está mais na prateleira. Quem decide é
  `saiDoEstoque()` em `use-db.ts`. Mexer nas etapas sem olhar essa função dá
  baixa dupla ou baixa nenhuma.
- **Loja sem motoboy não oferece entrega.** `Loja.temMotoboy` desliga a opção
  na tela e zera a taxa no pedido. Prometer entrega que a unidade não faz é
  pior que não oferecer.
- **O agente só sabe o que mandarem para ele.** O catálogo e os dados da loja
  vivem no navegador, então quem os envia é o cliente, em
  `lib/agente-contexto.ts`. O servidor recorta o que chega antes de montar o
  texto: sem esse corte, uma requisição grande vira uma conta grande na API.
  No **WhatsApp o servidor não tem esses dados**, e por isso o contexto de lá
  diz ao agente, com todas as letras, que ele não pode informar preço nem
  disponibilidade. Enquanto não houver banco de dados, não tire essa frase.
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
npx eslint .                  # precisa passar limpo
npm run verificar:contraste   # os dois temas precisam passar
npm run build                 # precisa compilar sem erro
```

Mudança visual só está verificada depois de aberta no navegador, **nos dois
temas** — a interface é o produto aqui.
