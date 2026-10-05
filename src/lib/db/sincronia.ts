/**
 * Réplica local do banco na nuvem.
 *
 * O banco guarda um registro por item (cada cliente, pedido, conversa). As
 * telas, porém, foram escritas pensando num bloco por loja (`DadosLoja`), com
 * listas e campos únicos. Esta réplica faz a ponte nos dois sentidos:
 *
 *  - monta o bloco de cada loja a partir dos registros que chegaram;
 *  - quando uma mudança é aplicada no bloco, descobre quais registros mudaram
 *    e grava só esses, cada um com a versão que tinha.
 *
 * O site (`local-db.ts`) e o bot do WhatsApp usam esta mesma classe. Por isso
 * ela não conhece navegador nem Node: quem fala com a rede é o `IO` que cada
 * um passa. E por isso o import abaixo tem extensão: o bot roda este arquivo
 * direto no Node, que não completa extensão sozinho.
 */
import {
  type DadosLoja,
  dadosVazios,
  type Loja,
  normalizarAjustesAgente,
  normalizarCampanha,
  normalizarCliente,
  normalizarConversa,
  normalizarEnvio,
  normalizarProduto,
  PAGAMENTOS_VAZIO,
} from "./types.ts";

type Objeto = Record<string, unknown>;

/** Um registro como o banco manda: loja, coleção, id, dados, versão. */
export type Registro = {
  l: string;
  c: string;
  i: string;
  d: Objeto | null;
  v: number;
  /** Apagado. */
  x?: boolean;
};

/** Um item a gravar. `d` nulo apaga. `v` é a versão que a tela conhecia. */
export type Op = { l: string; c: string; i: string; d: Objeto | null; v: number };

export type RespostaCarga = {
  ok: boolean;
  erro?: string;
  seq?: number;
  registros?: Registro[];
  recarregar?: boolean;
};

export type RespostaGravacao = {
  ok: boolean;
  erro?: string;
  conflito?: boolean;
  atuais?: Registro[];
  ops?: { l: string; c: string; i: string; v: number }[];
};

export type IO = {
  carregar(): Promise<RespostaCarga>;
  mudancas(desde: number): Promise<RespostaCarga>;
  gravar(ops: Op[]): Promise<RespostaGravacao>;
};

/** O que a réplica entrega: as lojas visíveis e o bloco de cada uma. */
export type EstadoReplica = { lojas: Loja[]; dados: Record<string, DadosLoja> };

export type ResultadoGravacao = "ok" | "rede" | "sessao" | "protegido" | "conflito" | "erro";

/* ------------------------------------------------------------------
   Como cada coleção vira campo do bloco da loja
   ------------------------------------------------------------------ */

type CampoLista = "clientes" | "produtos" | "campanhas" | "conversas" | "pedidos" | "eventos" | "envios";

const LISTAS: Record<CampoLista, { normalizar: (d: Objeto) => Objeto; ordem: (d: Objeto) => number }> = {
  clientes: { normalizar: (d) => normalizarCliente(d), ordem: (d) => Number(d.criadoEm) || 0 },
  produtos: { normalizar: (d) => normalizarProduto(d), ordem: (d) => Number(d.criadoEm) || 0 },
  campanhas: { normalizar: (d) => normalizarCampanha(d), ordem: (d) => Number(d.criadoEm) || 0 },
  conversas: { normalizar: (d) => normalizarConversa(d), ordem: (d) => Number(d.atualizadaEm) || 0 },
  pedidos: { normalizar: (d) => d, ordem: (d) => Number(d.criadoEm) || 0 },
  eventos: { normalizar: (d) => d, ordem: (d) => Number(d.em) || 0 },
  envios: { normalizar: (d) => normalizarEnvio(d), ordem: (d) => Number(d.criadoEm) || 0 },
};

const CAMPOS_LISTA = Object.keys(LISTAS) as CampoLista[];

type CampoUnico = "pagamentos" | "agente" | "whatsapp" | "agenteLigado" | "contadores";

/** Campos únicos do bloco e o registro que guarda cada um. */
const UNICOS: { campo: CampoUnico; c: string; i: string; normalizar: (d: Objeto) => Objeto }[] = [
  { campo: "pagamentos", c: "ajustes", i: "pagamentos", normalizar: (d) => ({ ...PAGAMENTOS_VAZIO, ...d }) },
  { campo: "agente", c: "ajustes", i: "agente", normalizar: (d) => normalizarAjustesAgente(d) },
  {
    campo: "whatsapp",
    c: "estado",
    i: "whatsapp",
    normalizar: (d) => ({ conectado: false, vistoEm: 0, numero: "", ...d }),
  },
  {
    campo: "agenteLigado",
    c: "estado",
    i: "agente",
    normalizar: (d) => ({ ativo: true, alteradoPor: "", em: 0, ...d }),
  },
  { campo: "contadores", c: "estado", i: "contadores", normalizar: (d) => ({ pedido: 0, ...d }) },
];

function unicoDoRegistro(c: string, i: string) {
  return UNICOS.find((u) => u.c === c && u.i === i);
}

/** Deixa o registro com todos os campos que o código de hoje espera. */
export function normalizarRegistro(c: string, i: string, d: Objeto): Objeto {
  if (c in LISTAS) return LISTAS[c as CampoLista].normalizar(d);
  const unico = unicoDoRegistro(c, i);
  if (unico) return unico.normalizar(d);
  return d;
}

/**
 * Compara dois itens pelo conteúdo. É a segunda checagem: a primeira é a
 * referência, que resolve quase tudo de graça. Esta pega o caso de alguém
 * recriar um objeto igual (um `map` que devolve cópia), para não gravar à toa.
 */
function igual(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function chave(l: string, c: string, i: string) {
  return `${l}\u0001${c}\u0001${i}`;
}

/* ------------------------------------------------------------------
   A réplica
   ------------------------------------------------------------------ */

export class Replica {
  private linhas = new Map<string, Registro>();
  /** Registros de cada loja e coleção, para remontar só o que mudou. */
  private indice = new Map<string, Set<string>>();
  private sujas = new Map<string, Set<string>>();
  private lojasSujas = true;
  private estado: EstadoReplica = { lojas: [], dados: {} };

  /** Maior número de sequência já recebido. */
  cursor = 0;
  /** Mensagem do último erro de gravação que não foi de rede nem de sessão. */
  ultimoErro = "";

  // Sem "private io" no construtor: o Node roda este arquivo só removendo
  // os tipos, e essa forma curta do TypeScript não é só tipo.
  private io: IO;
  constructor(io: IO) {
    this.io = io;
  }

  /** Esquece tudo (saída do sistema). */
  limpar() {
    this.linhas.clear();
    this.indice.clear();
    this.sujas.clear();
    this.lojasSujas = true;
    this.estado = { lojas: [], dados: {} };
    this.cursor = 0;
  }

  /**
   * Recebe registros do banco. Ignora o que for mais velho do que já se tem:
   * uma resposta atrasada da rede não pode desfazer uma gravação mais nova.
   *
   * `jaNormalizado` é para as gravações da própria réplica: o objeto já está
   * completo, e guardar a mesma referência poupa a tela de redesenhar.
   */
  aplicar(registros: Registro[], jaNormalizado = false) {
    let mudou = false;
    for (const r of registros) {
      const k = chave(r.l, r.c, r.i);
      const atual = this.linhas.get(k);
      if (atual && atual.v >= r.v) continue;

      const d = r.x || !r.d ? null : jaNormalizado ? r.d : normalizarRegistro(r.c, r.i, r.d);
      this.linhas.set(k, { l: r.l, c: r.c, i: r.i, d, v: r.v });

      const grupo = `${r.l}\u0001${r.c}`;
      let conjunto = this.indice.get(grupo);
      if (!conjunto) this.indice.set(grupo, (conjunto = new Set()));
      conjunto.add(k);

      if (r.c === "loja") {
        this.lojasSujas = true;
      } else {
        let colecoes = this.sujas.get(r.l);
        if (!colecoes) this.sujas.set(r.l, (colecoes = new Set()));
        colecoes.add(r.c);
      }
      mudou = true;
    }
    return mudou;
  }

  /** A versão que a réplica conhece de um registro. Zero: não existe. */
  versao(l: string, c: string, i: string) {
    return this.linhas.get(chave(l, c, i))?.v ?? 0;
  }

  private registrosDe(l: string, c: string) {
    const saida: Objeto[] = [];
    for (const k of this.indice.get(`${l}\u0001${c}`) ?? []) {
      const r = this.linhas.get(k);
      if (r?.d) saida.push(r.d);
    }
    return saida;
  }

  /** O estado atual, remontando só as lojas e coleções que mudaram. */
  ler(): EstadoReplica {
    if (!this.lojasSujas && this.sujas.size === 0) return this.estado;

    let lojas = this.estado.lojas;
    if (this.lojasSujas) {
      lojas = [];
      for (const r of this.linhas.values()) {
        if (r.c === "loja" && r.d) lojas.push(r.d as unknown as Loja);
      }
      lojas.sort((a, b) => (a.criadaEm || 0) - (b.criadaEm || 0) || a.id.localeCompare(b.id));
    }

    // Só existe bloco para loja visível. O que não mudou continua sendo o
    // mesmo objeto, e a tela daquela loja nem redesenha.
    const dados: Record<string, DadosLoja> = {};
    for (const { id } of lojas) {
      const anterior = this.estado.dados[id];
      const colecoes = this.sujas.get(id);
      dados[id] = anterior && !colecoes ? anterior : this.montar(id, anterior, colecoes);
    }

    this.sujas.clear();
    this.lojasSujas = false;
    this.estado = { lojas, dados };
    return this.estado;
  }

  private montar(l: string, anterior: DadosLoja | undefined, colecoes: Set<string> | undefined): DadosLoja {
    const tudo = !anterior || !colecoes;
    const d: DadosLoja = tudo ? dadosVazios() : { ...anterior };

    for (const campo of CAMPOS_LISTA) {
      if (!tudo && !colecoes!.has(campo)) continue;
      const { ordem } = LISTAS[campo];
      const itens = this.registrosDe(l, campo);
      itens.sort((a, b) => ordem(b) - ordem(a) || String(a.id).localeCompare(String(b.id)));
      (d as unknown as Record<string, unknown>)[campo] = itens;
    }

    for (const u of UNICOS) {
      if (!tudo && !colecoes!.has(u.c)) continue;
      const r = this.linhas.get(chave(l, u.c, u.i));
      (d as unknown as Record<string, unknown>)[u.campo] = r?.d ?? u.normalizar({});
    }

    d.whatsappConectado = Boolean(d.whatsapp?.conectado);
    return d;
  }

  /**
   * As mudanças entre dois estados, registro a registro.
   *
   * Compara primeiro pela referência (o que não foi tocado continua sendo o
   * mesmo objeto) e só depois pelo conteúdo. Item que sumiu de uma lista vira
   * um apagamento.
   */
  diferencas(antes: EstadoReplica, depois: EstadoReplica): Op[] {
    const ops: Op[] = [];
    const op = (l: string, c: string, i: string, d: Objeto | null) =>
      ops.push({ l, c, i, d, v: this.versao(l, c, i) });

    if (depois.lojas !== antes.lojas) {
      const velhas = new Map(antes.lojas.map((l) => [l.id, l]));
      for (const loja of depois.lojas) {
        const velha = velhas.get(loja.id);
        if (velha === loja || (velha && igual(velha, loja))) continue;
        op(loja.id, "loja", loja.id, loja as unknown as Objeto);
      }
    }

    for (const [id, novo] of Object.entries(depois.dados)) {
      const velho = antes.dados[id];
      if (novo === velho) continue;

      for (const campo of CAMPOS_LISTA) {
        const a = (velho?.[campo] ?? []) as unknown as Objeto[];
        const b = (novo[campo] ?? []) as unknown as Objeto[];
        if (a === b) continue;
        const porId = new Map(a.map((x) => [String(x.id), x]));
        const presentes = new Set<string>();
        for (const item of b) {
          const itemId = String(item.id);
          presentes.add(itemId);
          const anterior = porId.get(itemId);
          if (anterior === item || (anterior && igual(anterior, item))) continue;
          op(id, campo, itemId, item);
        }
        for (const anterior of a) {
          if (!presentes.has(String(anterior.id))) op(id, campo, String(anterior.id), null);
        }
      }

      for (const u of UNICOS) {
        const a = velho?.[u.campo];
        const b = novo[u.campo];
        if (a === b || igual(a, b)) continue;
        op(id, u.c, u.i, b as unknown as Objeto);
      }
    }
    return ops;
  }

  /** Carrega tudo de novo do zero. */
  async recarregar(): Promise<"ok" | "rede" | "sessao"> {
    const r = await this.io.carregar();
    if (!r.ok) return r.erro === "sessao" ? "sessao" : "rede";
    this.limpar();
    this.aplicar(r.registros ?? []);
    this.cursor = r.seq ?? 0;
    return "ok";
  }

  /** Pergunta ao banco o que mudou e aplica. Devolve se algo mudou. */
  async puxar(): Promise<{ resultado: "ok" | "rede" | "sessao"; mudou: boolean }> {
    const r = await this.io.mudancas(this.cursor);
    if (!r.ok) return { resultado: r.erro === "sessao" ? "sessao" : "rede", mudou: false };
    if (r.recarregar) {
      const resultado = await this.recarregar();
      return { resultado, mudou: resultado === "ok" };
    }
    const mudou = this.aplicar(r.registros ?? []);
    this.cursor = Math.max(this.cursor, r.seq ?? 0);
    return { resultado: "ok", mudou };
  }

  /**
   * Aplica uma mudança e grava no banco.
   *
   * A mudança é uma FUNÇÃO do estado, não um valor pronto. Se alguém gravou
   * antes, o banco recusa e devolve o estado atual dos itens em conflito; a
   * réplica atualiza e roda a mesma função de novo. Por isso a função tem
   * que poder rodar mais de uma vez: ids e horários nascem fora dela.
   */
  async gravar(mudanca: (estado: EstadoReplica) => EstadoReplica): Promise<ResultadoGravacao> {
    for (let tentativa = 0; tentativa < 6; tentativa++) {
      const antes = this.ler();
      const depois = mudanca(antes);
      const ops = this.diferencas(antes, depois);
      if (ops.length === 0) return "ok";

      let conflito = false;
      for (let inicio = 0; inicio < ops.length; inicio += 250) {
        const lote = ops.slice(inicio, inicio + 250);
        const r = await this.io.gravar(lote);
        if (r.ok) {
          const versoes = new Map((r.ops ?? []).map((o) => [chave(o.l, o.c, o.i), o.v]));
          this.aplicar(
            lote.map((o) => ({
              ...o,
              x: o.d === null,
              v: versoes.get(chave(o.l, o.c, o.i)) ?? o.v + 1,
            })),
            true,
          );
          continue;
        }
        if (r.conflito) {
          this.aplicar(r.atuais ?? []);
          conflito = true;
          break;
        }
        if (r.erro === "sessao") return "sessao";
        if (r.erro === "protegido") return "protegido";
        if (r.erro === "rede" || r.erro?.startsWith("http")) return "rede";
        this.ultimoErro = r.erro ?? "Não foi possível salvar.";
        return "erro";
      }
      if (!conflito) return "ok";
    }
    return "conflito";
  }
}
