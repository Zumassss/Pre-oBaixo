"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Lock,
  ShieldCheck,
  Store,
} from "lucide-react";
import { LogoFull, LogoMark } from "@/components/brand/logo";
import { Monitor } from "@/components/login/monitor";
import { entrar } from "@/lib/db/use-db";
import { cn } from "@/lib/utils";

/**
 * A porta de entrada do sistema.
 *
 * São dois acessos conhecidos, então pedir para digitar o nome de usuário
 * seria trabalho sem motivo: a pessoa escolhe o perfil e só digita a senha.
 *
 * O que esta tela confere NÃO é autenticação. A senha está no navegador e
 * qualquer pessoa a lê. Serve para separar os dois perfis na demonstração, e
 * tem que virar verificação no servidor antes de existir dado real de
 * cliente aqui dentro.
 */

type Perfil = {
  usuario: string;
  titulo: string;
  papel: string;
  descricao: string;
  icone: typeof ShieldCheck;
};

const PERFIS: Perfil[] = [
  {
    usuario: "administrador",
    titulo: "Administrador",
    papel: "Rede",
    descricao: "Vê todas as lojas, tira relatórios e configura as unidades.",
    icone: ShieldCheck,
  },
  {
    usuario: "loja teste 1",
    titulo: "Loja Teste 1",
    papel: "Unidade",
    descricao: "Opera o dia a dia: atendimento, pedidos e estoque da loja.",
    icone: Store,
  },
];

export function TelaLogin() {
  const [escolhido, setEscolhido] = useState<Perfil | null>(null);
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [entrando, setEntrando] = useState(false);
  const campoSenha = useRef<HTMLInputElement>(null);

  // O foco vai para a senha assim que o perfil é escolhido: quem já sabe a
  // senha digita direto, sem precisar clicar duas vezes.
  useEffect(() => {
    if (escolhido) campoSenha.current?.focus();
  }, [escolhido]);

  function escolher(perfil: Perfil) {
    setEscolhido(perfil);
    setSenha("");
    setErro("");
  }

  function voltar() {
    setEscolhido(null);
    setSenha("");
    setErro("");
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!escolhido || entrando) return;

    setEntrando(true);
    setErro("");

    const resultado = entrar(escolhido.usuario, senha);
    if (!resultado.ok) {
      setEntrando(false);
      setErro(resultado.erro);
      setSenha("");
      campoSenha.current?.focus();
      return;
    }
    // Em caso de acerto não desligamos o "entrando": a sessão abre e esta
    // tela sai do ar. Desligar faria o botão piscar de volta ao normal.
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-void">
      <Cenario />

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-10">
        <div className="sobe-em-cascata w-full max-w-[440px]">
          {/* Marca */}
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="bate text-brand-500">
              <LogoMark className="h-14" />
            </div>
            <div className="mt-5 text-fg">
              <LogoFull className="w-[228px]" />
            </div>
            <p className="mt-3 text-[12.5px] text-fg-faint">
              Central de operações
            </p>
          </div>

          {/* Cartão */}
          <div className="panel overflow-hidden">
            {!escolhido ? (
              <div className="p-5">
                <p className="eyebrow mb-3">Quem está entrando</p>
                <div className="space-y-2">
                  {PERFIS.map((perfil) => (
                    <CartaoPerfil
                      key={perfil.usuario}
                      perfil={perfil}
                      onEscolher={() => escolher(perfil)}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <form onSubmit={enviar} className="p-5">
                <button
                  type="button"
                  onClick={voltar}
                  className="mb-4 flex items-center gap-1.5 text-[12px] text-fg-faint transition-colors hover:text-fg"
                >
                  <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
                  Trocar de acesso
                </button>

                <div className="tile mb-4 flex items-center gap-3 p-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/12 text-brand-400 ring-1 ring-inset ring-brand-500/25">
                    <escolhido.icone className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-semibold text-fg">
                      {escolhido.titulo}
                    </p>
                    <p className="truncate text-[11px] text-fg-ghost">
                      {escolhido.papel}
                    </p>
                  </div>
                </div>

                <label
                  htmlFor="senha"
                  className="mb-1.5 block text-[11.5px] font-medium text-fg-muted"
                >
                  Senha
                </label>
                <div className="relative">
                  <Lock
                    className="pointer-events-none absolute left-3.5 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-fg-ghost"
                    strokeWidth={2}
                  />
                  <input
                    id="senha"
                    ref={campoSenha}
                    type="password"
                    inputMode="numeric"
                    autoComplete="current-password"
                    value={senha}
                    onChange={(e) => {
                      setSenha(e.target.value);
                      setErro("");
                    }}
                    className="field !py-2.5 !pl-10 tracking-[0.3em]"
                    placeholder="••••"
                    aria-invalid={Boolean(erro)}
                    aria-describedby={erro ? "erro-senha" : undefined}
                  />
                </div>

                {erro && (
                  <p
                    id="erro-senha"
                    role="alert"
                    className="mt-2 text-[12px] text-negative"
                  >
                    {erro}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={!senha || entrando}
                  className="btn-primary mt-4 w-full !py-2.5"
                >
                  {entrando ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.2} />
                      Entrando
                    </>
                  ) : (
                    <>
                      Entrar
                      <ArrowRight className="h-4 w-4" strokeWidth={2.2} />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

          <p className="mt-5 text-center text-[11px] leading-relaxed text-fg-faint">
            Ambiente de demonstração. Os dois acessos usam a senha 1234 e ficam
            salvos neste navegador, sem servidor no meio.
          </p>
        </div>
      </main>
    </div>
  );
}

function CartaoPerfil({
  perfil,
  onEscolher,
}: {
  perfil: Perfil;
  onEscolher: () => void;
}) {
  const Icone = perfil.icone;
  return (
    <button
      type="button"
      onClick={onEscolher}
      className={cn(
        "group flex w-full items-center gap-3 rounded-tile border border-hairline bg-nivel-1 p-3.5 text-left",
        "transition-[transform,border-color,background-color] duration-200",
        "hover:-translate-y-px hover:border-brand-500/40 hover:bg-brand-500/[0.07]",
      )}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-nivel-3 text-fg-muted ring-1 ring-inset ring-anel transition-colors group-hover:bg-brand-500/12 group-hover:text-brand-400 group-hover:ring-brand-500/25">
        <Icone className="h-[18px] w-[18px]" strokeWidth={2} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[13.5px] font-semibold text-fg">
            {perfil.titulo}
          </span>
          <span className="chip !px-2 !py-[2px] !text-[9.5px]">
            {perfil.papel}
          </span>
        </span>
        <span className="mt-0.5 block text-[11.5px] leading-relaxed text-fg-faint">
          {perfil.descricao}
        </span>
      </span>

      <ArrowRight
        className="h-4 w-4 shrink-0 text-fg-ghost transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-brand-400"
        strokeWidth={2}
      />
    </button>
  );
}

/**
 * O fundo da tela.
 *
 * Tudo aqui é decoração e não recebe clique nem leitura de tela. O traço do
 * monitor fica atrás do cartão, cortado nas pontas para não parecer que a
 * linha bate na borda e para.
 */
function Cenario() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <div className="aura-respira absolute -top-[300px] left-1/2 h-[700px] w-[980px] -translate-x-1/2 aura-brand" />

      <div
        className="absolute inset-0 grid-mesh opacity-50"
        style={{
          maskImage:
            "radial-gradient(ellipse 80% 60% at 50% 40%, #000 15%, transparent 75%)",
        }}
      />

      {/* No celular o cartão ocupa quase toda a largura e taparia o traço,
          então ele desce para o vazio embaixo. No desktop fica no meio,
          atravessando atrás do cartão. */}
      <div
        className="absolute inset-x-0 top-[82%] h-[110px] -translate-y-1/2 text-brand-500 sm:top-1/2 sm:h-[130px]"
        style={{
          maskImage:
            "linear-gradient(90deg, transparent, #000 18%, #000 82%, transparent)",
        }}
      >
        <Monitor />
      </div>

      <div className="absolute inset-0 vinheta" />
    </div>
  );
}

/** Marca batendo sozinha, enquanto a sessão é lida do navegador. */
export function Abrindo() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-void">
      <div className="bate text-brand-500">
        <LogoMark className="h-12" />
      </div>
      <span className="sr-only">Abrindo o sistema</span>
    </div>
  );
}
