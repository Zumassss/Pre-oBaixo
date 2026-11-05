"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  Check,
  ChevronsUpDown,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  ShieldCheck,
  Store,
  X,
} from "lucide-react";
import { LogoFull, LogoMark } from "@/components/brand/logo";
import { menuDoPapel, type NavItem } from "@/config/nav";
import { useAppState } from "@/components/providers/app-state";
import { sair, selecionarLoja, useSessao } from "@/lib/db/use-db";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();
  const { barraRecolhida, alternarBarra } = useAppState();
  const { usuario, loja, rede } = useSessao();

  const grupos = menuDoPapel(usuario?.papel ?? null);
  const ehAdmin = usuario?.papel === "admin";

  const nomeLoja = loja?.nome || "Loja não configurada";
  const localLoja = loja?.configurada
    ? [loja.bairro, loja.cidade].filter(Boolean).join(", ")
    : "Preencha em Configurações";

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-hairline bg-ink transition-[width] duration-300 lg:flex",
        barraRecolhida ? "w-[72px]" : "w-[248px]",
      )}
    >
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
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-fg-ghost transition-colors hover:bg-nivel-3 hover:text-fg-muted",
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

      {/* Unidade em operação */}
      <div className={cn("px-3 pb-4", barraRecolhida && "px-2")}>
        {ehAdmin ? (
          <SeletorDeLoja
            lojas={rede.lojas}
            atualId={loja?.id ?? ""}
            recolhida={barraRecolhida}
          />
        ) : (
          <div
            className={cn(
              "tile flex items-center gap-2.5 p-2.5",
              barraRecolhida && "justify-center p-2",
            )}
            title={barraRecolhida ? nomeLoja : undefined}
          >
            <MarcaDaLoja configurada={Boolean(loja?.configurada)} />
            {!barraRecolhida && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-semibold text-fg">
                  {nomeLoja}
                </p>
                <p className="truncate text-[10.5px] text-fg-ghost">
                  {localLoja}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <nav
        data-lenis-prevent
        className={cn(
          "flex-1 overflow-y-auto px-3 pb-4",
          barraRecolhida && "px-2",
        )}
      >
        {grupos.map((group) => (
            <div key={group.label} className="mb-4">
              {!barraRecolhida && <p className="eyebrow px-3 pb-2">{group.label}</p>}
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <ItemDoMenu item={item} pathname={pathname} recolhida={barraRecolhida} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
      </nav>

      <div className="border-t border-hairline p-3">
        <div
          className={cn(
            "flex items-center gap-3 rounded-xl px-2 py-2",
            barraRecolhida && "justify-center px-0",
          )}
        >
          <div className="relative shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-nivel-4 text-[12px] font-semibold text-fg ring-1 ring-inset ring-anel">
              {iniciais(usuario?.nome ?? "")}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-ink bg-positive" />
          </div>
          {!barraRecolhida && (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-fg">
                  {usuario?.nome ?? ""}
                </p>
                <p className="truncate text-[11px] text-fg-faint">
                  {ehAdmin ? "Administrador da rede" : "Operação da loja"}
                </p>
              </div>
              <button
                onClick={sair}
                aria-label="Sair do sistema"
                title="Sair do sistema"
                className="shrink-0 rounded-lg p-1.5 text-fg-ghost transition-colors hover:bg-nivel-3 hover:text-negative"
              >
                <LogOut className="h-4 w-4" strokeWidth={1.8} />
              </button>
            </>
          )}
        </div>
        {barraRecolhida && (
          <button
            onClick={sair}
            aria-label="Sair do sistema"
            title="Sair do sistema"
            className="mt-1 flex w-full justify-center rounded-lg p-1.5 text-fg-ghost transition-colors hover:bg-nivel-3 hover:text-negative"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.8} />
          </button>
        )}
      </div>
    </aside>
  );
}

function MarcaDaLoja({ configurada }: { configurada: boolean }) {
  return (
    <span
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
        configurada
          ? "bg-nivel-4 text-fg-muted ring-1 ring-inset ring-anel"
          : "bg-nivel-3 text-fg-ghost ring-1 ring-inset ring-anel",
      )}
    >
      <Store className="h-3.5 w-3.5" strokeWidth={2} />
    </span>
  );
}

/**
 * A troca de loja do administrador.
 *
 * Trocar aqui muda o que TODA a operação mostra: painel, pedidos, catálogo,
 * conversas. É por isso que o seletor fica no lugar onde a loja aparece, e
 * não escondido em configurações: ele responde "de qual loja é o que estou
 * vendo", que é a pergunta mais fácil de errar num sistema de rede.
 */
function SeletorDeLoja({
  lojas,
  atualId,
  recolhida,
}: {
  lojas: { id: string; nome: string; ativa: boolean; configurada: boolean }[];
  atualId: string;
  recolhida: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const atual = lojas.find((l) => l.id === atualId);

  if (recolhida) {
    return (
      <div
        className="tile flex justify-center p-2"
        title={atual?.nome ?? "Nenhuma loja"}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-nivel-4 text-fg-muted ring-1 ring-inset ring-anel">
          <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
        </span>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setAberto((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        className="tile flex w-full items-center gap-2.5 p-2.5 text-left transition-colors hover:bg-nivel-3"
      >
        <MarcaDaLoja configurada={Boolean(atual?.configurada)} />
        <div className="min-w-0 flex-1">
          <p className="eyebrow !text-[9px]">Operando</p>
          <p className="truncate text-[12px] font-semibold text-fg">
            {atual?.nome ?? "Nenhuma loja"}
          </p>
        </div>
        <ChevronsUpDown
          className="h-3.5 w-3.5 shrink-0 text-fg-ghost"
          strokeWidth={2}
        />
      </button>

      {aberto && (
        <>
          <button
            aria-label="Fechar"
            onClick={() => setAberto(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div
            role="listbox"
            data-lenis-prevent
            className="glass-solid absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-[280px] overflow-y-auto rounded-xl p-1 sombra-flutuante"
            style={{ animation: "rise 0.18s cubic-bezier(0.16,1,0.3,1) both" }}
          >
            {lojas.map((l) => (
              <button
                key={l.id}
                role="option"
                aria-selected={l.id === atualId}
                onClick={() => {
                  selecionarLoja(l.id);
                  setAberto(false);
                }}
                className={cn(
                  "selectable flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px]",
                  l.id === atualId ? "text-fg" : "text-fg-muted",
                )}
              >
                <span className="min-w-0 flex-1 truncate">{l.nome}</span>
                {!l.ativa && (
                  <span className="chip !px-1.5 !py-0 !text-[9px]">pausada</span>
                )}
                {l.id === atualId && (
                  <Check
                    className="h-3.5 w-3.5 shrink-0 text-fg"
                    strokeWidth={2.5}
                  />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function iniciais(nome: string) {
  return (
    nome
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "?"
  );
}

function itemAtivo(item: NavItem, pathname: string) {
  if (item.externo) return false;
  return pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`));
}

function ItemDoMenu({
  item,
  pathname,
  recolhida,
}: {
  item: NavItem;
  pathname: string;
  recolhida: boolean;
}) {
  const active = itemAtivo(item, pathname);
  const Icon = item.icon;
  const classe = cn(
    "selectable group flex items-center gap-3 overflow-hidden rounded-xl px-3 py-[7px] text-[13px] font-medium",
    recolhida && "justify-center px-0",
    active ? "text-fg" : "text-fg-muted hover:text-fg",
  );
  const conteudo = (
    <>
      <Icon
        className={cn(
          "h-[17px] w-[17px] shrink-0 transition-colors",
          active ? "text-fg" : "text-fg-faint group-hover:text-fg-muted",
        )}
        strokeWidth={1.8}
      />
      {!recolhida && <span className="flex-1 truncate">{item.label}</span>}
      {!recolhida && item.externo && (
        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-fg-ghost" strokeWidth={2} />
      )}
    </>
  );

  if (item.externo) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        title={recolhida ? item.label : undefined}
        className={classe}
      >
        {conteudo}
      </a>
    );
  }

  return (
    <Link
      href={item.href}
      data-selected={active}
      title={recolhida ? item.label : undefined}
      className={classe}
    >
      {conteudo}
    </Link>
  );
}

/**
 * Barra inferior para telas estreitas.
 *
 * Cabem quatro atalhos e o "Mais". Antes eram os cinco primeiros itens e
 * pronto: no celular não havia como chegar em Clientes, Catálogo ou
 * Configurações.
 */
export function MobileNav() {
  const pathname = usePathname();
  const { usuario } = useSessao();
  const [aberto, setAberto] = useState(false);
  const grupos = menuDoPapel(usuario?.papel ?? null);
  const todos = grupos.flatMap((g) => g.items);
  const atalhos = ["/", "/conversas", "/pedidos", "/clientes"]
    .map((href) => todos.find((i) => i.href === href))
    .filter((i): i is NavItem => Boolean(i));
  const maisAtivo = !atalhos.some((i) => itemAtivo(i, pathname));

  return (
    <>
      {aberto && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Fechar menu"
            onClick={() => setAberto(false)}
            className="absolute inset-0 bg-veu"
          />
          <div
            data-lenis-prevent
            className="glass-solid absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto rounded-t-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
            style={{ animation: "rise 0.22s cubic-bezier(0.16,1,0.3,1) both" }}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[14px] font-semibold text-fg">Menu</p>
              <button
                onClick={() => setAberto(false)}
                aria-label="Fechar menu"
                className="rounded-lg p-2 text-fg-muted hover:bg-nivel-3"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
            {grupos.map((g) => (
              <div key={g.label} className="mb-3">
                <p className="eyebrow px-3 pb-1.5">{g.label}</p>
                <ul onClick={() => setAberto(false)}>
                  {g.items.map((item) => (
                    <li key={item.href}>
                      <ItemDoMenu item={item} pathname={pathname} recolhida={false} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
      <nav className="glass fixed inset-x-0 bottom-0 z-40 border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)] lg:hidden">
        <ul className="flex items-stretch justify-around px-2 py-1.5">
          {atalhos.map((item) => {
            const active = itemAtivo(item, pathname);
            const Icon = item.icon;
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[10px] font-medium transition-colors",
                    active ? "text-fg" : "text-fg-faint",
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                  <span className="truncate">{item.curto}</span>
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              onClick={() => setAberto(true)}
              className={cn(
                "flex w-full flex-col items-center gap-1 rounded-lg px-1 py-2 text-[10px] font-medium transition-colors",
                maisAtivo ? "text-fg" : "text-fg-faint",
              )}
            >
              <Menu className="h-[18px] w-[18px]" strokeWidth={1.8} />
              <span>Mais</span>
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}

/** Marca compacta usada na barra superior em telas estreitas. */
export function BrandCompact() {
  return (
    <div className="flex items-center text-brand-500 lg:hidden">
      <LogoFull className="w-[118px]" />
    </div>
  );
}
