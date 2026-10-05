"use client";

import { useState } from "react";
import { Check, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { trocarSenha } from "@/lib/db/local-db";
import { useSessao } from "@/lib/db/use-db";
import { cn } from "@/lib/utils";

/** As mesmas regras do servidor, para a pessoa ver antes de enviar. */
function regras(nova: string, usuario: string) {
  const semEspaco = (t: string) => t.replace(/\s/g, "").toLowerCase();
  return [
    { ok: nova.length >= 8, texto: "8 caracteres ou mais" },
    { ok: /[A-Za-z]/.test(nova) && /[0-9]/.test(nova), texto: "letras e números" },
    {
      ok: nova.length > 0 && (usuario.length < 3 || !semEspaco(nova).includes(semEspaco(usuario))),
      texto: "sem o nome do acesso",
    },
  ];
}

/**
 * Troca a senha de quem está logado. Pede a atual, confere a nova duas
 * vezes e, ao trocar, derruba quem estiver logado com a senha antiga em
 * outro aparelho. A senha nunca é guardada no navegador.
 */
export function TrocarSenha() {
  const { usuario } = useSessao();
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirma, setConfirma] = useState("");
  const [ver, setVer] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState(false);

  const lista = regras(nova, usuario?.usuario ?? "");
  const pronta = lista.every((r) => r.ok) && nova === confirma && atual.length > 0;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!pronta || enviando) return;
    setEnviando(true);
    setErro("");
    const r = await trocarSenha(atual, nova);
    setEnviando(false);
    if (!r.ok) {
      setErro(r.erro ?? "Não foi possível trocar a senha.");
      return;
    }
    setAtual("");
    setNova("");
    setConfirma("");
    setFeito(true);
  }

  const campo = "field !py-2 !text-[13px]";

  return (
    <Panel>
      <div id="senha" className="scroll-mt-24" />
      <PanelHeader eyebrow="Segurança" title="Senha de acesso" />
      <form onSubmit={enviar} className="space-y-3 px-5 pb-5" autoComplete="on">
        <p className="text-[12.5px] leading-relaxed text-fg-muted">
          Vale para o acesso <strong className="font-medium text-fg">{usuario?.nome ?? "atual"}</strong>. Ao trocar,
          quem estiver logado com a senha antiga em outro aparelho sai na hora.
        </p>
        {usuario?.senhaFraca && !feito && (
          <p role="alert" className="rounded-xl border border-caution/40 bg-caution/10 px-3 py-2 text-[12px] leading-relaxed text-fg">
            A senha atual é fácil de adivinhar. Como o endereço do sistema é público, troque antes de mostrar para
            alguém ou de usar com cliente de verdade.
          </p>
        )}
        {/* O navegador usa este campo para lembrar a senha do acesso certo. */}
        <input type="text" name="username" autoComplete="username" value={usuario?.usuario ?? ""} readOnly hidden />
        <label className="block">
          <span className="mb-1 block text-[12px] text-fg-muted">Senha atual</span>
          <input
            type={ver ? "text" : "password"}
            value={atual}
            onChange={(e) => setAtual(e.target.value)}
            autoComplete="current-password"
            className={campo}
          />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[12px] text-fg-muted">Senha nova</span>
            <input
              type={ver ? "text" : "password"}
              value={nova}
              onChange={(e) => {
                setNova(e.target.value);
                setFeito(false);
              }}
              autoComplete="new-password"
              maxLength={72}
              className={campo}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] text-fg-muted">Repita a senha nova</span>
            <input
              type={ver ? "text" : "password"}
              value={confirma}
              onChange={(e) => setConfirma(e.target.value)}
              autoComplete="new-password"
              maxLength={72}
              className={campo}
            />
          </label>
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[11.5px]">
          {lista.map((r) => (
            <li key={r.texto} className={cn("flex items-center gap-1", r.ok ? "text-positive" : "text-fg-ghost")}>
              <Check className="h-3 w-3" strokeWidth={2.6} />
              {r.texto}
            </li>
          ))}
          <li className={cn("flex items-center gap-1", confirma && nova === confirma ? "text-positive" : "text-fg-ghost")}>
            <Check className="h-3 w-3" strokeWidth={2.6} />
            as duas iguais
          </li>
        </ul>
        {erro && (
          <p role="alert" className="text-[12px] text-negative">
            {erro}
          </p>
        )}
        {feito && (
          <p role="status" className="text-[12px] text-positive">
            Senha trocada. Use a nova na próxima entrada.
          </p>
        )}
        <div className="flex items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={() => setVer((v) => !v)}
            className="flex items-center gap-1.5 text-[12px] text-fg-muted transition-colors hover:text-fg"
          >
            {ver ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {ver ? "Esconder" : "Mostrar"}
          </button>
          <button type="submit" disabled={!pronta || enviando} className="btn-primary !py-2 disabled:opacity-50">
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" strokeWidth={2.2} />}
            Trocar senha
          </button>
        </div>
      </form>
    </Panel>
  );
}
