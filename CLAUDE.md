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
src/lib/db/             banco: tipos, motor de sincronização, chamadas à nuvem
src/hooks/              fluxo do agente, relógio, contadores
supabase/migrations/    esquema e funções do banco (o que está aplicado)
bot/                    bot de WhatsApp de teste (Baileys), roda no Node
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
  pela **sessão** na hora da chamada, não por quem chamou. Não crie caminho
  de escrita que receba `lojaId` de fora sem checar o papel do usuário, como
  fazem `salvarLojaDaRede` e `criarLojaNaRede`. O banco confere de novo do
  lado dele: uma loja que tente gravar em outra recebe "Sem acesso".

## O banco na nuvem (Supabase)

Projeto `ztfgcpcwmzqlhnpaefup` (sa-east-1). O esquema inteiro está em
`supabase/migrations/20261004_rede_na_nuvem.sql`.

- **Ninguém lê tabela direto.** RLS ligada e sem política nenhuma: a chave
  pública não abre tabela. Tudo passa por funções `SECURITY DEFINER`
  (`entrar`, `ler_rede`, `versoes`, `gravar_dados`, `gravar_lojas`, `sair`,
  `bot_ler`, `bot_gravar`), e cada uma confere o token de quem chama. Os
  avisos do Supabase sobre "RLS sem política" e "função executável por anon"
  são **intencionais**; não "conserte" abrindo política.
- **Senha só existe como hash bcrypt no banco.** O navegador recebe um token
  de sessão de 30 dias, guardado em `preco-baixo:token`. Cinco senhas erradas
  travam o usuário por 15 minutos.
- **Cada loja é um documento JSON com versão** (`dados_loja`). Gravar exige a
  versão lida; se outra tela gravou antes, o banco recusa e `local-db.ts`
  relê e **reaplica a mesma mudança** em cima do novo. Por isso toda mudança
  passada a `alterarDados` precisa poder rodar duas vezes: id e horário
  nascem **fora** dela. A tela consulta `versoes` a cada 4 segundos e baixa
  só o que mudou.
- **Não use `delete` em SQL pelo MCP do Supabase.** Ele pede confirmação de
  comando destrutivo e a chamada trava até estourar o tempo. Para limpar
  dado, regrave o documento sem o item.

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
  lê e grava no banco na nuvem.
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
- **O agente só sabe o que mandarem para ele.** No painel, quem envia o
  catálogo é o navegador, em `lib/agente-contexto.ts`, e o servidor recorta
  antes de montar o texto: sem esse corte, uma requisição grande vira uma
  conta grande na API. O bot do WhatsApp lê do banco e monta o contexto pela
  mesma função.
- **Remédio nunca entra em promoção nem em sugestão.** `ehMedicamento()` em
  `types.ts` (categoria Genérico, Referência, Similar, ou exige receita). O
  contexto marca cada item como `[remédio]` ou `[pode sugerir]`, e na dúvida
  trata como remédio. A tela recusa promoção em item com receita.
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

## Conversas

- **Conversa resolvida sai da fila.** Fila é o que ainda dá trabalho; se o
  resolvido ficasse, a lista cresceria para sempre e esconderia o que
  importa. O resolvido vive no histórico do cliente, na aba ao lado.
- **O histórico é por pessoa, não por conversa.** `lib/conversas.ts` junta
  pelo telefone sem pontuação, não pelo nome: nome a mesma pessoa digita
  diferente a cada vez.
- **Assumir a conversa grava quem assumiu**, pelo mesmo motivo do
  `receitaConferidaPor` do pedido: quando der problema, a loja precisa saber
  quem estava atendendo. Escrever uma resposta assume sozinho, porque exigir
  o botão antes de poder responder atrapalha quem está com o cliente
  esperando.
- **Assumir cala o agente no WhatsApp.** O bot lê o status antes de
  responder; com `com_atendente`, ele só grava a mensagem do cliente. O que o
  atendente escreve no painel o bot entrega no WhatsApp, mas **só em
  conversa que o cliente começou** (id `cnv-wa-...`): escrever para quem
  nunca mandou mensagem é o que faz o número ser banido.

## Bot do WhatsApp (`bot/`)

Teste com chip reserva, via Baileys (entra como WhatsApp Web, lendo QR). Não
é a API oficial da Meta. Rodar: `cd bot && npm install && npm start`.

- **Usa o mesmo cérebro do painel.** O Node importa direto
  `src/lib/agent-config.ts`, `agente-contexto.ts` e `db/types.ts`. Por isso
  esses arquivos só importam entre si com caminho relativo **e extensão**
  (`./db/types.ts`): o Node não conhece o atalho `@/`. Import só de tipo pode
  usar `@/`, porque some na remoção de tipos.
- **O bot não tem usuário.** Tem uma chave em `bot/.chave-bot` que só abre a
  loja dele; no banco fica só o hash. `bot/sessao/` é o login do WhatsApp.
  Nenhum dos dois vai para o git, nem para a tela.
- **O modelo escolhe itens, o banco decide preço.** A ferramenta
  `registrar_pedido` confere nome, estoque e receita no catálogo; preço sai
  de `precoAtual()`. Pedido pelo WhatsApp paga no balcão ou na entrega.
- **Depois de um pedido fechado, o histórico recomeça.** Com a conversa
  inteira, o Haiku juntava os itens do pedido anterior no novo, mesmo
  instruído a não fazer. A mensagem que fecha pedido tem id `msg-ped-...` e
  o histórico enviado ao modelo começa depois dela.
- **"Vou passar para o farmacêutico" deixa alerta de verdade** no painel
  (ferramenta `chamar_equipe`, evento do tipo `erro`).

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
