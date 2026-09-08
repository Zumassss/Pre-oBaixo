"use client";

import { useMemo, useState } from "react";
import { Search, Trash2, UserPlus, Users } from "lucide-react";
import { PageHeader, Panel, PanelHeader } from "@/components/ui/panel";
import { Table, Td, Thead, Tr } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal, Campo, Entrada, AreaTexto } from "@/components/ui/modal";
import { Reveal } from "@/components/ui/reveal";
import { useAppState } from "@/components/providers/app-state";
import { criarCliente, removerCliente, useBanco } from "@/lib/db/use-db";
import { cn } from "@/lib/utils";

function dataCurta(em: number) {
  return new Date(em).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

export default function ClientesPage() {
  const { banco, carregado } = useBanco();
  const { busca } = useAppState();
  const [buscaLocal, setBuscaLocal] = useState("");
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    telefone: "",
    consentimento: true,
    observacao: "",
  });

  const termo = (buscaLocal || busca).toLowerCase().trim();

  const visiveis = useMemo(
    () =>
      banco.clientes.filter(
        (c) =>
          !termo ||
          c.nome.toLowerCase().includes(termo) ||
          c.telefone.includes(termo),
      ),
    [banco.clientes, termo],
  );

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim() || !form.telefone.trim()) return;
    criarCliente({
      nome: form.nome.trim(),
      telefone: form.telefone.trim(),
      consentimento: form.consentimento,
      observacao: form.observacao.trim(),
    });
    setForm({ nome: "", telefone: "", consentimento: true, observacao: "" });
    setAberto(false);
  }

  const comOptIn = banco.clientes.filter((c) => c.consentimento).length;

  return (
    <div className="mx-auto max-w-[1560px]">
      <PageHeader
        title="Clientes"
        description="A base desta loja. O agente consulta aqui antes de responder."
        action={
          <button onClick={() => setAberto(true)} className="btn-primary">
            <UserPlus className="h-4 w-4" strokeWidth={2} />
            Novo cliente
          </button>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: "Clientes cadastrados", valor: banco.clientes.length },
          { label: "Com consentimento", valor: comOptIn },
          {
            label: "Sem consentimento",
            valor: banco.clientes.length - comOptIn,
          },
        ].map((stat, i) => (
          <Reveal
            key={stat.label}
            className="tile p-4"
            style={{ animation: `rise 0.5s cubic-bezier(0.16,1,0.3,1) ${i * 60}ms both` }}
          >
            <p className="text-[12px] text-fg-muted">{stat.label}</p>
            <p className="tnum mt-2 text-[23px] font-semibold leading-none tracking-[-0.03em] text-fg">
              {carregado ? stat.valor : 0}
            </p>
          </Reveal>
        ))}
      </div>

      <Panel>
        <PanelHeader
          eyebrow="Base"
          title="Clientes da loja"
          action={
            banco.clientes.length > 0 ? (
              <div className="relative hidden sm:block">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-[14px] w-[14px] -translate-y-1/2 text-fg-ghost"
                  strokeWidth={2}
                />
                <input
                  value={buscaLocal}
                  onChange={(e) => setBuscaLocal(e.target.value)}
                  className="field !w-[170px] !py-1.5 !pl-8.5 !text-[12px]"
                  placeholder="Buscar"
                />
              </div>
            ) : undefined
          }
        />

        {banco.clientes.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nenhum cliente cadastrado"
            description="Cadastre os clientes da loja para o agente reconhecer quem está falando e para poder enviar campanha."
            action={
              <button onClick={() => setAberto(true)} className="btn-primary">
                <UserPlus className="h-4 w-4" strokeWidth={2} />
                Cadastrar o primeiro
              </button>
            }
          />
        ) : visiveis.length === 0 ? (
          <EmptyState
            icon={Search}
            title="Nenhum cliente encontrado"
            description={`Nada corresponde a "${termo}".`}
          />
        ) : (
          <Table>
            <Thead
              columns={["Cliente", "Telefone", "Consentimento", "Cadastro", "Ação"]}
            />
            <tbody>
              {visiveis.map((cliente, i) => (
                <Tr key={cliente.id} index={i}>
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-surface-3 to-surface text-[10px] font-semibold text-fg-muted ring-1 ring-inset ring-white/10">
                        {cliente.nome
                          .split(" ")
                          .slice(0, 2)
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-fg">{cliente.nome}</p>
                        {cliente.observacao && (
                          <p className="truncate text-[10.5px] text-fg-ghost">
                            {cliente.observacao}
                          </p>
                        )}
                      </div>
                    </div>
                  </Td>
                  <Td className="tnum font-mono">{cliente.telefone}</Td>
                  <Td>
                    <span
                      className={cn(
                        "chip",
                        cliente.consentimento ? "chip-good" : "chip-warn",
                      )}
                    >
                      {cliente.consentimento ? "autorizado" : "sem opt-in"}
                    </span>
                  </Td>
                  <Td className="text-fg-faint">{dataCurta(cliente.criadoEm)}</Td>
                  <Td align="right">
                    <button
                      onClick={() => removerCliente(cliente.id)}
                      aria-label={`Remover ${cliente.nome}`}
                      className="rounded-lg p-1.5 text-fg-ghost transition-colors hover:bg-white/[0.06] hover:text-negative"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>

      <Modal
        aberto={aberto}
        titulo="Novo cliente"
        descricao="Só o necessário para o agente atender e para cumprir a LGPD."
        onFechar={() => setAberto(false)}
      >
        <form onSubmit={salvar} className="space-y-4">
          <Campo label="Nome completo">
            <Entrada
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Ex: Ana Paula Ribeiro"
              required
              autoFocus
            />
          </Campo>

          <Campo label="Telefone com DDD" hint="É por onde o WhatsApp identifica.">
            <Entrada
              value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: e.target.value })}
              placeholder="Ex: 27 99999-0000"
              required
            />
          </Campo>

          <Campo label="Observação (opcional)">
            <AreaTexto
              value={form.observacao}
              onChange={(e) => setForm({ ...form, observacao: e.target.value })}
              placeholder="Algo que a equipe precise saber"
              rows={2}
            />
          </Campo>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-hairline bg-white/[0.028] p-3">
            <input
              type="checkbox"
              checked={form.consentimento}
              onChange={(e) => setForm({ ...form, consentimento: e.target.checked })}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-brand-500)]"
            />
            <span>
              <span className="block text-[12.5px] font-medium text-fg">
                Autoriza receber mensagens da loja
              </span>
              <span className="mt-0.5 block text-[11.5px] leading-relaxed text-fg-faint">
                Sem esta autorização o cliente não entra em nenhuma campanha.
              </span>
            </span>
          </label>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="btn-ghost"
            >
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              Cadastrar
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
