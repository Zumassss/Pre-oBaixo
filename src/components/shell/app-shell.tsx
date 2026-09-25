"use client";

import { MobileNav, Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { SmoothScroll } from "@/components/shell/smooth-scroll";
import {
  AppStateProvider,
  useAppState,
} from "@/components/providers/app-state";
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
    </AppStateProvider>
  );
}
