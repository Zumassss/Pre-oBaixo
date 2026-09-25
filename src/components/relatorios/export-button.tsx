"use client";

import { useState } from "react";
import { Check, Download, Loader2 } from "lucide-react";
import { useBanco } from "@/lib/db/use-db";
import type { VisaoLoja } from "@/lib/db/types";
import { cn } from "@/lib/utils";

/**
 * Baixa a planilha de uma loja.
 *
 * Os cadastros vivem no navegador enquanto não há banco, então o conteúdo
 * vai no corpo da requisição e o servidor só formata. O arquivo volta como
 * blob e é salvo por um link temporário, para a página não piscar.
 *
 * Sem `visao`, baixa a loja que está aberta na sessão. A visão de rede passa
 * a loja da linha, para o administrador tirar o relatório de qualquer
 * unidade sem precisar entrar nela antes.
 */
export function ExportButton({
  visao,
  somenteIcone = false,
  titulo,
}: {
  visao?: VisaoLoja;
  somenteIcone?: boolean;
  titulo?: string;
} = {}) {
  const { banco: ativa } = useBanco();
  const banco = visao ?? ativa;
  const [estado, setEstado] = useState<"pronto" | "gerando" | "ok" | "erro">(
    "pronto",
  );

  async function baixar() {
    if (estado === "gerando") return;
    setEstado("gerando");

    try {
      const res = await fetch("/api/relatorios/exportar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(banco),
      });
      if (!res.ok) throw new Error("falha ao gerar");

      const blob = await res.blob();
      const nome =
        res.headers
          .get("Content-Disposition")
          ?.match(/filename="?([^"]+)"?/)?.[1] ?? "relatorio.xlsx";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nome;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setEstado("ok");
      setTimeout(() => setEstado("pronto"), 2600);
    } catch {
      setEstado("erro");
      setTimeout(() => setEstado("pronto"), 2600);
    }
  }

  const icone =
    estado === "gerando" ? (
      <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
    ) : estado === "ok" ? (
      <Check className="h-4 w-4" strokeWidth={2.4} />
    ) : (
      <Download className="h-4 w-4" strokeWidth={2} />
    );

  if (somenteIcone) {
    return (
      <button
        onClick={baixar}
        disabled={estado === "gerando"}
        aria-label={titulo ?? "Baixar Excel"}
        title={titulo ?? "Baixar Excel"}
        className={cn(
          "rounded-lg p-1.5 transition-colors hover:bg-nivel-3 hover:text-fg",
          estado === "ok" ? "text-positive" : "text-fg-ghost",
        )}
      >
        {icone}
      </button>
    );
  }

  return (
    <button onClick={baixar} disabled={estado === "gerando"} className="btn-primary">
      {icone}
      {estado === "gerando"
        ? "Gerando"
        : estado === "ok"
          ? "Baixado"
          : estado === "erro"
            ? "Tentar de novo"
            : "Baixar Excel"}
    </button>
  );
}
