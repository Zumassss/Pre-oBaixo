"use client";

import { MobileNav, Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { SmoothScroll } from "@/components/shell/smooth-scroll";
import { Avisos, Vigia } from "@/components/shell/vigia";
import {
  AppStateProvider,
  useAppState,
} from "@/components/providers/app-state";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { useSessao } from "@/lib/db/use-db";
import { cn } from "@/lib/utils";

/**
 * Camadas de luz por trás de toda a interface.
 *
 * A força da aura e da vinheta vem de ficha, não de número solto: no tema
 * claro elas quase somem, senão a tela inteira fica com cara de tingida de
 * rosa em vez de branca.
 */
function Backdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-void">
      <div
        className="absolute -top-[340px] left-1/2 h-[760px] w-[1100px] -translate-x-1/2 aura-brand"
        style={{ opacity: "var(--aura-opacidade)" }}
      />
      <div
        className="absolute -bottom-[280px] right-[6%] h-[520px] w-[520px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--color-brand-800) 55%, transparent), transparent 70%)",
          opacity: "var(--aura-opacidade)",
        }}
      />
      <div
        className="absolute inset-0 grid-mesh opacity-60"
        style={{
          maskImage:
            "radial-gradient(ellipse 90% 62% at 50% 0%, #000 20%, transparent 78%)",
        }}
      />
      <div className="absolute inset-0 vinheta" />
    </div>
  );
}

/**
 * Faixa enquanto a senha do acesso for fácil de adivinhar. O endereço do
 * sistema é público: senha curta é a porta mais fácil para os dados dos
 * clientes da farmácia.
 */
function AvisoSenha() {
  const { usuario } = useSessao();
  if (!usuario?.senhaFraca) return null;
  return (
    <div role="alert" className="mx-4 mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-caution/40 bg-caution/10 px-3.5 py-2.5 sm:mx-6">
      <ShieldAlert className="h-4 w-4 shrink-0 text-caution" strokeWidth={2} />
      <p className="min-w-0 flex-1 text-[12.5px] leading-snug text-fg">
        A senha deste acesso é fácil de adivinhar. Troque antes de usar com cliente de verdade.
      </p>
      <Link href="/configuracoes?aba=geral#senha" className="btn-ghost !px-3 !py-1 !text-[12px]">
        Trocar senha
      </Link>
    </div>
  );
}

/** O conteúdo acompanha a largura da barra lateral. */
function Conteudo({ children }: { children: React.ReactNode }) {
  const { barraRecolhida } = useAppState();

  return (
    <div
      className={cn(
        "transition-[padding] duration-300",
        barraRecolhida ? "lg:pl-[72px]" : "lg:pl-[248px]",
      )}
    >
      <Topbar />
      <AvisoSenha />
      <main className="px-4 pb-24 pt-5 sm:px-6 lg:pb-10">{children}</main>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AppStateProvider>
      <SmoothScroll />
      <Backdrop />
      <Sidebar />
      <Conteudo>{children}</Conteudo>
      <MobileNav />
      <Vigia />
      <Avisos />
    </AppStateProvider>
  );
}
