import {
  Activity,
  BrainCircuit,
  ChartNoAxesCombined,
  MessagesSquare,
  Megaphone,
  ClipboardList,
  Package,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Nome curto para a barra recolhida e a navegação do celular. */
  curto: string;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
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
    ],
  },
];

export const pageMeta: Record<string, { title: string; parent: string }> = {
  "/": { title: "Painel", parent: "Operação" },
  "/conversas": { title: "Conversas", parent: "Operação" },
  "/pedidos": { title: "Pedidos", parent: "Operação" },
  "/campanhas": { title: "Campanhas", parent: "Operação" },
  "/clientes": { title: "Clientes", parent: "Cadastros" },
  "/catalogo": { title: "Catálogo", parent: "Cadastros" },
  "/agente": { title: "Agente", parent: "Inteligência" },
  "/relatorios": { title: "Relatórios", parent: "Inteligência" },
  "/configuracoes": { title: "Configurações", parent: "Sistema" },
};
