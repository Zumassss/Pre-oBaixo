"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ClipboardList,
  MessageCircle,
  Stethoscope,
  Volume2,
  VolumeX,
  WifiOff,
  X,
} from "lucide-react";
import { useClock } from "@/hooks/use-clock";
import { type Aviso, avisar, estadoConexao, ouvirAvisos } from "@/lib/db/local-db";
import { useBanco } from "@/lib/db/use-db";
import { ALERTA_LABEL } from "@/lib/db/types";
import { definirSom, prepararAudio, somLigado, testarSom, tocar } from "@/lib/sons";
import { cn, formatBRLCents, formatClock } from "@/lib/utils";

/**
 * Fica de olho no que chega e avisa a equipe, em qualquer tela do sistema.
 *
 * Avisa três coisas: conversa que precisa do farmacêutico (ou de alguém da
 * loja), pedido novo e mensagem de cliente numa conversa que está com a
 * equipe. As três tocam som e aparecem no canto da tela com link direto.
 *
 * Na primeira leitura não avisa nada: o que já estava lá quando a tela abriu
 * não é novidade.
 */
export function Vigia() {
  const { banco, carregado } = useBanco();
  const visto = useRef<{ loja: string; chaves: Set<string> } | null>(null);

  useEffect(() => {
    prepararAudio();
  }, []);

  useEffect(() => {
    if (!carregado || !banco.loja.id) return;

    const atuais = new Map<string, () => void>();

    for (const c of banco.conversas) {
      if (c.status === "resolvida") continue;
      if (c.alerta) {
        atuais.set(`alerta:${c.id}:${c.alerta.em}`, () => {
          tocar("alerta");
          avisar("alerta", `${c.cliente}: ${ALERTA_LABEL[c.alerta!.tipo].toLowerCase()}`, {
            detalhe: c.alerta!.resumo,
            href: `/conversas?c=${c.id}`,
          });
        });
      }
      // Mensagem de cliente só avisa quando é a equipe quem responde. Com o
      // agente no comando, avisar cada mensagem seria barulho.
      const equipeResponde = c.status === "com_atendente" || !banco.agenteLigado.ativo;
      const ultima = c.mensagens[c.mensagens.length - 1];
      if (equipeResponde && ultima?.origem === "cliente") {
        atuais.set(`msg:${ultima.id}`, () => {
          tocar("mensagem");
          avisar("mensagem", `${c.cliente} escreveu`, {
            detalhe: ultima.texto || "Mandou um arquivo",
            href: `/conversas?c=${c.id}`,
          });
        });
      }
    }

    for (const p of banco.pedidos) {
      atuais.set(`pedido:${p.id}`, () => {
        tocar("pedido");
        avisar("pedido", `Pedido #${p.numero} chegou`, {
          detalhe: `${p.cliente} · ${formatBRLCents(p.total)} · ${p.formaEntrega === "entrega" ? "entrega" : "retirada"}`,
          href: "/pedidos",
        });
      });
    }

    const anterior = visto.current;
    if (anterior && anterior.loja === banco.loja.id) {
      // Um som por vez: se chegaram três coisas juntas, o mais urgente toca.
      const novidades = [...atuais.entries()].filter(([chave]) => !anterior.chaves.has(chave));
      novidades.sort(([a], [b]) => prioridade(a) - prioridade(b));
      novidades.slice(0, 3).forEach(([, avisarDisto]) => avisarDisto());
    }
    visto.current = { loja: banco.loja.id, chaves: new Set(atuais.keys()) };
  }, [banco, carregado]);

  return null;
}

function prioridade(chave: string) {
  return chave.startsWith("alerta") ? 0 : chave.startsWith("pedido") ? 1 : 2;
}

/* ------------------------------------------------------------------
   Os avisos no canto da tela
   ------------------------------------------------------------------ */

const ESTILO: Record<Aviso["tipo"], { icone: typeof X; classe: string; duracao: number }> = {
  alerta: { icone: Stethoscope, classe: "border-caution/45 bg-caution/[0.14] text-caution", duracao: 15000 },
  pedido: { icone: ClipboardList, classe: "border-positive/40 bg-positive/[0.12] text-positive", duracao: 9000 },
  mensagem: { icone: MessageCircle, classe: "border-info/40 bg-info/[0.12] text-info", duracao: 7000 },
  erro: { icone: AlertTriangle, classe: "border-brand-500/45 bg-brand-500/[0.12] text-brand-400", duracao: 9000 },
  info: { icone: MessageCircle, classe: "border-hairline bg-nivel-3 text-fg-muted", duracao: 6000 },
};

export function Avisos() {
  const [lista, setLista] = useState<Aviso[]>([]);

  useEffect(
    () =>
      ouvirAvisos((aviso) => {
        setLista((atual) => [aviso, ...atual].slice(0, 4));
        setTimeout(
          () => setLista((atual) => atual.filter((a) => a.id !== aviso.id)),
          ESTILO[aviso.tipo].duracao,
        );
      }),
    [],
  );

  const fechar = (id: number) => setLista((atual) => atual.filter((a) => a.id !== id));

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-20 right-4 z-[60] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2 lg:bottom-5 lg:right-5"
    >
      {lista.map((aviso) => {
        const { icone: Icone, classe } = ESTILO[aviso.tipo];
        const corpo = (
          <>
            <span
              className={cn(
                "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border",
                classe,
              )}
            >
              <Icone className="h-4 w-4" strokeWidth={2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold leading-snug text-fg">{aviso.texto}</span>
              {aviso.detalhe && (
                <span className="mt-0.5 line-clamp-2 block text-[12px] leading-snug text-fg-muted">
                  {aviso.detalhe}
                </span>
              )}
            </span>
          </>
        );
        return (
          <div
            key={aviso.id}
            role={aviso.tipo === "alerta" || aviso.tipo === "erro" ? "alert" : "status"}
            className={cn(
              "glass-solid pointer-events-auto relative flex items-start gap-3 rounded-2xl p-3 pr-9 sombra-flutuante",
              aviso.tipo === "alerta" && "ring-1 ring-caution/50",
            )}
            style={{ animation: "rise 0.35s cubic-bezier(0.16,1,0.3,1) both" }}
          >
            {aviso.href ? (
              <Link href={aviso.href} onClick={() => fechar(aviso.id)} className="flex flex-1 items-start gap-3">
                {corpo}
              </Link>
            ) : (
              corpo
            )}
            <button
              onClick={() => fechar(aviso.id)}
              aria-label="Fechar aviso"
              className="absolute right-2 top-2 rounded-full p-1 text-fg-ghost transition-colors hover:bg-nivel-3 hover:text-fg"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------
   Barra do topo: som e "ao vivo"
   ------------------------------------------------------------------ */

export function BotaoSom() {
  const [ligado, setLigado] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLigado(somLigado()), 0);
    return () => clearTimeout(t);
  }, []);

  function alternar() {
    const novo = !ligado;
    definirSom(novo);
    setLigado(novo);
    if (novo) testarSom("pedido");
  }

  return (
    <button
      onClick={alternar}
      aria-pressed={ligado}
      aria-label={ligado ? "Desligar som dos avisos" : "Ligar som dos avisos"}
      title={ligado ? "Som dos avisos ligado" : "Som dos avisos desligado"}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-nivel-2 transition-colors hover:bg-nivel-4",
        ligado ? "text-fg-muted hover:text-fg" : "text-fg-ghost",
      )}
    >
      {ligado ? (
        <Volume2 className="h-[15px] w-[15px]" strokeWidth={1.9} />
      ) : (
        <VolumeX className="h-[15px] w-[15px]" strokeWidth={1.9} />
      )}
    </button>
  );
}

/**
 * O relógio do topo também diz se a tela está em dia com o servidor.
 *
 * Verde: falou com o servidor nos últimos segundos. Âmbar: está demorando
 * (rede lenta, aba que acabou de voltar). Vermelho: a última gravação não
 * foi salva. A pessoa no balcão precisa saber se o que vê é o agora.
 */
export function AoVivo() {
  const agora = useClock();
  const { logado, ultimoContato, falhaDeGravacao } = estadoConexao();
  const atraso = agora && ultimoContato ? (agora.getTime() - ultimoContato) / 1000 : 0;

  const situacao = !logado
    ? { cor: "bg-fg-ghost", texto: "", titulo: "" }
    : falhaDeGravacao
      ? { cor: "bg-brand-500", texto: "Sem conexão", titulo: "A última alteração ainda não foi salva. Tentando de novo." }
      : atraso > 12
        ? { cor: "bg-caution", texto: "Reconectando", titulo: `Sem notícia do servidor há ${Math.round(atraso)} segundos.` }
        : { cor: "bg-positive animate-blink", texto: "Ao vivo", titulo: `Atualizado há ${Math.max(0, Math.round(atraso))} s.` };

  return (
    <div
      title={situacao.titulo}
      className="hidden items-center gap-2 rounded-full border border-hairline bg-nivel-2 px-3 py-2 sm:flex"
    >
      {falhaDeGravacao && <WifiOff className="h-3.5 w-3.5 text-brand-400" strokeWidth={2} />}
      <span className={cn("h-1.5 w-1.5 rounded-full", situacao.cor)} />
      {situacao.texto && (
        <span className="text-[11.5px] font-medium text-fg-muted">{situacao.texto}</span>
      )}
      <span className="tnum font-mono text-[12px] text-fg-faint">
        {agora ? formatClock(agora) : "--:--:--"}
      </span>
    </div>
  );
}
