"use client";

import { useState } from "react";
import { Building2, KeyRound, ShieldCheck, Users } from "lucide-react";
import { PageHeader, Panel, PanelHeader } from "@/components/ui/panel";
import { Reveal } from "@/components/ui/reveal";
import { storeStatusLabel, stores } from "@/lib/mock/stores";
import { cn } from "@/lib/utils";

function Toggle({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        "flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200",
        on
          ? "bg-brand-500/30 ring-1 ring-inset ring-brand-500/50"
          : "bg-white/[0.07] ring-1 ring-inset ring-white/10",
      )}
    >
      <span
        className={cn(
          "h-4 w-4 rounded-full transition-transform duration-200",
          on
            ? "translate-x-4 bg-brand-500 shadow-[0_0_10px_1px_rgba(255,23,65,0.7)]"
            : "translate-x-0 bg-fg-ghost",
        )}
      />
    </span>
  );
}

const REGRAS = [
  {
    id: "24h",
    title: "Atendimento 24 horas",
    detail: "Fora do horário, o agente responde e agenda retirada.",
    inicial: true,
  },
  {
    id: "clinica",
    title: "Transferir dúvida clínica",
    detail: "Pergunta sobre uso, dose ou interação vai ao farmacêutico.",
    inicial: true,
    travada: true,
  },
  {
    id: "followup",
    title: "Follow-up de recompra",
    detail: "Lembrete quando o ciclo do medicamento contínuo termina.",
    inicial: true,
  },
  {
    id: "pedido",
    title: "Fechar pedido sem humano",
    detail: "Permite concluir pedido com estoque confirmado.",
    inicial: false,
  },
];

export default function ConfiguracoesPage() {
  const [regras, setRegras] = useState<Record<string, boolean>>(
    Object.fromEntries(REGRAS.map((r) => [r.id, r.inicial])),
  );

  return (
    <div className="mx-auto max-w-[1560px]">
      <PageHeader
        title="Configurações"
        description="Conexões, unidades, permissões e regras do atendimento."
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Panel className="xl:col-span-6">
          <PanelHeader
            eyebrow="Canal"
            title="WhatsApp Business API"
            action={<span className="chip chip-good">conectado</span>}
          />
          <div className="px-5 pb-5">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Número", value: "+55 11 4002-8922" },
                { label: "Provedor", value: "Meta Cloud API" },
                { label: "Qualidade", value: "Alta" },
                { label: "Limite diário", value: "100 mil" },
              ].map((item) => (
                <Reveal key={item.label} className="tile p-3">
                  <p className="text-[10.5px] uppercase tracking-[0.12em] text-fg-ghost">
                    {item.label}
                  </p>
                  <p className="tnum mt-1 font-mono text-[13px] font-medium text-fg">
                    {item.value}
                  </p>
                </Reveal>
              ))}
            </div>
            <p className="mt-3 text-[11.5px] leading-relaxed text-fg-faint">
              Mensagem de marketing tem custo por conversa cobrado pela Meta e
              exige modelo aprovado. O sistema bloqueia disparo sem opt-in.
            </p>
          </div>
        </Panel>

        <Panel className="xl:col-span-6">
          <PanelHeader eyebrow="Atendimento" title="Regras do agente" />
          <ul className="space-y-0.5 px-3 pb-4">
            {REGRAS.map((regra) => {
              const ligada = regras[regra.id];
              return (
                <Reveal
                  as="li"
                  key={regra.id}
                  className={cn(
                    "flex items-start gap-3 rounded-xl px-2 py-3",
                    !regra.travada && "cursor-pointer",
                  )}
                  onClick={() =>
                    !regra.travada &&
                    setRegras((r) => ({ ...r, [regra.id]: !r[regra.id] }))
                  }
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-[12.5px] font-medium text-fg">
                      {regra.title}
                      {regra.travada && (
                        <span className="chip !px-1.5 !py-0 !text-[9px]">fixa</span>
                      )}
                    </p>
                    <p className="mt-0.5 text-[11.5px] leading-relaxed text-fg-faint">
                      {regra.detail}
                    </p>
                  </div>
                  <Toggle on={ligada} />
                </Reveal>
              );
            })}
          </ul>
        </Panel>

        <Panel className="xl:col-span-7">
          <PanelHeader
            eyebrow="Rede"
            title="Unidades conectadas"
            action={
              <span className="chip">
                <Building2 className="h-3 w-3" strokeWidth={2} />
                {stores.length} lojas
              </span>
            }
          />
          <ul className="px-3 pb-4">
            {stores.map((store) => (
              <Reveal
                as="li"
                key={store.id}
                className="flex items-center gap-3 rounded-xl px-2 py-2.5"
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full",
                    store.status === "online" &&
                      "bg-positive shadow-[0_0_6px_1px_rgba(24,209,127,0.7)]",
                    store.status === "atencao" && "bg-caution",
                    store.status === "offline" && "bg-fg-ghost",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium text-fg">
                    {store.name}
                  </p>
                  <p className="truncate text-[11px] text-fg-ghost">{store.city}</p>
                </div>
                <span
                  className={cn(
                    "chip",
                    store.status === "online" && "chip-good",
                    store.status === "atencao" && "chip-warn",
                  )}
                >
                  {storeStatusLabel[store.status]}
                </span>
              </Reveal>
            ))}
          </ul>
        </Panel>

        <div className="flex flex-col gap-4 xl:col-span-5">
          <Panel>
            <PanelHeader
              eyebrow="Acesso"
              title="Equipe"
              action={
                <span className="chip">
                  <Users className="h-3 w-3" strokeWidth={2} />4 pessoas
                </span>
              }
            />
            <ul className="px-3 pb-4">
              {[
                { name: "Mateus Zumach", role: "Administrador", initials: "MZ" },
                {
                  name: "Dra. Renata Lopes",
                  role: "Farmacêutica responsável",
                  initials: "RL",
                },
                { name: "Paula Martins", role: "Atendimento", initials: "PM" },
                { name: "Diego Alves", role: "Gerência", initials: "DA" },
              ].map((person) => (
                <Reveal
                  as="li"
                  key={person.name}
                  className="flex items-center gap-3 rounded-xl px-2 py-2.5"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-surface-3 to-surface text-[10.5px] font-semibold text-fg-muted ring-1 ring-inset ring-white/10">
                    {person.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-fg">
                      {person.name}
                    </p>
                    <p className="truncate text-[11px] text-fg-ghost">{person.role}</p>
                  </div>
                </Reveal>
              ))}
            </ul>
          </Panel>

          <Panel className="flex-1">
            <PanelHeader eyebrow="Conformidade" title="LGPD" />
            <div className="px-5 pb-5">
              <Reveal className="tile flex items-start gap-2.5 p-3">
                <ShieldCheck
                  className="mt-0.5 h-4 w-4 shrink-0 text-positive"
                  strokeWidth={2}
                />
                <p className="text-[11.5px] leading-relaxed text-fg-faint">
                  Consentimento registrado com data, canal e origem. Dado de saúde
                  é tratado como sensível e fica fora de disparo automático.
                </p>
              </Reveal>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="btn-ghost !text-[12px]">
                  <KeyRound className="h-3.5 w-3.5" strokeWidth={2} />
                  Chaves de API
                </button>
                <button className="btn-ghost !text-[12px]">Política de privacidade</button>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
