/**
 * Unidades da rede.
 *
 * `lat`/`lon` posicionam cada unidade na esfera de partículas da Central de
 * Operações. Quando a integração com o cadastro real da rede existir, basta
 * substituir esta lista pela resposta da API mantendo o mesmo formato.
 */
export type Store = {
  id: string;
  name: string;
  city: string;
  lat: number;
  lon: number;
  status: "online" | "atencao" | "offline";
  conversas: number;
  pedidos: number;
};

export const stores: Store[] = [
  {
    id: "pb-01",
    name: "Matriz Centro",
    city: "Centro",
    lat: -12.4,
    lon: -38.3,
    status: "online",
    conversas: 128,
    pedidos: 41,
  },
  {
    id: "pb-02",
    name: "Filial Boa Vista",
    city: "Boa Vista",
    lat: 4.2,
    lon: -60.8,
    status: "online",
    conversas: 96,
    pedidos: 33,
  },
  {
    id: "pb-03",
    name: "Filial Jardim América",
    city: "Jardim América",
    lat: -23.5,
    lon: -46.6,
    status: "online",
    conversas: 154,
    pedidos: 58,
  },
  {
    id: "pb-04",
    name: "Filial Santa Rita",
    city: "Santa Rita",
    lat: -7.1,
    lon: -34.9,
    status: "atencao",
    conversas: 62,
    pedidos: 12,
  },
  {
    id: "pb-05",
    name: "Filial Nova Esperança",
    city: "Nova Esperança",
    lat: -15.8,
    lon: -47.9,
    status: "online",
    conversas: 111,
    pedidos: 39,
  },
  {
    id: "pb-06",
    name: "Filial Parque Industrial",
    city: "Parque Industrial",
    lat: -25.4,
    lon: -49.3,
    status: "online",
    conversas: 87,
    pedidos: 26,
  },
  {
    id: "pb-07",
    name: "Filial Vila Nova",
    city: "Vila Nova",
    lat: -3.7,
    lon: -38.5,
    status: "online",
    conversas: 73,
    pedidos: 21,
  },
  {
    id: "pb-08",
    name: "Filial Alto da Serra",
    city: "Alto da Serra",
    lat: -30.0,
    lon: -51.2,
    status: "offline",
    conversas: 0,
    pedidos: 0,
  },
];

/** Rótulo legível — o valor cru é um código, não texto de interface. */
export const storeStatusLabel: Record<Store["status"], string> = {
  online: "online",
  atencao: "atenção",
  offline: "offline",
};

export const storeSummary = {
  total: stores.length,
  online: stores.filter((s) => s.status === "online").length,
  atencao: stores.filter((s) => s.status === "atencao").length,
  offline: stores.filter((s) => s.status === "offline").length,
};
