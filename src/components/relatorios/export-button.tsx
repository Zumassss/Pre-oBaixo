"use client";

import { useState } from "react";
import { Check, Download, Loader2 } from "lucide-react";

/**
 * Baixa a planilha gerada no servidor.
 *
 * O arquivo vem como blob e é salvo por um link temporário, em vez de
 * navegar para a rota: assim a página não pisca e o nome do arquivo
 * definido no Content-Disposition é respeitado.
 */
export function ExportButton() {
  const [estado, setEstado] = useState<"pronto" | "gerando" | "ok" | "erro">(
    "pronto",
  );

  async function baixar() {
    if (estado === "gerando") return;
    setEstado("gerando");

    try {
      const res = await fetch("/api/relatorios/exportar");
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

  return (
    <button onClick={baixar} disabled={estado === "gerando"} className="btn-primary">
      {estado === "gerando" ? (
        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
      ) : estado === "ok" ? (
        <Check className="h-4 w-4" strokeWidth={2.4} />
      ) : (
        <Download className="h-4 w-4" strokeWidth={2} />
      )}
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
