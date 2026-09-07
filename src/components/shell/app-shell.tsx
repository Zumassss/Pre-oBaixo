import { MobileNav, Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";

/** Camadas de luz e textura por trás de toda a interface. */
function Backdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-void">
      {/* Aura principal — o vermelho que dá vida ao preto */}
      <div className="absolute -top-[380px] left-1/2 h-[820px] w-[1180px] -translate-x-1/2 aura-brand opacity-[0.30] blur-[90px]" />
      {/* Aura secundária, fria e distante, para dar profundidade */}
      <div className="absolute -bottom-[300px] right-[6%] h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle,rgba(120,20,60,0.30),transparent_70%)] blur-[90px]" />
      {/* Malha técnica, esmaecida do centro para as bordas */}
      <div
        className="absolute inset-0 grid-mesh opacity-[0.55]"
        style={{
          maskImage:
            "radial-gradient(ellipse 90% 65% at 50% 0%, #000 20%, transparent 78%)",
        }}
      />
      {/* Vinheta */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(0,0,0,0.75)_100%)]" />
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Backdrop />
      <Sidebar />
      <div className="lg:pl-[264px]">
        <Topbar />
        <main className="px-4 pb-24 pt-5 sm:px-6 lg:pb-10">{children}</main>
      </div>
      <MobileNav />
    </>
  );
}
