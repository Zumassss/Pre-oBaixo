"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Copy, Info, QrCode, Settings } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { gerarPixCopiaECola, pixConfigurado } from "@/lib/pix";
import { registrarPagamento } from "@/lib/db/use-db";
import type { Pagamentos, Pedido } from "@/lib/db/types";
import { formatBRLCents } from "@/lib/utils";

/**
 * Cobrança por Pix.
 *
 * O código gerado aqui é um Pix copia e cola de verdade, montado com a
 * chave da loja no formato do Banco Central. O cliente cola no app do banco
 * dele e paga o valor exato.
 *
 * O que ainda não existe é a confirmação automática. Saber que o dinheiro
 * caiu depende de um provedor de pagamento mandando webhook, e isso não
 * está conectado. Por isso a baixa aqui é manual e a tela diz isso na cara,
 * em vez de fingir que o pedido se resolve sozinho.
 */
export function CobrancaPix({
  pedido,
  pagamentos,
  aberto,
  onFechar,
}: {
  pedido: Pedido | null;
  pagamentos: Pagamentos;
  aberto: boolean;
  onFechar: () => void;
}) {
  const [copiado, setCopiado] = useState(false);

  const configurado = pixConfigurado(pagamentos);

  const codigo = useMemo(() => {
    if (!pedido || !configurado) return "";
    return gerarPixCopiaECola({
      chave: pagamentos.chavePix,
      beneficiario: pagamentos.beneficiario,
      cidade: pagamentos.cidade,
      valor: pedido.total,
      txid: `PEDIDO${pedido.numero}`,
    });
  }, [pedido, pagamentos, configurado]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2200);
    } catch {
      // Sem permissão de área de transferência: o texto continua na tela
      // para seleção manual.
    }
  }

  if (!pedido) return null;

  return (
    <Modal
      aberto={aberto}
      titulo={`Cobrança do pedido #${pedido.numero}`}
      descricao={`${pedido.cliente} · ${formatBRLCents(pedido.total)}`}
      onFechar={onFechar}
    >
      {!configurado ? (
        <div className="space-y-4">
          <div className="tile flex items-start gap-2.5 p-3.5">
            <Settings
              className="mt-0.5 h-4 w-4 shrink-0 text-caution"
              strokeWidth={2}
            />
            <p className="text-[12.5px] leading-relaxed text-fg-muted">
              Falta cadastrar a chave Pix da loja. Sem ela não dá para montar
              o código de pagamento.
            </p>
          </div>
          <div className="flex justify-end">
            <Link href="/configuracoes" className="btn-primary">
              Cadastrar chave Pix
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="eyebrow mb-2">Pix copia e cola</p>
            <div className="rounded-xl border border-hairline bg-white/[0.028] p-3">
              <p className="break-all font-mono text-[11px] leading-relaxed text-fg-muted">
                {codigo}
              </p>
            </div>
            <button onClick={copiar} className="btn-ghost mt-2 w-full !text-[12px]">
              {copiado ? (
                <>
                  <Check className="h-3.5 w-3.5 text-positive" strokeWidth={2.4} />
                  Copiado
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" strokeWidth={2} />
                  Copiar código
                </>
              )}
            </button>
          </div>

          <div className="tile flex items-start gap-2.5 p-3.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" strokeWidth={2} />
            <div className="text-[12px] leading-relaxed text-fg-muted">
              <p>
                Mande este código na conversa do cliente. Ele cola no app do
                banco e o valor já vai preenchido.
              </p>
              <p className="mt-1.5 text-fg-faint">
                A confirmação ainda não é automática. Confira o recebimento na
                conta da loja e registre o pagamento abaixo. Para dar baixa
                sozinho, o sistema precisa de um provedor como Mercado Pago ou
                Asaas conectado.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <button onClick={onFechar} className="btn-ghost">
              Fechar
            </button>
            {!pedido.pago && (
              <button
                onClick={() => {
                  registrarPagamento(pedido.id);
                  onFechar();
                }}
                className="btn-primary"
              >
                <QrCode className="h-4 w-4" strokeWidth={2} />
                Registrar pagamento recebido
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
