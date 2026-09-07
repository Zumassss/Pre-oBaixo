# Preço Baixo · Sistema de Gestão

Sistema de gestão da operação de atendimento automatizado das **Farmácias
Preço Baixo** — o painel onde a rede acompanha o agente de WhatsApp
trabalhando, gerencia conversas, clientes, campanhas e catálogo, e define os
limites do que a automação pode fazer sozinha.

Projeto desenvolvido pela **MAZUS**.

---

## Estado atual

Esta é a **base da interface**. A camada visual está completa e navegável; os
dados são simulados e ficam isolados em `src/lib/mock/` para que a troca pela
API real aconteça em um ponto só, sem tocar nas telas.

### Telas prontas

| Rota | O que é |
|---|---|
| `/` | **Central de Operações** — esfera 3D de partículas com a rede ao vivo, fluxo de ações do agente em tempo real, indicadores e alertas |
| `/conversas` | Caixa de entrada do WhatsApp com histórico, contexto do cliente e sugestão do agente |
| `/clientes` | CRM: base, segmentos, LTV e registro de consentimento |
| `/campanhas` | Disparos segmentados, desempenho e sugestão automática de público |
| `/catalogo` | Produtos consultados pelo agente, estoque e alertas de reposição |
| `/agente` | **Cérebro do agente**: comportamento, base de conhecimento, confiança por tarefa e regras de segurança |
| `/relatorios` | Séries de conversão, tempo de resposta e desempenho por unidade |
| `/configuracoes` | Canal WhatsApp, regras de atendimento, unidades, equipe e LGPD |

---

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** — tokens do design system em `src/app/globals.css`
- **Three.js** + **React Three Fiber** — a esfera de partículas
- **Motion** — animações de entrada e do fluxo ao vivo
- **Lucide** — ícones

Gráficos são **SVG escritos à mão** (`src/components/charts`), sem biblioteca:
controle total do traço, peso zero no pacote e nada que trave a interface.

---

## Rodando

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # build de produção
npx eslint .    # lint
```

---

## Design

Preto absoluto com vermelho de alta energia, superfícies de vidro, brilho
radial e profundidade construída por luz — não por sombra pesada.

As referências que guiaram as decisões estão em `docs/referencias/`:

- `ref-centro-operacoes-globo.jpg` — estrutura do painel central
- `ref-globo-particulas.gif` — comportamento da esfera de pontos
- `ref-paleta-preto-vermelho.jpg` — paleta
- `ref-glassmorphism.jpg` — tratamento de vidro e brilho
- `ref-dashboard-estrutura.jpg` / `ref-sidebar-densidade.jpg` — layout e densidade
- `logo-original.jpg` — logotipo de origem, refeito em vetor em
  `src/components/brand/logo.tsx`

### Notas de implementação que importam

- **Hidratação**: `Math.sin`/`Math.cos` não são idênticos entre Node e
  navegador. Todo cálculo com trigonometria que chega ao DOM passa por um
  arredondamento (`quantize`), senão o React acusa divergência.
- **Esfera**: a nuvem usa uma semente fixa (mulberry32) — mesma esfera a cada
  render, sem salto visual e sem quebrar a pureza exigida pelo React 19.
- **Desempenho**: uma única chamada de desenho para as 14 mil partículas,
  `dpr` limitado a 1.8, e animações restritas a `transform` e `opacity`.

---

## Próximos passos

1. Integração com o **PDV/ERP da rede** — preço e estoque em tempo real (é o
   que permite o agente fechar pedido sem conferência humana).
2. Conexão real com a **WhatsApp Business API** (Meta Cloud API).
3. Backend e persistência: substituir `src/lib/mock/` por API.
4. Autenticação e níveis de acesso por unidade.
5. Conteúdo de orientação revisado e assinado pelo **farmacêutico
   responsável** — pré-requisito regulatório, não item opcional.
