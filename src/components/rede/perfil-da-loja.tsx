"use client";

import { useState } from "react";
import { Bike, Check, Power } from "lucide-react";
import { Campo, Entrada } from "@/components/ui/modal";
import {
  alternarLojaAtiva,
  criarLojaNaRede,
  salvarLojaDaRede,
} from "@/lib/db/use-db";
import type { Loja } from "@/lib/db/types";
import { cn } from "@/lib/utils";

/**
 * O cadastro de uma unidade, editado pelo administrador.
 *
 * É a mesma informação que a loja edita nas configurações dela. A diferença é
 * o alcance: daqui dá para arrumar a unidade sem depender de alguém estar na
 * loja, que é o que faz a visão de rede valer a pena.
 *
 * Serve também para abrir uma unidade nova. Neste caso a loja só passa a
 * existir quando o formulário é enviado: desistir no meio não deixa uma loja
 * pela metade na rede.
 */
export function PerfilDaLoja({
  loja,
  temDados,
  criando = false,
  onPronto,
}: {
  loja: Loja;
  /** Se a loja já tem movimento, desativar tem consequência e precisa avisar. */
  temDados: boolean;
  criando?: boolean;
  onPronto: () => void;
}) {
  const [form, setForm] = useState<Loja>(loja);
  const [salvo, setSalvo] = useState(false);

  function alterar<C extends keyof Loja>(campo: C, valor: Loja[C]) {
    setForm((atual) => ({ ...atual, [campo]: valor }));
    setSalvo(false);
  }

  function salvar(e: React.FormEvent) {
    e.preventDefault();

    if (criando) {
      const criada = criarLojaNaRede(form.nome);
      if (!criada) return;
      salvarLojaDaRede(criada.id, form);
    } else {
      salvarLojaDaRede(loja.id, form);
    }

    setSalvo(true);
    setTimeout(onPronto, 700);
  }

  return (
    <form onSubmit={salvar} className="space-y-4">
      <Campo label="Nome da loja">
        <Entrada
          value={form.nome}
          onChange={(e) => alterar("nome", e.target.value)}
          placeholder="Ex: Preço Baixo Vila Velha"
          required
          autoFocus
        />
      </Campo>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Campo label="Endereço" className="sm:col-span-2">
          <Entrada
            value={form.endereco}
            onChange={(e) => alterar("endereco", e.target.value)}
            placeholder="Ex: Rua Jair de Andrade, 120"
            required
          />
        </Campo>
        <Campo label="Bairro">
          <Entrada
            value={form.bairro}
            onChange={(e) => alterar("bairro", e.target.value)}
            placeholder="Ex: Centro"
          />
        </Campo>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Campo label="Cidade" className="sm:col-span-2">
          <Entrada
            value={form.cidade}
            onChange={(e) => alterar("cidade", e.target.value)}
            placeholder="Ex: Vila Velha"
            required
          />
        </Campo>
        <Campo label="UF">
          <Entrada
            value={form.uf}
            onChange={(e) => alterar("uf", e.target.value.toUpperCase())}
            placeholder="ES"
            maxLength={2}
          />
        </Campo>
        <Campo label="Telefone">
          <Entrada
            value={form.telefone}
            onChange={(e) => alterar("telefone", e.target.value)}
            placeholder="27 3000-0000"
          />
        </Campo>
      </div>

      <Campo
        label="Horário de funcionamento"
        hint="O agente responde exatamente o que estiver escrito aqui."
      >
        <Entrada
          value={form.horarios}
          onChange={(e) => alterar("horarios", e.target.value)}
          placeholder="Ex: Segunda a sábado das 8h às 22h"
        />
      </Campo>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Campo label="Farmacêutico responsável" className="sm:col-span-2">
          <Entrada
            value={form.farmaceutico}
            onChange={(e) => alterar("farmaceutico", e.target.value)}
            placeholder="Nome completo"
          />
        </Campo>
        <Campo label="CRF">
          <Entrada
            value={form.crf}
            onChange={(e) => alterar("crf", e.target.value)}
            placeholder="CRF-ES 00000"
          />
        </Campo>
      </div>

      {/* Entrega */}
      <div className="tile p-3.5">
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={form.temMotoboy}
            onChange={(e) => alterar("temMotoboy", e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-brand-500)]"
          />
          <span>
            <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-fg">
              <Bike className="h-3.5 w-3.5 text-fg-faint" strokeWidth={2} />
              Esta loja entrega por motoboy
            </span>
            <span className="mt-0.5 block text-[11.5px] leading-relaxed text-fg-faint">
              Sem isto marcado, todo pedido da unidade é retirada no balcão, e a
              opção de entrega nem aparece para quem atende.
            </span>
          </span>
        </label>

        {form.temMotoboy && (
          <div className="mt-3 max-w-[200px]">
            <Campo label="Taxa de entrega" hint="Zero significa entrega grátis.">
              <Entrada
                type="number"
                min={0}
                step="0.5"
                value={String(form.taxaEntrega)}
                onChange={(e) =>
                  alterar("taxaEntrega", Math.max(0, Number(e.target.value) || 0))
                }
              />
            </Campo>
          </div>
        )}
      </div>

      {/* Ativação */}
      {!criando && (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-tile border border-hairline bg-white/[0.022] p-3.5">
        <div className="min-w-0">
          <p className="text-[12.5px] font-medium text-fg">
            {loja.ativa ? "Loja em operação" : "Loja pausada"}
          </p>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-fg-faint">
            {loja.ativa
              ? "Pausar tira a unidade da operação. O histórico dela continua nos relatórios."
              : "Reativar devolve a unidade à operação com todo o cadastro intacto."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (loja.ativa && temDados) {
              const ok = window.confirm(
                `${loja.nome} tem movimento registrado. Pausar não apaga nada, mas tira a loja da operação. Continuar?`,
              );
              if (!ok) return;
            }
            alternarLojaAtiva(loja.id);
            onPronto();
          }}
          className={cn("btn-ghost shrink-0", loja.ativa && "hover:!text-caution")}
        >
          <Power className="h-3.5 w-3.5" strokeWidth={2} />
          {loja.ativa ? "Pausar loja" : "Reativar loja"}
        </button>
      </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-1">
        {salvo && (
          <span className="flex items-center gap-1.5 text-[12px] text-positive">
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
            Salvo
          </span>
        )}
        <button type="button" onClick={onPronto} className="btn-ghost">
          Cancelar
        </button>
        <button type="submit" className="btn-primary">
          {criando ? "Abrir loja" : "Salvar perfil"}
        </button>
      </div>
    </form>
  );
}
