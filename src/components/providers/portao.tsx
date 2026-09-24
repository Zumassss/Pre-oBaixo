"use client";

import { Abrindo, TelaLogin } from "@/components/login/tela-login";
import { AppShell } from "@/components/shell/app-shell";
import { useSessao } from "@/lib/db/use-db";

/**
 * Decide se mostra o sistema ou a porta de entrada.
 *
 * A sessão vive no navegador, então o servidor não tem como saber se alguém
 * está logado: o HTML dele sempre sai sem sessão. Se esta casca mostrasse o
 * login nesse primeiro instante, quem já está dentro veria a tela de entrada
 * piscar a cada carregamento.
 *
 * Por isso existe o estado "abrindo": a marca batendo, que é a mesma cena da
 * tela de login. O que vem depois entra sem salto.
 */
export function Portao({ children }: { children: React.ReactNode }) {
  const { usuario, carregado } = useSessao();

  if (!carregado) return <Abrindo />;
  if (!usuario) return <TelaLogin />;

  return <AppShell>{children}</AppShell>;
}
