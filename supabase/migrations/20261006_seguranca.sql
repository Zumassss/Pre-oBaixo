-- ------------------------------------------------------------------
-- Revisão de segurança de 2026-10-06.
--
-- 1. Fecha as funções do modelo antigo (documento por loja), que ninguém
--    chama desde 2026-10-05 mas continuavam abertas para a chave pública.
-- 2. "Quem já escreveu no WhatsApp" passa a ser só do bot. O painel podia
--    marcar esse campo à mão, ou trocar o telefone de quem escreveu, e é
--    esse campo que libera o bot a mandar mensagem.
-- 3. Teto de tamanho por lote gravado.
-- 4. Troca de senha pelo próprio sistema, com regra mínima, e aviso de
--    senha fraca a cada entrada.
-- 5. Login responde a mesma coisa para usuário inexistente e senha errada.
-- ------------------------------------------------------------------

-- 1. Funções antigas -------------------------------------------------

revoke execute on function public.ler_rede(text) from public, anon, authenticated;
revoke execute on function public.versoes(text) from public, anon, authenticated;
revoke execute on function public.gravar_dados(text, text, jsonb, int) from public, anon, authenticated;
revoke execute on function public.gravar_lojas(text, jsonb, int) from public, anon, authenticated;
revoke execute on function public.bot_ler(text) from public, anon, authenticated;
revoke execute on function public.bot_gravar(text, jsonb, int) from public, anon, authenticated;

-- 2. Campos que só o bot escreve -------------------------------------

/**
 * Reescreve o lote vindo do painel: em cliente, "primeira e última mensagem"
 * ficam como estão no banco (zero para cliente novo), e quem já escreveu
 * não muda de telefone. O resto do cadastro a loja edita à vontade.
 */
create or replace function public._proteger_clientes(p_ops jsonb)
returns jsonb language plpgsql stable security definer
set search_path = public
as $$
declare
  op jsonb;
  v_d jsonb;
  atual jsonb;
  saida jsonb := '[]'::jsonb;
begin
  if p_ops is null or jsonb_typeof(p_ops) <> 'array' then
    return p_ops;
  end if;
  for op in select * from jsonb_array_elements(p_ops) loop
    v_d := op->'d';
    if op->>'c' = 'clientes' and v_d is not null and jsonb_typeof(v_d) = 'object' then
      select r.dados into atual from public.registros r
        where r.loja_id = op->>'l' and r.colecao = 'clientes' and r.id = op->>'i' and not r.apagado;
      v_d := v_d
        || jsonb_build_object(
             'primeiraMensagemEm', coalesce(atual->'primeiraMensagemEm', '0'::jsonb),
             'ultimaMensagemEm', coalesce(atual->'ultimaMensagemEm', '0'::jsonb));
      if public._numero(atual->>'primeiraMensagemEm') > 0 then
        v_d := v_d || jsonb_build_object('telefone', atual->'telefone');
      end if;
      op := jsonb_set(op, '{d}', v_d);
    end if;
    saida := saida || jsonb_build_array(op);
  end loop;
  return saida;
end $$;
revoke execute on function public._proteger_clientes(jsonb) from public, anon, authenticated;

create or replace function public.gravar(p_token text, p_ops jsonb)
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $$
declare
  u public.usuarios;
  v_ate timestamptz;
begin
  select * into u from public._usuario_da_sessao(p_token);
  if u.id is null then
    return jsonb_build_object('ok', false, 'erro', 'sessao');
  end if;
  -- 3. Um lote normal tem poucos KB; 4 MB já é anormal.
  if pg_column_size(p_ops) > 4000000 then
    return jsonb_build_object('ok', false, 'erro', 'Lote grande demais.');
  end if;
  select ajustes_ate into v_ate from public.sessoes
    where token_hash = public._hash(p_token);
  return public._gravar(
    public._lojas_visiveis(u),
    u.papel = 'admin',
    u.papel = 'admin' or coalesce(v_ate > now(), false),
    array['loja', 'ajustes', 'estado', 'clientes', 'produtos', 'campanhas',
          'conversas', 'pedidos', 'eventos', 'envios'],
    public._proteger_clientes(p_ops));
end $$;

create or replace function public.bot_gravar_ops(p_chave text, p_ops jsonb)
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_loja text;
begin
  v_loja := public._loja_do_bot(p_chave);
  if v_loja is null then
    return jsonb_build_object('ok', false, 'erro', 'Chave inválida.');
  end if;
  if pg_column_size(p_ops) > 4000000 then
    return jsonb_build_object('ok', false, 'erro', 'Lote grande demais.');
  end if;
  return public._gravar(array[v_loja], false, false,
    array['estado', 'clientes', 'conversas', 'pedidos', 'eventos', 'envios'], p_ops);
end $$;

-- 4. Senha -----------------------------------------------------------

alter table public.usuarios add column if not exists senha_fraca boolean not null default false;

/** Pelo menos 8 caracteres, com letra e número, fora das senhas óbvias. */
create or replace function public._senha_fraca(p_senha text, p_usuario text)
returns boolean language sql immutable
set search_path = public
as $$
  select length(coalesce(p_senha, '')) < 8
      or p_senha !~ '[A-Za-z]'
      or p_senha !~ '[0-9]'
      or lower(p_senha) = any (array[
           'senha123', 'senha1234', 'admin123', 'admin1234', 'abc12345',
           'qwerty123', 'precobaixo1', 'precobaixo123', 'mazus123', 'farmacia1',
           'farmacia123', 'mudar123', 'teste123', 'loja1234'])
      or position(lower(regexp_replace(coalesce(p_usuario, ''), '\s', '', 'g'))
                  in lower(regexp_replace(p_senha, '\s', '', 'g'))) > 0
         and length(coalesce(p_usuario, '')) >= 3
$$;
revoke execute on function public._senha_fraca(text, text) from public, anon, authenticated;

create or replace function public._usuario_json(u public.usuarios)
returns jsonb language sql immutable
set search_path = public
as $$
  select jsonb_build_object('id', u.id, 'usuario', u.usuario, 'nome', u.nome,
                            'papel', u.papel, 'lojaId', u.loja_id,
                            'senhaFraca', u.senha_fraca)
$$;
revoke execute on function public._usuario_json(public.usuarios) from public, anon, authenticated;

create or replace function public.entrar(p_usuario text, p_senha text)
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $$
declare
  u public.usuarios;
  v_token text;
  v_fraca boolean;
begin
  select * into u from public.usuarios
  where lower(usuario) = lower(trim(coalesce(p_usuario, '')));

  -- 5. Mesma resposta para usuário que não existe e senha errada: quem
  -- tenta adivinhar não descobre quais acessos existem.
  if not found then
    perform extensions.crypt(coalesce(p_senha, ''), extensions.gen_salt('bf'));
    return jsonb_build_object('ok', false, 'erro', 'Usuário ou senha incorretos.');
  end if;

  if u.bloqueado_ate is not null and u.bloqueado_ate > now() then
    return jsonb_build_object(
      'ok', false,
      'erro', 'Muitas tentativas erradas. Tente de novo em alguns minutos.'
    );
  end if;

  if extensions.crypt(coalesce(p_senha, ''), u.senha_hash) <> u.senha_hash then
    update public.usuarios
      set falhas = case when falhas + 1 >= 5 then 0 else falhas + 1 end,
          bloqueado_ate = case when falhas + 1 >= 5
                               then now() + interval '15 minutes'
                               else bloqueado_ate end
      where id = u.id;
    return jsonb_build_object('ok', false, 'erro', 'Usuário ou senha incorretos.');
  end if;

  v_fraca := public._senha_fraca(p_senha, u.usuario);
  update public.usuarios set falhas = 0, bloqueado_ate = null, senha_fraca = v_fraca
    where id = u.id
    returning * into u;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.sessoes (token_hash, usuario_id, expira_em)
  values (public._hash(v_token), u.id, now() + interval '30 days');

  return jsonb_build_object('ok', true, 'token', v_token, 'usuario', public._usuario_json(u));
end $$;
grant execute on function public.entrar(text, text) to anon, authenticated;

/**
 * Troca a senha de quem está logado. Pede a atual (sessão aberta num
 * computador esquecido não basta) e encerra as outras sessões do usuário.
 */
create or replace function public.trocar_senha(p_token text, p_atual text, p_nova text)
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $$
declare
  u public.usuarios;
begin
  select * into u from public._usuario_da_sessao(p_token);
  if u.id is null then
    return jsonb_build_object('ok', false, 'erro', 'sessao');
  end if;
  if u.bloqueado_ate is not null and u.bloqueado_ate > now() then
    return jsonb_build_object('ok', false, 'erro', 'Muitas tentativas erradas. Tente de novo em alguns minutos.');
  end if;
  if extensions.crypt(coalesce(p_atual, ''), u.senha_hash) <> u.senha_hash then
    update public.usuarios
      set falhas = case when falhas + 1 >= 5 then 0 else falhas + 1 end,
          bloqueado_ate = case when falhas + 1 >= 5
                               then now() + interval '15 minutes' else bloqueado_ate end
      where id = u.id;
    return jsonb_build_object('ok', false, 'erro', 'A senha atual não confere.');
  end if;
  if length(coalesce(p_nova, '')) > 72 then
    return jsonb_build_object('ok', false, 'erro', 'Use no máximo 72 caracteres.');
  end if;
  if public._senha_fraca(p_nova, u.usuario) then
    return jsonb_build_object('ok', false, 'erro',
      'Use pelo menos 8 caracteres, com letras e números, sem o nome do acesso.');
  end if;
  if p_nova = p_atual then
    return jsonb_build_object('ok', false, 'erro', 'A senha nova precisa ser diferente da atual.');
  end if;

  update public.usuarios
    set senha_hash = extensions.crypt(p_nova, extensions.gen_salt('bf')),
        senha_fraca = false, falhas = 0, bloqueado_ate = null
    where id = u.id;
  -- Quem estava logado com a senha antiga em outro lugar sai.
  update public.sessoes set expira_em = now()
    where usuario_id = u.id and token_hash <> public._hash(p_token) and expira_em > now();
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.trocar_senha(text, text, text) to anon, authenticated;

/**
 * Confere uma sessão para as rotas do servidor (Next) que gastam dinheiro
 * ou processam dado: agente, sugestão de campanha, planilhas. Devolve só o
 * mínimo: se vale, qual loja e qual papel.
 */
create or replace function public.conferir_sessao(p_token text)
returns jsonb language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  u public.usuarios;
begin
  select * into u from public._usuario_da_sessao(p_token);
  if u.id is null then
    return jsonb_build_object('ok', false);
  end if;
  return jsonb_build_object('ok', true, 'usuario', u.id, 'papel', u.papel, 'lojaId', u.loja_id);
end $$;
grant execute on function public.conferir_sessao(text) to anon, authenticated;
