"use client";

import { MobileNav, Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { SmoothScroll } from "@/components/shell/smooth-scroll";
import {
  AppStateProvider,
  useAppState,
} from "@/components/providers/app-state";
import { cn } from "@/lib/utils";

/** Camadas de luz por trás de toda a interface. */
function Backdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-void">
      <div className="absolute -top-[340px] left-1/2 h-[760px] w-[1100px] -translate-x-1/2 aura-brand opacity-[0.3]" />
      <div className="absolute -bottom-[280px] right-[6%] h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(120,20,60,0.2),transparent_70%)]" />
      <div
        className="absolute inset-0 grid-mesh opacity-60"
        style={{
          maskImage:
            "radial-gradient(ellipse 90% 62% at 50% 0%, #000 20%, transparent 78%)",
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_38%,rgba(0,0,0,0.72)_100%)]" />
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
