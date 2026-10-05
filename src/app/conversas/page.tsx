import { Suspense } from "react";
import { ConversationsWorkspace } from "@/components/conversas/workspace";

export const metadata = { title: "Conversas · Preço Baixo" };

export default function ConversasPage() {
  // O Suspense é exigido pelo Next para ler "?c=" (a conversa que um aviso
  // mandou abrir) numa página gerada de antemão.
  return (
    <Suspense>
      <ConversationsWorkspace />
    </Suspense>
  );
}
