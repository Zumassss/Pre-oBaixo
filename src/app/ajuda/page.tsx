"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bike,
  Hand,
  Check,
  ChevronDown,
  ClipboardList,
  MessagesSquare,
  Package,
  QrCode,
  Stethoscope,
  Store,
  Users,
} from "lucide-react";
import { PageHeader, Panel, PanelHeader } from "@/components/ui/panel";
import { Reveal } from "@/components/ui/reveal";
import { useBanco, useSessao } from "@/lib/db/use-db";
import { pixConfigurado } from "@/lib/pix";
import { cn } from "@/lib/utils";

/**
 * Como usar o sistema.
 *
 * O que diferencia esta página de um manual solto é que ela se confere
 * sozinha: cada passo olha o estado real e diz se já foi feito. Quem abre
 * sabe na hora o que falta, em vez de reler tudo para descobrir onde parou.
 */

type Passo = {
  id: string;
  titulo: string;
  texto: string;
  href: string;
  acao: string;
  icone: typeof Store;
  feito: boolean;
  /** Passo que não faz sentido sem outro antes dele. */
  depende?: string;
};

export default function AjudaPage() {
  const { banco, carregado } = useBanco();
  const { usuario } = useSessao();
  const ehAdmin = usuario?.papel === "admin";

  const passos = useMemo<Passo[]>(
    () => [
      {
        id: "loja",
        titulo: "Preencha os dados da loja",
        texto:
          "Endereço, horário e farmacêutico responsável. É daqui que o agente tira o que responder quando o cliente pergunta onde fica ou até que horas abre.",
        href: "/configuracoes",
        acao: "Abrir configurações",
        icone: Store,
        feito: banco.loja.configurada,
      },
      {
        id: "catalogo",
        titulo: "Cadastre os produtos que você vende",
        texto:
          "Nome, preço, estoque e se exige receita. Sem catálogo o sistema não sabe o que cobrar nem o que dar baixa, e o pedido não fecha.",
        href: "/catalogo",
        acao: "Abrir catálogo",
        icone: Package,
        feito: banco.produtos.length > 0,
      },
      {
        id: "entrega",
        titulo: "Diga se a loja entrega",
        texto:
          "Se tiver motoboy, marque em Configurações e informe a taxa. Sem isso marcado, todo pedido é retirada no balcão e a opção de entrega nem aparece para quem atende.",
        href: "/configuracoes",
        acao: "Configurar entrega",
        icone: Bike,
        feito: banco.loja.temMotoboy,
      },
      {
        id: "pix",
        titulo: "Informe a chave Pix da loja",
        texto:
          "Com a chave salva, cada pedido gera o Pix copia e cola já com o valor certo, pronto para mandar no WhatsApp do cliente.",
        href: "/configuracoes",
        acao: "Cadastrar chave",
        icone: QrCode,
        feito: pixConfigurado(banco.pagamentos),
      },
      {
        id: "clientes",
        titulo: "Cadastre os clientes que já compram",
        texto:
          "Telefone e endereço fazem o pedido se montar mais rápido, e o consentimento é o que permite mandar campanha sem infringir a LGPD.",
        href: "/clientes",
        acao: "Abrir clientes",
        icone: Users,
        feito: banco.clientes.length > 0,
      },
      {
        id: "pedido",
        titulo: "Registre o primeiro pedido",
        texto:
          "Escolha o cliente, adicione os produtos, diga se é retirada ou motoboy e como vai pagar. O pedido entra na fila na etapa certa sozinho.",
        href: "/pedidos",
        acao: "Abrir pedidos",
        icone: ClipboardList,
        feito: banco.pedidos.length > 0,
        depende: "catalogo",
      },
    ],
    [banco],
  );

  const feitos = passos.filter((p) => p.feito).length;

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        title="Como usar"
        description="O caminho do começo ao primeiro pedido entregue. Cada passo se marca sozinho quando você faz."
      />

      <div className="space-y-4">
        {/* Progresso */}
        <Panel>
          <div className="flex flex-wrap items-center gap-4 p-5">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-fg">
                {feitos === passos.length
                  ? "Tudo pronto para operar"
                  : `${feitos} de ${passos.length} passos concluídos`}
              </p>
              <p className="mt-0.5 text-[12px] text-fg-faint">
                {feitos === passos.length
                  ? "A loja está configurada. Daqui em diante é operação."
                  : "Não precisa ser tudo hoje. O que falta continua marcado aqui."}
              </p>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-nivel-3">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-700 to-brand-400 transition-[width] duration-700"
                  style={{
                    width: `${carregado ? Math.round((feitos / passos.length) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </Panel>

        {/* Passos */}
        <ol className="space-y-2">
          {passos.map((passo, i) => {
            const travado =
              passo.depende && !passos.find((p) => p.id === passo.depende)?.feito;
            const Icone = passo.icone;

            return (
              <Reveal
                as="li"
                key={passo.id}
                className="rounded-panel border border-hairline bg-nivel-1 p-4"
                style={{
                  animation: `rise 0.5s cubic-bezier(0.16,1,0.3,1) ${i * 50}ms both`,
                }}
              >
                <div className="flex flex-wrap items-start gap-3.5">
                  {/* O número importa: esta é a ordem que funciona. */}
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-[12.5px] font-semibold tabular-nums",
                      passo.feito
                        ? "border-positive/30 bg-positive/[0.12] text-positive"
                        : "border-hairline bg-nivel-2 text-fg-muted",
                    )}
                  >
                    {passo.feito ? (
                      <Check className="h-4 w-4" strokeWidth={2.6} />
                    ) : (
                      i + 1
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2
                        className={cn(
                          "text-[13.5px] font-semibold",
                          passo.feito ? "text-fg-muted" : "text-fg",
                        )}
                      >
                        {passo.titulo}
                      </h2>
                      <Icone
                        className="h-3.5 w-3.5 shrink-0 text-fg-ghost"
                        strokeWidth={2}
                      />
                      {passo.feito && (
                        <span className="chip chip-good !px-2 !py-[2px] !text-[9.5px]">
                          feito
                        </span>
                      )}
                    </div>
                    <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-fg-faint">
                      {passo.texto}
                    </p>
                    {travado && (
                      <p className="mt-1 text-[11.5px] text-caution">
                        Faça o passo anterior antes deste.
                      </p>
                    )}
                  </div>

                  <Link
                    href={passo.href}
                    className={cn(
                      "shrink-0 !text-[12px]",
                      passo.feito ? "btn-ghost" : "btn-primary",
                    )}
                  >
                    {passo.feito ? "Revisar" : passo.acao}
                    <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.2} />
                  </Link>
                </div>
              </Reveal>
            );
          })}
        </ol>

        {/* Dia a dia */}
        <Panel>
          <PanelHeader
            eyebrow="Rotina"
            title="O dia a dia, depois que está tudo configurado"
          />
          <div className="grid grid-cols-1 gap-3 px-5 pb-5 sm:grid-cols-2">
            {ROTINA.map((item) => {
              const Icone = item.icone;
              return (
                <Reveal key={item.titulo} className="tile p-3.5">
                  <div className="flex items-center gap-2">
                    <Icone
                      className="h-3.5 w-3.5 shrink-0 text-brand-400"
                      strokeWidth={2}
                    />
                    <h3 className="text-[12.5px] font-semibold text-fg">
                      {item.titulo}
                    </h3>
                  </div>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-fg-faint">
                    {item.texto}
                  </p>
                </Reveal>
              );
            })}
          </div>
        </Panel>

        {/* Dúvidas */}
        <Panel>
          <PanelHeader eyebrow="Dúvidas" title="O que sempre perguntam" />
          <div className="px-5 pb-5">
            {(ehAdmin ? [...DUVIDAS, ...DUVIDAS_ADMIN] : DUVIDAS).map(
              (duvida) => (
                <Sanfona
                  key={duvida.pergunta}
                  pergunta={duvida.pergunta}
                  resposta={duvida.resposta}
                />
              ),
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

const ROTINA = [
  {
    titulo: "Pedido novo chega",
    texto:
      "Ele entra na fila já na etapa certa: com item de tarja para na conferência da receita, com Pix para no pagamento, e o resto vai direto para o preparo.",
    icone: ClipboardList,
  },
  {
    titulo: "Empurrar o pedido",
    texto:
      "O botão da direita do cartão sempre faz o passo seguinte, e o texto dele diz qual é. Você nunca precisa escolher o status na mão.",
    icone: ArrowRight,
  },
  {
    titulo: "Receita de tarja",
    texto:
      "Pedido com tarja não anda sem alguém clicar em Conferi a receita. O nome de quem conferiu fica gravado no pedido, que é o que a lei pede.",
    icone: Stethoscope,
  },
  {
    titulo: "Entrega por motoboy",
    texto:
      "Quando o pedido sai, o estoque cai na hora do despacho, não na confirmação: dali em diante a caixa não está mais na prateleira.",
    icone: Bike,
  },
  {
    titulo: "Conversas",
    texto:
      "O agente responde sozinho o que é informação. Dúvida sobre medicamento, dose ou interação ele passa para o farmacêutico, sempre.",
    icone: MessagesSquare,
  },
  {
    titulo: "Assumir o atendimento",
    texto:
      "Em Assumir conversa, você entra no lugar do agente e o seu nome fica visível para a equipe. Escrever uma resposta já assume sozinho. Devolver ao agente desfaz.",
    icone: Hand,
  },
  {
    titulo: "Estoque baixo",
    texto:
      "Quando um produto fica abaixo do mínimo que você cadastrou, ele aparece no sino da barra de cima e no relatório.",
    icone: Package,
  },
];

const DUVIDAS = [
  {
    pergunta: "O Pix confirma sozinho quando o cliente paga?",
    resposta:
      "Não. O sistema gera o código Pix de verdade, com o valor certo, mas quem confere se o dinheiro caiu é você, no aplicativo do banco. Baixa automática exige contratar um provedor de pagamento, como Mercado Pago ou Asaas.",
  },
  {
    pergunta: "Onde ficam salvos os dados?",
    resposta:
      "Neste navegador, nesta máquina. É o suficiente para usar e demonstrar, mas não vale entre computadores: o que você cadastrar aqui não aparece no caixa ao lado. Quando o banco de dados na nuvem entrar, os mesmos cadastros passam a valer para a equipe toda.",
  },
  {
    pergunta: "O agente pode indicar remédio para o cliente?",
    resposta:
      "Não, e isso não é configurável. Ele informa preço, estoque, horário e endereço. Qualquer pergunta sobre dose, uso ou interação ele encaminha para o farmacêutico responsável cadastrado na loja.",
  },
  {
    pergunta: "Apaguei um pedido sem querer. Dá para voltar?",
    resposta:
      "Não. Remover é definitivo. Para um pedido que não vai acontecer, use Cancelar em vez de remover: ele sai da fila mas continua no histórico e nos relatórios.",
  },
  {
    pergunta: "Onde foram parar as conversas que eu resolvi?",
    resposta:
      "Para o histórico. Conversa resolvida sai da fila de propósito, senão a lista de quem atende cresce para sempre e some o que ainda dá trabalho. Em Conversas, na aba Histórico, cada cliente tem tudo o que já foi falado com ele, e dali dá para iniciar uma conversa nova já com os dados preenchidos.",
  },
  {
    pergunta: "A tela está clara demais ou escura demais. Dá para trocar?",
    resposta:
      "Dá, no botão de sol ou lua na barra de cima, que troca na hora. Em Configurações existe a escolha completa, com a opção de seguir o tema do aparelho sozinho. A escolha vale para este navegador, então cada computador da loja pode ficar do jeito que funciona melhor naquela luz.",
  },
  {
    pergunta: "Como vejo o resultado de um período diferente?",
    resposta:
      "No seletor de período, na barra de cima. Ele vale para o painel, os relatórios e a visão da rede ao mesmo tempo.",
  },
];

const DUVIDAS_ADMIN = [
  {
    pergunta: "Como abro uma loja nova na rede?",
    resposta:
      "Em Visão da rede, no botão Nova loja. Ela nasce vazia e separada: nenhuma loja enxerga o cadastro da outra. Preencha o perfil dela antes de colocar alguém para operar.",
  },
  {
    pergunta: "O que acontece quando eu pauso uma loja?",
    resposta:
      "Ela sai da operação mas nada é apagado. O faturamento que ela já fez continua nos relatórios da rede, porque venda passada não deixa de ter acontecido. Reativar devolve tudo como estava.",
  },
  {
    pergunta: "Trocar de loja no menu muda o que eu vejo?",
    resposta:
      "Muda tudo: painel, pedidos, catálogo, clientes e conversas passam a ser os da loja escolhida. O nome da loja aberta fica sempre visível no topo da barra lateral, justamente para não haver dúvida.",
  },
];

function Sanfona({
  pergunta,
  resposta,
}: {
  pergunta: string;
  resposta: string;
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <div className="border-b border-hairline last:border-b-0">
      <button
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="flex w-full items-center gap-3 py-3 text-left"
      >
        <span className="min-w-0 flex-1 text-[12.5px] font-medium text-fg">
          {pergunta}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-fg-ghost transition-transform duration-200",
            aberto && "rotate-180",
          )}
          strokeWidth={2}
        />
      </button>
      {aberto && (
        <p
          className="max-w-3xl pb-4 text-[12.5px] leading-relaxed text-fg-faint"
          style={{ animation: "rise 0.25s cubic-bezier(0.16,1,0.3,1) both" }}
        >
          {resposta}
        </p>
      )}
    </div>
  );
}
