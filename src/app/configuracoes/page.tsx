"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bell,
  Check,
  FlaskConical,
  Lock,
  Monitor,
  Moon,
  Settings2,
  ShieldCheck,
  Store,
  Sun,
  Trash2,
  Volume2,
} from "lucide-react";
import { PageHeader, Panel, PanelHeader } from "@/components/ui/panel";
import { Reveal } from "@/components/ui/reveal";
import { AreaProtegida } from "@/components/configuracoes/area-protegida";
import { Interruptor } from "@/components/configuracoes/controles";
import { apagarDadosDaLoja, useBanco } from "@/lib/db/use-db";
import { carregarExemplos } from "@/lib/db/exemplos";
import { definirSom, somLigado, testarSom } from "@/lib/sons";
import {
  temaDescricao,
  temaLabel,
  useTema,
  type Tema,
} from "@/components/providers/tema";
import { cn } from "@/lib/utils";

type Aba = "loja" | "geral";

export default function ConfiguracoesPage() {
  // O Suspense é exigido pelo Next para ler "?aba=" numa página gerada de
  // antemão.
  return (
    <Suspense>
      <Configuracoes />
    </Suspense>
  );
}

function Configuracoes() {
  const parametros = useSearchParams();
  const router = useRouter();
  const aba: Aba = parametros.get("aba") === "geral" ? "geral" : "loja";

  return (
    <div className="mx-auto max-w-[1280px]">
      <PageHeader
        title="Configurações"
        description="A loja, o que o agente sabe sobre ela e as preferências deste computador."
      />

      <div role="tablist" aria-label="Seções das configurações" className="mb-4 inline-flex gap-1 rounded-2xl border border-hairline bg-nivel-1 p-1">
        {(
          [
            ["loja", "Loja e agente", Lock],
            ["geral", "Geral", Settings2],
          ] as const
        ).map(([id, rotulo, Icone]) => (
          <button
            key={id}
            role="tab"
            aria-selected={aba === id}
            onClick={() => router.replace(`/configuracoes?aba=${id}`, { scroll: false })}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-medium transition-colors",
              aba === id ? "bg-brand-500/[0.14] text-fg" : "text-fg-muted hover:bg-nivel-3 hover:text-fg",
            )}
          >
            <Icone className="h-3.5 w-3.5" strokeWidth={2} />
            {rotulo}
          </button>
        ))}
      </div>

      {aba === "loja" ? <AreaProtegida /> : <Geral />}
    </div>
  );
}

function Geral() {
  const { banco, carregado } = useBanco();
  const [som, setSom] = useState(true);
  // Lê a preferência depois de montar: no servidor não existe navegador, e
  // ler direto no primeiro render faria a tela piscar com o valor errado.
  useEffect(() => {
    const t = setTimeout(() => setSom(somLigado()), 0);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Panel>
        <PanelHeader eyebrow="Aparência" title="Tema da interface" />
        <div className="px-5 pb-5">
          <p className="text-[12.5px] leading-relaxed text-fg-muted">
            A escolha vale para este navegador. Vitrine com sol forte pede o claro; loja à noite, o
            escuro. Em Sistema, a tela acompanha o tema do aparelho sozinha.
          </p>
          <div className="mt-3">
            <EscolhaDeTema />
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader eyebrow="Avisos" title="Som dos avisos" />
        <div className="space-y-3 px-5 pb-5">
          <Interruptor
            ligado={som}
            onAlternar={(v) => {
              definirSom(v);
              setSom(v);
            }}
            icone={Volume2}
            rotulo="Tocar som quando algo chegar"
            descricao="Vale para este computador. Deixe ligado no computador do balcão."
          />
          <div className="flex flex-wrap gap-2">
            <button onClick={() => testarSom("alerta")} className="btn-ghost !px-3 !py-1.5 !text-[12px]">
              <Bell className="h-3.5 w-3.5" strokeWidth={2} />
              Ouvir: precisa do farmacêutico
            </button>
            <button onClick={() => testarSom("pedido")} className="btn-ghost !px-3 !py-1.5 !text-[12px]">
              <Bell className="h-3.5 w-3.5" strokeWidth={2} />
              Ouvir: pedido novo
            </button>
            <button onClick={() => testarSom("mensagem")} className="btn-ghost !px-3 !py-1.5 !text-[12px]">
              <Bell className="h-3.5 w-3.5" strokeWidth={2} />
              Ouvir: mensagem
            </button>
          </div>
          <p className="text-[11.5px] leading-relaxed text-fg-ghost">
            O navegador só deixa tocar som depois do primeiro clique na página. Se o sistema ficou aberto
            sem ninguém mexer desde que ligou o computador, clique em qualquer lugar uma vez.
          </p>
        </div>
      </Panel>

      <Panel>
        <PanelHeader eyebrow="Conformidade" title="LGPD e responsabilidade" />
        <div className="px-5 pb-5">
          <Reveal className="tile flex items-start gap-2.5 p-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-positive" strokeWidth={2} />
            <p className="text-[11.5px] leading-relaxed text-fg-faint">
              Campanha só alcança quem autorizou. Compra de medicamento é dado sensível e não entra em
              disparo automático. Dúvida clínica vai para o farmacêutico responsável. O bot do WhatsApp
              só fala com quem escreveu primeiro.
            </p>
          </Reveal>
        </div>
      </Panel>

      <Panel>
        <PanelHeader eyebrow="Armazenamento" title="Onde os dados ficam" />
        <div className="px-5 pb-5">
          <div className="flex items-start gap-2.5">
            <Store className="mt-0.5 h-4 w-4 shrink-0 text-fg-faint" strokeWidth={2} />
            <p className="text-[12.5px] leading-relaxed text-fg-muted">
              Tudo fica no banco de dados na nuvem e vale para todos os computadores da loja. O que o
              WhatsApp recebe também cai aqui e aparece na tela em poucos segundos.
            </p>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { label: "Clientes", valor: banco.clientes.length },
              { label: "Produtos", valor: banco.produtos.length },
              { label: "Conversas", valor: banco.conversas.length },
            ].map((item) => (
              <div key={item.label} className="tile p-2.5 text-center">
                <p className="tnum font-mono text-[16px] font-semibold text-fg">{carregado ? item.valor : 0}</p>
                <p className="mt-0.5 text-[10.5px] text-fg-ghost">{item.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              onClick={() => {
                const ok = window.confirm(
                  "Isso ACRESCENTA clientes, conversas, pedidos e campanhas fictícios ao que a loja já tem. Nada que existe é apagado, mas os fictícios vão aparecer misturados com os reais. Continuar?",
                );
                if (ok) carregarExemplos();
              }}
              className="btn-ghost w-full !text-[12px]"
            >
              <FlaskConical className="h-3.5 w-3.5" strokeWidth={2} />
              Acrescentar dados de exemplo
            </button>

            <button
              onClick={() => {
                if (
                  window.confirm(
                    "Isso apaga clientes, produtos, conversas, pedidos e campanhas desta loja no servidor, para todo mundo que usa o sistema. Os ajustes da loja e do agente ficam. Não dá para desfazer. Continuar?",
                  )
                ) {
                  void apagarDadosDaLoja();
                }
              }}
              className="btn-ghost w-full !text-[12px] hover:!text-negative"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
              Apagar os cadastros desta loja
            </button>
          </div>
        </div>
      </Panel>
    </div>
  );
}

/**
 * A escolha de tema, com as três opções.
 *
 * "Seguir o sistema" é o padrão e fica primeiro porque resolve o caso de
 * quem já configurou o aparelho e não quer configurar de novo aqui.
 */
function EscolhaDeTema() {
  const { tema, definirTema } = useTema();

  const opcoes: { valor: Tema; icone: typeof Sun }[] = [
    { valor: "sistema", icone: Monitor },
    { valor: "claro", icone: Sun },
    { valor: "escuro", icone: Moon },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Tema da interface"
      className="grid grid-cols-1 gap-1.5 sm:grid-cols-3"
    >
      {opcoes.map(({ valor, icone: Icone }) => {
        const ativo = tema === valor;
        return (
          <button
            key={valor}
            type="button"
            role="radio"
            aria-checked={ativo}
            onClick={() => definirTema(valor)}
            title={temaDescricao[valor]}
            aria-label={temaDescricao[valor]}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[12.5px] transition-colors",
              ativo
                ? "border-brand-500/50 bg-brand-500/[0.12] text-fg"
                : "border-hairline bg-nivel-1 text-fg-muted hover:bg-nivel-3",
            )}
          >
            <Icone className="h-4 w-4 shrink-0" strokeWidth={2} />
            <span className="truncate">{temaLabel[valor]}</span>
            {ativo && (
              <Check
                className="ml-auto h-3.5 w-3.5 shrink-0 text-brand-400"
                strokeWidth={2.5}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
