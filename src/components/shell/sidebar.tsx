"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, PanelLeftClose, PanelLeftOpen, Store } from "lucide-react";
import { LogoFull, LogoMark } from "@/components/brand/logo";
import { navGroups } from "@/config/nav";
import { useAppState } from "@/components/providers/app-state";
import { useBanco } from "@/lib/db/use-db";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();
  const { barraRecolhida, alternarBarra } = useAppState();
  const { banco } = useBanco();

  const nomeLoja = banco.loja.nome || "Loja não configurada";
  const localLoja = banco.loja.configurada
    ? [banco.loja.bairro, banco.loja.cidade].filter(Boolean).join(", ")
    : "Preencha em Configurações";

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-hairline bg-ink transition-[width] duration-300 lg:flex",
        barraRecolhida ? "w-[72px]" : "w-[248px]",
      )}
    >
      <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-brand-500/25 to-transparent" />

      {/* Marca e recolher */}
      <div
        className={cn(
          "flex items-center gap-2 px-4 pb-5 pt-5",
          barraRecolhida && "flex-col gap-3 px-0",
        )}
      >
        <Link
          href="/"
          className="block text-brand-500 transition-opacity hover:opacity-80"
        >
          {barraRecolhida ? (
            <LogoMark className="h-7" />
          ) : (
            <LogoFull className="w-[142px]" />
          )}
        </Link>
        <button
          onClick={alternarBarra}
          aria-label={barraRecolhida ? "Expandir menu" : "Recolher menu"}
          title={barraRecolhida ? "Expandir menu" : "Recolher menu"}
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-fg-ghost transition-colors hover:bg-white/[0.06] hover:text-fg-muted",
            !barraRecolhida && "ml-auto",
          )}
        >
          {barraRecolhida ? (
            <PanelLeftOpen className="h-[17px] w-[17px]" strokeWidth={1.8} />
          ) : (
            <PanelLeftClose className="h-[17px] w-[17px]" strokeWidth={1.8} />
          )}
        </button>
      </div>

      {/* Identidade da unidade */}
      <div className={cn("px-3 pb-4", barraRecolhida && "px-2")}>
        <div
          className={cn(
            "tile flex items-center gap-2.5 p-2.5",
            barraRecolhida && "justify-center p-2",
          )}
          title={barraRecolhida ? nomeLoja : undefined}
        >
          <span
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
              banco.loja.configurada
                ? "bg-brand-500/12 text-brand-400 ring-1 ring-inset ring-brand-500/25"
                : "bg-white/[0.05] text-fg-ghost ring-1 ring-inset ring-white/10",
            )}
          >
            <Store className="h-3.5 w-3.5" strokeWidth={2} />
          </span>
          {!barraRecolhida && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold text-fg">
                {nomeLoja}
              </p>
              <p className="truncate text-[10.5px] text-fg-ghost">{localLoja}</p>
            </div>
          )}
        </div>
      </div>

      <nav
        data-lenis-prevent
        className={cn("flex-1 overflow-y-auto px-3 pb-4", barraRecolhida && "px-2")}
      >
        {navGroups.map((group) => (
          <div key={group.label} className="mb-5">
            {!barraRecolhida && <p className="eyebrow px-3 pb-2">{group.label}</p>}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      data-selected={active}
                      title={barraRecolhida ? item.label : undefined}
                      className={cn(
                        "selectable group flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-[13px] font-medium",
                        barraRecolhida && "justify-center px-0",
                        active ? "text-fg" : "text-fg-muted hover:text-fg",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-[17px] w-[17px] shrink-0 transition-colors",
                          active
                            ? "text-brand-400"
                            : "text-fg-faint group-hover:text-fg-muted",
                        )}
                        strokeWidth={1.8}
                      />
                      {!barraRecolhida && (
                        <span className="flex-1 truncate">{item.label}</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-hairline p-3">
        <button
          className={cn(
            "selectable group flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left",
            barraRecolhida && "justify-center px-0",
          )}
          title={barraRecolhida ? "Mateus Zumach" : undefined}
        >
          <div className="relative shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-[12px] font-bold text-white">
              MZ
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-ink bg-positive" />
          </div>
          {!barraRecolhida && (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-fg">
                  Mateus Zumach
                </p>
                <p className="truncate text-[11px] text-fg-faint">Gerente da loja</p>
              </div>
              <LogOut
                className="h-4 w-4 shrink-0 text-fg-ghost transition-colors group-hover:text-fg-muted"
                strokeWidth={1.8}
              />
            </>
          )}
        </button>
      </div>
    </aside>
  );
}

/** Barra inferior para telas estreitas. */
export function MobileNav() {
  const pathname = usePathname();
  const items = navGroups.flatMap((g) => g.items).slice(0, 5);

  return (
    <nav className="glass fixed inset-x-0 bottom-0 z-40 border-x-0 border-b-0 lg:hidden">
      <ul className="flex items-stretch justify-around px-2 py-1.5">
        {items.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[10px] font-medium transition-colors",
                  active ? "text-brand-400" : "text-fg-faint",
                )}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                <span className="truncate">{item.curto}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Marca compacta usada na barra superior em telas estreitas. */
export function BrandCompact() {
  return (
    <div className="flex items-center gap-2 text-brand-500 lg:hidden">
      <LogoMark className="h-6" />
      <LogoFull className="w-[104px]" />
    </div>
  );
}
