import {
  Activity,
  BrainCircuit,
  ChartNoAxesCombined,
  MessagesSquare,
  Megaphone,
  Package,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
  accent?: boolean;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  {
    label: "Operação",
    items: [
      {
        href: "/",
        label: "Central de Operações",
        icon: Activity,
        accent: true,
      },
      {
        href: "/conversas",
        label: "Conversas",
        icon: MessagesSquare,
        badge: "14",
      },
      { href: "/campanhas", label: "Campanhas", icon: Megaphone },
    ],
  },
  {
    label: "Relacionamento",
    items: [
      { href: "/clientes", label: "Clientes", icon: Users },
      { href: "/catalogo", label: "Catálogo", icon: Package },
    ],
  },
  {
    label: "Inteligência",
    items: [
      {
        href: "/agente",
        label: "Cérebro do Agente",
        icon: BrainCircuit,
        badge: "IA",
      },
      { href: "/relatorios", label: "Relatórios", icon: ChartNoAxesCombined },
    ],
  },
  {
    label: "Sistema",
    items: [{ href: "/configuracoes", label: "Configurações", icon: Settings }],
  },
];

export const pageMeta: Record<string, { title: string; parent: string }> = {
  "/": { title: "Central de Operações", parent: "Operação" },
  "/conversas": { title: "Conversas", parent: "Operação" },
  "/campanhas": { title: "Campanhas", parent: "Operação" },
  "/clientes": { title: "Clientes", parent: "Relacionamento" },
  "/catalogo": { title: "Catálogo", parent: "Relacionamento" },
  "/agente": { title: "Cérebro do Agente", parent: "Inteligência" },
  "/relatorios": { title: "Relatórios", parent: "Inteligência" },
  "/configuracoes": { title: "Configurações", parent: "Sistema" },
};
