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

Projeto `ztfgcpcwmzqlhnpaefup` (sa-east-1). O modelo atual está em
`supabase/migrations/20261005_registros.sql` (mais os ajustes de
`20261006_seguranca.sql`); o de 2026-10-04
(`dados_loja`, `rede`) continua no banco sem uso, com as funções fechadas.

- **Um registro por item, não um documento por loja.** Tabela `registros
  (loja_id, colecao, id, dados, versao, seq, momento, apagado)`. Cada
  cliente, conversa, pedido, campanha é uma linha. Apagar é `apagado =
  true`, nunca `delete`.
- **`seq` é uma sequência global** e toda escrita roda sob o mesmo
  `pg_advisory_xact_lock`, então quem pede `mudancas(desde)` nunca pula um
  registro. A tela consulta a cada 2,5 s (e ao voltar o foco) e baixa só o
  que mudou; acima de 1.500 mudanças ela recarrega tudo.
- **A tela só carrega o que está quente** (`_quentes`): cadastros inteiros,
  conversas abertas ou dos últimos 90 dias, pedidos abertos ou dos últimos
  60, envios de 7 dias, os 150 eventos mais recentes. O resto vem sob
  demanda por `buscar(loja, colecao, de, ate)` (histórico de pedidos) e
  `historico_cliente(loja, digitos)` (ficha do cliente). É isso que mantém
  o plano gratuito de pé com anos de dado.
- **`gravar(ops)` é tudo ou nada.** Cada operação leva a versão lida; se
  outra tela gravou antes, volta `conflito` com os registros atuais e
  `sincronia.ts` reaplica a mudança em cima deles. Toda mudança passada a
  `alterarDados` precisa poder rodar duas vezes: id e horário nascem fora.
- **`sincronia.ts` é usado pelo site e pelo bot.** A classe `Replica` monta o
  `DadosLoja` a partir dos registros e devolve o que mudou. Mexeu nela, os
  dois lados mudam juntos.
- **Ninguém lê tabela direto.** RLS ligada e sem política: tudo passa por
  funções `SECURITY DEFINER` que conferem o token (`carregar`, `mudancas`,
  `gravar`, `buscar`, `historico_cliente`; o bot usa `bot_carregar`,
  `bot_mudancas`, `bot_gravar_ops`, que só abrem as coleções dele). Os
  avisos de "RLS sem política" são **intencionais**.
- **`loja` e `ajustes` são protegidos.** Gravar neles exige administrador ou
  sessão liberada pela senha de ajustes (`liberar_ajustes(pin)`, vale 20
  minutos; cinco erros travam 15). Sem isso o banco devolve `protegido` e a
  tela pede a senha de novo. Os PINs ficam em `pins_loja`, em bcrypt.
- **Senha só existe como hash bcrypt.** O navegador guarda um token de
  sessão de 30 dias em `preco-baixo:token`.
- **Mídia vai para o bucket privado `midia`** pela função `midia`
  (`supabase/functions/midia`): POST envia, GET `?c=caminho` baixa. Ela
  confere `x-sessao` (tela) ou `x-bot` (bot), limita a 16 MB e a tipos
  conhecidos. A mensagem guarda só o caminho; ninguém tem link público.
- **Não use `delete` em SQL pelo MCP do Supabase.** A chamada trava pedindo
  confirmação de comando destrutivo. Para limpar dado, apague pela própria
  tela (vira `apagado = true`).

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
  atendente escreve no painel o bot entrega no WhatsApp, mas **só para quem já
  escreveu para a loja** (`primeiraMensagemEm` preenchido): escrever para
  quem nunca mandou mensagem é o que faz o número ser banido. Conversa com
  quem nunca escreveu nasce no canal `interno` e não sai do painel.

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
  (ferramenta `chamar_equipe` grava `conversa.alerta`; o card fica laranja e
  toca o som de chamado). Se o modelo prometer uma pessoa sem chamar a
  ferramenta, `garantirAlerta` cria o alerta do mesmo jeito.
- **O WhatsApp não depende do agente.** Toda mensagem que chega é gravada na
  hora, com foto, áudio ou arquivo, mesmo com o agente desligado ou caindo.
  O agente responde 2,5 s depois da última mensagem (junta as picadas). O
  bot grava `estado/whatsapp` a cada minuto; o painel considera no ar quem
  deu sinal nos últimos 3 minutos.
- **Para ficar ligado 24 horas** precisa de um servidor próprio (VPS) rodando
  `bot/manter-ligado.sh`. O ambiente de trabalho do Claude é temporário.

## Configurações da loja (área com senha)

`/configuracoes?aba=loja` abre só com a senha de ajustes. Ali ficam os dados
da loja e tudo o que o agente sabe: horários por dia, entrega (taxa fixa,
por bairro ou por distância, com simulador), pagamento e Pix, serviços,
perguntas frequentes, nome e tom da atendente. O que é salvo vira texto em
`agente-contexto.ts` e entra no prompt do agente na conversa seguinte. A
taxa por distância usa `loja-regras.ts` (Nominatim + fator de rua 1,3); o
bot recalcula a taxa no servidor, nunca aceita a do modelo.

## Campanhas

- **Toda campanha leva a linha de saída** (`RODAPE_SAIR` em
  `lib/campanhas.ts`). Não tem opção de tirar: é LGPD e é o que evita
  denúncia contra o número.
- **Remédio fica fora duas vezes.** A tela avisa e bloqueia o salvar quando
  o texto cita um remédio do catálogo; a rota `/api/campanhas/sugerir` só
  manda para a IA os produtos que podem ser anunciados e descarta qualquer
  versão que cite remédio.
- **O teste vai, o disparo não.** "Enviar teste" grava um `envio` que o bot
  entrega, e só para quem já escreveu para a loja. O disparo para a lista
  fica travado até o número oficial da Meta: pelo número de teste, envio em
  massa bane o chip.
- **Agendamento nunca no passado.** `SeletorDataHora` esconde dia e hora que
  já passaram e `agendamentoNoPassado` confere de novo ao salvar.

## Segurança (revisão de 2026-10-06)

- **Toda rota de `/api` que gasta dinheiro ou mexe com dado exige sessão.**
  O navegador manda `x-sessao` (via `cabecalhoDaSessao()`); a rota chama
  `exigirSessao()` de `lib/servidor/sessao.ts`, que pergunta ao banco
  (`conferir_sessao`). Rota nova sem isso deixa a chave da Anthropic aberta
  para a internet. A exceção é `/api/whatsapp`, que confere a assinatura da
  Meta em vez de sessão.
- **Quem o bot pode chamar é decidido pelo próprio bot**, pela lista
  `bot/contatos.json` (fora do git), que só cresce com mensagem que chegou
  de verdade pelo WhatsApp. Nunca monte endereço de envio a partir de
  telefone do banco: o painel escreve no banco.
- **`primeiraMensagemEm`, `ultimaMensagemEm` e o telefone de quem já
  escreveu só o bot muda.** A função `gravar` reescreve esses campos com o
  valor do banco (`_proteger_clientes`).
- **Senha de acesso tem regra mínima** (8+ caracteres, letra e número, sem o
  nome do acesso) e se troca em Configurações > Geral (`trocar_senha`, que
  derruba as outras sessões). Entrar com senha fraca marca `senha_fraca` e
  a tela mostra a faixa de aviso até trocar.
- **Cabeçalhos de segurança em `next.config.ts`** (política de conteúdo,
  sem iframe, nosniff). Serviço externo novo no navegador precisa entrar em
  `connect-src`, senão o navegador bloqueia.
- **A função `midia` só aceita os tipos da lista** e entrega com `nosniff`
  e `sandbox`: arquivo nunca roda como página.
- **Login responde igual** para usuário que não existe e senha errada.

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
