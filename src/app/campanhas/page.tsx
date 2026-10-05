"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarClock, Copy, ImageIcon, Megaphone, Plus, ShieldCheck, Trash2, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/panel";
import { Reveal } from "@/components/ui/reveal";
import { EditorCampanha } from "@/components/campanhas/editor";
import { TextoWhatsapp } from "@/components/campanhas/previa-whatsapp";
import { agendamentoNoPassado, deIso } from "@/components/ui/calendario";
import { criarCampanha, removerCampanha, useBanco } from "@/lib/db/use-db";
import type { Campanha } from "@/lib/db/types";
import { indexarClientes } from "@/lib/clientes";
import { alcanceDaCampanha } from "@/lib/campanhas";
import { useMidiaUrl } from "@/lib/midia";
import { cn } from "@/lib/utils";

export default function CampanhasPage() {
  return (
    <Suspense fallback={null}>
      <Campanhas />
    </Suspense>
  );
}

function quando(valor: string) {
  if (!valor) return "";
  const [d, h] = valor.split("T");
  return `${deIso(d).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })} às ${h}`;
}

function Campanhas() {
  const params = useSearchParams();
  const router = useRouter();
  const { banco, carregado } = useBanco();
  const aberta = params.get("c");

  const indice = useMemo(
    () => indexarClientes(banco.clientes, banco.conversas, banco.pedidos),
    [banco.clientes, banco.conversas, banco.pedidos],
  );

  if (aberta) {
    const campanha = aberta === "nova" ? null : (banco.campanhas.find((c) => c.id === aberta) ?? null);
    if (aberta !== "nova" && !campanha) {
      return carregado ? (
        <div className="mx-auto max-w-[640px] py-16 text-center">
          <p className="text-[15px] font-semibold text-fg">Essa campanha não existe mais.</p>
          <Link href="/campanhas" className="btn-ghost mt-4 inline-flex">
            Voltar para as campanhas
          </Link>
        </div>
      ) : null;
    }
    return (
      <EditorCampanha
        key={campanha?.id ?? "nova"}
        campanha={campanha}
        onSalva={(id) => {
          if (aberta !== id) router.replace(`/campanhas?c=${id}`, { scroll: false });
        }}
      />
    );
  }

  const autorizaram = banco.clientes.filter((c) => c.consentimento).length;
  const agendadas = banco.campanhas.filter((c) => c.status === "agendada" && !agendamentoNoPassado(c.agendadaPara)).length;
  const ordenadas = [...banco.campanhas].sort((a, b) => b.criadoEm - a.criadoEm);

  return (
    <div className="mx-auto max-w-[1560px]">
      <PageHeader
        title="Campanhas"
        description="Mensagens para os clientes que autorizaram contato. Monte, veja como chega no celular e teste no seu WhatsApp."
        action={
          <Link href="/campanhas?c=nova" className="btn-primary">
            <Plus className="h-4 w-4" strokeWidth={2.4} />
            Nova campanha
          </Link>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: "Campanhas", valor: banco.campanhas.length, hint: "rascunhos e agendadas" },
          { label: "Clientes que autorizaram", valor: autorizaram, hint: "podem receber campanha" },
          { label: "Agendadas", valor: agendadas, hint: "com dia marcado à frente" },
        ].map((stat, i) => (
          <Reveal
            key={stat.label}
            className="tile p-4"
            style={{ animation: `rise 0.5s cubic-bezier(0.16,1,0.3,1) ${i * 60}ms both` }}
          >
            <p className="text-[12px] text-fg-muted">{stat.label}</p>
            <p className="tnum mt-2 text-[23px] font-semibold leading-none tracking-[-0.03em] text-fg">{carregado ? stat.valor : 0}</p>
            <p className="mt-1.5 text-[11px] text-fg-ghost">{stat.hint}</p>
          </Reveal>
        ))}
      </div>

      <div className="tile mb-5 flex items-start gap-2.5 p-3.5">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-info" strokeWidth={2} />
        <p className="text-[12.5px] leading-relaxed text-fg-muted">
          Hoje dá para montar, agendar e mandar o teste para quem já escreveu para a loja. O disparo para a lista inteira entra
          com o número oficial do WhatsApp: pelo número de teste, mensagem em massa faz o chip ser banido.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        <Link
          href="/campanhas?c=nova"
          className="group flex min-h-[300px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-hairline-strong p-6 text-center transition-colors hover:border-brand-500/50 hover:bg-brand-500/[0.04]"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500/12 text-brand-400 ring-1 ring-inset ring-brand-500/25 transition-transform group-hover:scale-105">
            <Megaphone className="h-5 w-5" strokeWidth={2} />
          </span>
          <span className="text-[14px] font-semibold text-fg">Nova campanha</span>
          <span className="max-w-[240px] text-[12px] leading-relaxed text-fg-faint">
            Escreva você ou peça três versões para a IA a partir de uma ideia.
          </span>
        </Link>

        {ordenadas.map((c, i) => (
          <CartaoCampanha
            key={c.id}
            campanha={c}
            indice={i}
            alcance={alcanceDaCampanha(c.publico, banco.clientes, indice).clientes.length}
          />
        ))}
      </div>
    </div>
  );
}

function CartaoCampanha({ campanha: c, indice, alcance }: { campanha: Campanha; indice: number; alcance: number }) {
  const passou = c.status === "agendada" && agendamentoNoPassado(c.agendadaPara);
  const chip =
    c.status === "enviada"
      ? { texto: "Enviada", classe: "chip-good" }
      : passou
        ? { texto: "Data passou", classe: "chip-warn" }
        : c.status === "agendada"
          ? { texto: "Agendada", classe: "chip-hot" }
          : { texto: "Rascunho", classe: "" };

  return (
    <article
      className="group relative flex min-h-[300px] flex-col overflow-hidden rounded-2xl border border-hairline bg-nivel-1 transition-colors hover:border-hairline-strong"
      style={{ animation: `rise 0.45s cubic-bezier(0.16,1,0.3,1) ${Math.min(indice, 8) * 50}ms both` }}
    >
      {/* Miniatura da conversa */}
      <div
        className="relative h-[176px] overflow-hidden px-3 pt-3"
        style={{
          backgroundColor: "var(--wa-fundo)",
          backgroundImage:
            "radial-gradient(var(--wa-desenho) 1.2px, transparent 1.4px), radial-gradient(var(--wa-desenho) 1.2px, transparent 1.4px)",
          backgroundSize: "22px 22px",
          backgroundPosition: "0 0, 11px 11px",
        }}
      >
        <div className="max-w-[92%] rounded-lg rounded-tl-none bg-[var(--wa-bolha)] p-1.5 text-[12px] leading-[1.38] text-[var(--wa-texto)] shadow-[0_1px_0.5px_rgba(0,0,0,0.13)]">
          {c.imagem && <Miniatura caminho={c.imagem.caminho} />}
          <p className="line-clamp-4 whitespace-pre-wrap break-words px-1">
            <TextoWhatsapp texto={c.mensagem.replaceAll("{nome}", "Maria")} />
          </p>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[var(--wa-fundo)] to-transparent" />
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="mb-1.5 flex items-start justify-between gap-2">
          <h2 className="line-clamp-2 text-[14px] font-semibold leading-snug text-fg">
            <Link href={`/campanhas?c=${c.id}`} className="after:absolute after:inset-0">
              {c.nome}
            </Link>
          </h2>
          <span className={cn("chip shrink-0", chip.classe)}>{chip.texto}</span>
        </div>
        <div className="mt-auto space-y-1 text-[11.5px] text-fg-faint">
          <p className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" strokeWidth={2} />
            Para {alcance} {alcance === 1 ? "cliente" : "clientes"}
          </p>
          <p className="flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5" strokeWidth={2} />
            {c.agendadaPara ? quando(c.agendadaPara) : "Sem dia marcado"}
          </p>
        </div>
        <div className="relative z-10 mt-3 flex gap-1 border-t border-hairline pt-3">
          <button
            type="button"
            onClick={() =>
              criarCampanha({
                nome: `${c.nome} (cópia)`,
                mensagem: c.mensagem,
                imagem: c.imagem,
                publico: c.publico,
                status: "rascunho",
                agendadaPara: "",
              })
            }
            className="btn-ghost !px-2.5 !py-1 !text-[11.5px]"
          >
            <Copy className="h-3 w-3" strokeWidth={2.2} />
            Duplicar
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Apagar a campanha "${c.nome}"?`)) removerCampanha(c.id);
            }}
            aria-label={`Apagar ${c.nome}`}
            className="ml-auto rounded-lg p-1.5 text-fg-ghost transition-colors hover:bg-nivel-3 hover:text-negative"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
      </div>
    </article>
  );
}

function Miniatura({ caminho }: { caminho: string }) {
  const { url } = useMidiaUrl(caminho);
  return (
    <div className="mb-1 flex h-[70px] items-center justify-center overflow-hidden rounded-md bg-black/10">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <ImageIcon className="h-4 w-4 text-[var(--wa-meta)]" strokeWidth={1.6} />
      )}
    </div>
  );
}
