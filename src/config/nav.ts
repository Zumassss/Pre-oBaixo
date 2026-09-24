import {
  Activity,
  BrainCircuit,
  Building2,
  ChartNoAxesCombined,
  LifeBuoy,
  MessagesSquare,
  Megaphone,
  ClipboardList,
  Package,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Papel } from "@/lib/db/types";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Nome curto para a barra recolhida e a navegação do celular. */
  curto: string;
  /** Quando presente, só estes papéis veem o item. */
  papeis?: Papel[];
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

const GRUPOS: NavGroup[] = [
  {
    label: "Rede",
    items: [
      {
        href: "/rede",
        label: "Visão da rede",
        icon: Building2,
        curto: "Rede",
        papeis: ["admin"],
      },
    ],
  },
  {
    label: "Operação",
    items: [
      { href: "/", label: "Painel", icon: Activity, curto: "Painel" },
      {
        href: "/conversas",
        label: "Conversas",
        icon: MessagesSquare,
        curto: "Conversas",
      },
      {
        href: "/pedidos",
        label: "Pedidos",
        icon: ClipboardList,
        curto: "Pedidos",
      },
      {
        href: "/campanhas",
        label: "Campanhas",
        icon: Megaphone,
        curto: "Campanhas",
      },
    ],
  },
  {
    label: "Cadastros",
    items: [
      { href: "/clientes", label: "Clientes", icon: Users, curto: "Clientes" },
      { href: "/catalogo", label: "Catálogo", icon: Package, curto: "Catálogo" },
    ],
  },
  {
    label: "Inteligência",
    items: [
      { href: "/agente", label: "Agente", icon: BrainCircuit, curto: "Agente" },
      {
        href: "/relatorios",
        label: "Relatórios",
        icon: ChartNoAxesCombined,
        curto: "Relatórios",
      },
    ],
  },
  {
    label: "Sistema",
    items: [
      {
        href: "/configuracoes",
        label: "Configurações",
        icon: Settings,
        curto: "Ajustes",
      },
      {
        href: "/ajuda",
        label: "Como usar",
        icon: LifeBuoy,
        curto: "Ajuda",
      },
    ],
  },
];

/**
 * O menu de quem está logado.
 *
 * O administrador vê tudo; quem opera uma loja não vê sequer a existência da
 * visão de rede. Esconder não é segurança, e sim clareza: a segurança de
 * verdade está na camada de dados, que só entrega a loja da sessão.
 */
export function menuDoPapel(papel: Papel | null): NavGroup[] {
  if (!papel) return [];
  return GRUPOS.map((grupo) => ({
    ...grupo,
    items: grupo.items.filter((i) => !i.papeis || i.papeis.includes(papel)),
  })).filter((grupo) => grupo.items.length > 0);
}

export const pageMeta: Record<string, { title: string; parent: string }> = {
  "/": { title: "Painel", parent: "Operação" },
  "/rede": { title: "Visão da rede", parent: "Rede" },
  "/ajuda": { title: "Como usar", parent: "Sistema" },
  "/conversas": { title: "Conversas", parent: "Operação" },
  "/pedidos": { title: "Pedidos", parent: "Operação" },
  "/campanhas": { title: "Campanhas", parent: "Operação" },
  "/clientes": { title: "Clientes", parent: "Cadastros" },
  "/catalogo": { title: "Catálogo", parent: "Cadastros" },
  "/agente": { title: "Agente", parent: "Inteligência" },
  "/relatorios": { title: "Relatórios", parent: "Inteligência" },
  "/configuracoes": { title: "Configurações", parent: "Sistema" },
};
