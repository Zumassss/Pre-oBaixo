"use client";

import { useState } from "react";
import { Megaphone, Plus, Send, Trash2, TriangleAlert } from "lucide-react";
import { PageHeader, Panel, PanelHeader } from "@/components/ui/panel";
import { Table, Td, Thead, Tr } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal, Campo, Entrada, AreaTexto } from "@/components/ui/modal";
import { Reveal } from "@/components/ui/reveal";
import {
  criarCampanha,
  mudarStatusCampanha,
  removerCampanha,
  useBanco,
} from "@/lib/db/use-db";
import { cn } from "@/lib/utils";

const statusClass: Record<string, string> = {
  rascunho: "chip",
  agendada: "chip-hot",
  enviada: "chip-good",
};

function dataCurta(em: number) {
  return new Date(em).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

export default function CampanhasPage() {
  const { banco, carregado } = useBanco();
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState({ nome: "", mensagem: "", agendadaPara: "" });

  const publico = banco.clientes.filter((c) => c.consentimento).length;

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim() || !form.mensagem.trim()) return;
    criarCampanha({
      nome: form.nome.trim(),
      mensagem: form.mensagem.trim(),
      status: form.agendadaPara ? "agendada" : "rascunho",
      agendadaPara: form.agendadaPara,
    });
    setForm({ nome: "", mensagem: "", agendadaPara: "" });
    setAberto(false);
  }

  return (
    <div className="mx-auto max-w-[1560px]">
      <PageHeader
        title="Campanhas"
        description="Mensagens para os clientes desta loja que autorizaram contato."
        action={
          <button onClick={() => setAberto(true)} className="btn-primary">
            <Plus className="h-4 w-4" strokeWidth={2.4} />
            Nova campanha
          </button>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: "Campanhas criadas", valor: banco.campanhas.length },
          {
            label: "Público disponível",
            valor: publico,
            hint: "clientes com opt-in",
          },
          {
            label: "Agendadas",
            valor: banco.campanhas.filter((c) => c.status === "agendada").length,
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
            {stat.hint && (
              <p className="mt-1.5 text-[11px] text-fg-ghost">{stat.hint}</p>
            )}
          </Reveal>
        ))}
      </div>

      {publico === 0 && banco.campanhas.length > 0 && (
        <div className="tile mb-4 flex items-start gap-2.5 p-3.5">
          <TriangleAlert
            className="mt-0.5 h-4 w-4 shrink-0 text-caution"
            strokeWidth={2}
          />
          <p className="text-[12.5px] leading-relaxed text-fg-muted">
            Nenhum cliente autorizou contato ainda, então nenhuma campanha pode
            ser enviada. Cadastre clientes com consentimento primeiro.
          </p>
        </div>
      )}

      <Panel>
        <PanelHeader eyebrow="Todas" title="Campanhas da loja" />

        {banco.campanhas.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="Nenhuma campanha criada"
            description="Campanha é a mensagem que a loja dispara para quem já é cliente e autorizou receber contato."
            action={
              <button onClick={() => setAberto(true)} className="btn-primary">
                <Plus className="h-4 w-4" strokeWidth={2.4} />
                Criar a primeira
              </button>
            }
          />
        ) : (
          <Table>
            <Thead columns={["Campanha", "Status", "Agendada", "Criada", "Ação"]} />
            <tbody>
              {banco.campanhas.map((campanha, i) => (
                <Tr key={campanha.id} index={i}>
                  <Td>
                    <p className="font-medium text-fg">{campanha.nome}</p>
                    <p className="line-clamp-1 max-w-md text-[10.5px] text-fg-ghost">
                      {campanha.mensagem}
                    </p>
                  </Td>
                  <Td>
                    <span className={cn("chip", statusClass[campanha.status])}>
                      {campanha.status}
                    </span>
                  </Td>
                  <Td className="text-fg-faint">
                    {campanha.agendadaPara || "sem data"}
                  </Td>
                  <Td className="text-fg-faint">{dataCurta(campanha.criadoEm)}</Td>
                  <Td align="right">
                    <div className="flex items-center justify-end gap-1">
                      {campanha.status !== "enviada" && (
                        <button
                          onClick={() => mudarStatusCampanha(campanha.id, "enviada")}
                          disabled={publico === 0}
                          title={
                            publico === 0
                              ? "Nenhum cliente com consentimento"
                              : "Marcar como enviada"
                          }
                          className="btn-ghost !px-3 !py-1 !text-[11px] disabled:opacity-40"
                        >
                          <Send className="h-3 w-3" strokeWidth={2.2} />
                          enviar
                        </button>
                      )}
                      <button
                        onClick={() => removerCampanha(campanha.id)}
                        aria-label={`Remover ${campanha.nome}`}
                        className="rounded-lg p-1.5 text-fg-ghost transition-colors hover:bg-white/[0.06] hover:text-negative"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                      </button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>

      <Modal
        aberto={aberto}
        titulo="Nova campanha"
        descricao={`Vai para ${publico} ${publico === 1 ? "cliente" : "clientes"} com consentimento registrado.`}
        onFechar={() => setAberto(false)}
      >
        <form onSubmit={salvar} className="space-y-4">
          <Campo label="Nome da campanha" hint="Só você vê, serve para organizar.">
            <Entrada
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Ex: Genéricos de setembro"
              required
              autoFocus
            />
          </Campo>

          <Campo
            label="Mensagem"
            hint="Modelos de marketing no WhatsApp precisam de aprovação da Meta."
          >
            <AreaTexto
              value={form.mensagem}
              onChange={(e) => setForm({ ...form, mensagem: e.target.value })}
              placeholder="Escreva a mensagem como o cliente vai receber"
              rows={4}
              required
            />
          </Campo>

          <Campo label="Agendar para (opcional)">
            <Entrada
              type="datetime-local"
              value={form.agendadaPara}
              onChange={(e) => setForm({ ...form, agendadaPara: e.target.value })}
            />
          </Campo>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="btn-ghost"
            >
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              Criar campanha
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
