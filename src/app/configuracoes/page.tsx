"use client";

import { useState } from "react";
import {
  Check,
  KeyRound,
  MessageSquareWarning,
  PlugZap,
  ShieldCheck,
  Store,
  Trash2,
} from "lucide-react";
import { PageHeader, Panel, PanelHeader } from "@/components/ui/panel";
import { Campo, Entrada } from "@/components/ui/modal";
import { Reveal } from "@/components/ui/reveal";
import { definirWhatsapp, salvarLoja, useBanco } from "@/lib/db/use-db";
import { limparBanco } from "@/lib/db/local-db";
import { LOJA_VAZIA, type Loja } from "@/lib/db/types";
import { cn } from "@/lib/utils";

export default function ConfiguracoesPage() {
  const { banco, carregado } = useBanco();

  // O formulário nasce com o que está salvo. Enquanto o banco não carrega,
  // ele fica vazio; a troca da chave remonta o formulário com os dados certos
  // sem precisar copiar estado dentro de um efeito.
  return (
    <FormularioLoja
      key={carregado ? "carregado" : "vazio"}
      inicial={carregado ? banco.loja : LOJA_VAZIA}
      banco={banco}
      carregado={carregado}
    />
  );
}

function FormularioLoja({
  inicial,
  banco,
  carregado,
}: {
  inicial: Loja;
  banco: ReturnType<typeof useBanco>["banco"];
  carregado: boolean;
}) {
  const [form, setForm] = useState<Loja>(inicial);
  const [salvo, setSalvo] = useState(false);

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    salvarLoja(form);
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2400);
  }

  function alterar(campo: keyof Loja, valor: string) {
    setForm((atual) => ({ ...atual, [campo]: valor }));
  }

  return (
    <div className="mx-auto max-w-[1560px]">
      <PageHeader
        title="Configurações"
        description="Os dados desta loja. É daqui que o agente tira o que responder."
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* Dados da loja */}
        <Panel className="xl:col-span-7">
          <PanelHeader
            eyebrow="Identificação"
            title="Dados da loja"
            action={
              <span
                className={cn(
                  "chip",
                  banco.loja.configurada ? "chip-good" : "chip-warn",
                )}
              >
                {banco.loja.configurada ? "configurada" : "incompleta"}
              </span>
            }
          />
          <form onSubmit={salvar} className="space-y-4 px-5 pb-5">
            <Campo label="Nome da loja">
              <Entrada
                value={form.nome}
                onChange={(e) => alterar("nome", e.target.value)}
                placeholder="Ex: Preço Baixo Vila Velha"
                required
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
              <Campo label="CEP">
                <Entrada
                  value={form.cep}
                  onChange={(e) => alterar("cep", e.target.value)}
                  placeholder="00000-000"
                />
              </Campo>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo label="Telefone da loja">
                <Entrada
                  value={form.telefone}
                  onChange={(e) => alterar("telefone", e.target.value)}
                  placeholder="Ex: 27 3000-0000"
                />
              </Campo>
              <Campo label="CNPJ">
                <Entrada
                  value={form.cnpj}
                  onChange={(e) => alterar("cnpj", e.target.value)}
                  placeholder="00.000.000/0000-00"
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
                placeholder="Ex: Segunda a sábado das 8h às 22h, domingo das 8h às 20h"
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
                  placeholder="Ex: CRF-ES 00000"
                />
              </Campo>
            </div>

            <div className="flex items-center justify-end gap-3 pt-1">
              {salvo && (
                <span className="flex items-center gap-1.5 text-[12px] text-positive">
                  <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                  Salvo
                </span>
              )}
              <button type="submit" className="btn-primary">
                Salvar dados da loja
              </button>
            </div>
          </form>
        </Panel>

        <div className="flex flex-col gap-4 xl:col-span-5">
          {/* WhatsApp */}
          <Panel>
            <PanelHeader
              eyebrow="Canal"
              title="WhatsApp"
              action={
                <span
                  className={cn(
                    "chip",
                    banco.whatsappConectado ? "chip-good" : "chip-warn",
                  )}
                >
                  {banco.whatsappConectado ? "conectado" : "não conectado"}
                </span>
              }
            />
            <div className="px-5 pb-5">
              <div className="flex items-start gap-2.5">
                <MessageSquareWarning
                  className="mt-0.5 h-4 w-4 shrink-0 text-fg-faint"
                  strokeWidth={2}
                />
                <p className="text-[12.5px] leading-relaxed text-fg-muted">
                  A conexão real usa a API oficial da Meta e precisa de um número
                  verificado. Enquanto isso não é feito, marque abaixo para simular
                  o canal ligado e testar as telas.
                </p>
              </div>

              <button
                onClick={() => definirWhatsapp(!banco.whatsappConectado)}
                className={cn(
                  "mt-4 w-full",
                  banco.whatsappConectado ? "btn-ghost" : "btn-primary",
                )}
              >
                <PlugZap className="h-4 w-4" strokeWidth={2} />
                {banco.whatsappConectado
                  ? "Marcar como desconectado"
                  : "Marcar como conectado"}
              </button>
            </div>
          </Panel>

          {/* Conformidade */}
          <Panel>
            <PanelHeader eyebrow="Conformidade" title="LGPD e responsabilidade" />
            <div className="px-5 pb-5">
              <Reveal className="tile flex items-start gap-2.5 p-3">
                <ShieldCheck
                  className="mt-0.5 h-4 w-4 shrink-0 text-positive"
                  strokeWidth={2}
                />
                <p className="text-[11.5px] leading-relaxed text-fg-faint">
                  Campanha só alcança quem autorizou. Compra de medicamento é dado
                  sensível e não entra em disparo automático. Dúvida clínica vai
                  para o farmacêutico responsável cadastrado acima.
                </p>
              </Reveal>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="btn-ghost !text-[12px]">
                  <KeyRound className="h-3.5 w-3.5" strokeWidth={2} />
                  Chaves de API
                </button>
              </div>
            </div>
          </Panel>

          {/* Dados locais */}
          <Panel className="flex-1">
            <PanelHeader eyebrow="Armazenamento" title="Onde os dados ficam" />
            <div className="px-5 pb-5">
              <div className="flex items-start gap-2.5">
                <Store
                  className="mt-0.5 h-4 w-4 shrink-0 text-fg-faint"
                  strokeWidth={2}
                />
                <p className="text-[12.5px] leading-relaxed text-fg-muted">
                  Enquanto não há servidor, tudo que você cadastra fica salvo neste
                  navegador. Ao conectar o banco de dados, os mesmos cadastros
                  passam a ficar na nuvem e a valer para toda a equipe da loja.
                </p>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  { label: "Clientes", valor: banco.clientes.length },
                  { label: "Produtos", valor: banco.produtos.length },
                  { label: "Conversas", valor: banco.conversas.length },
                ].map((item) => (
                  <div key={item.label} className="tile p-2.5 text-center">
                    <p className="tnum font-mono text-[16px] font-semibold text-fg">
                      {carregado ? item.valor : 0}
                    </p>
                    <p className="mt-0.5 text-[10.5px] text-fg-ghost">
                      {item.label}
                    </p>
                  </div>
                ))}
              </div>

              <button
                onClick={() => {
                  if (
                    window.confirm(
                      "Isso apaga todos os cadastros salvos neste navegador. Continuar?",
                    )
                  ) {
                    limparBanco();
                    setForm(LOJA_VAZIA);
                  }
                }}
                className="btn-ghost mt-3 w-full !text-[12px] hover:!text-negative"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                Apagar todos os dados
              </button>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
