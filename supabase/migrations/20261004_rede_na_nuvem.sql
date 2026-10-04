-- ------------------------------------------------------------------
-- A rede da Preço Baixo na nuvem.
--
-- Regra que sustenta todo o resto: NINGUÉM de fora lê tabela. O site e o
-- bot só chamam funções, e cada função confere quem está pedindo e o que
-- essa pessoa pode ver. A chave que vai no código do site é pública por
-- natureza; sem uma sessão válida, ela não abre nada.
-- ------------------------------------------------------------------

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.usuarios (
  id text primary key,
  usuario text not null unique,
  nome text not null,
  papel text not null check (papel in ('admin', 'loja')),
  loja_id text,
  senha_hash text not null,
  -- Trava contra adivinhar senha: 5 erros seguidos bloqueiam por 15 min.
  falhas int not null default 0,
  bloqueado_ate timestamptz
);

-- Guarda só o hash do token. Quem ler esta tabela não consegue se passar
-- por ninguém.
create table if not exists public.sessoes (
  token_hash text primary key,
  usuario_id text not null references public.usuarios (id) on delete cascade,
  criada_em timestamptz not null default now(),
  expira_em timestamptz not null
);

-- A lista de lojas da rede, numa linha só, com versão.
create table if not exists public.rede (
  id int primary key default 1 check (id = 1),
  lojas jsonb not null default '[]'::jsonb,
  versao int not null default 1
);

-- Tudo que pertence a uma loja, num documento com versão. A versão é o que
-- impede o bot e a pessoa no balcão de apagarem o trabalho um do outro:
-- quem grava com versão velha é recusado e precisa reler antes.
create table if not exists public.dados_loja (
  loja_id text primary key,
  dados jsonb not null,
  versao int not null default 1,
  atualizado_em timestamptz not null default now()
);

-- Chaves de máquina (o bot do WhatsApp), presas a uma loja só.
create table if not exists public.chaves_bot (
  token_hash text primary key,
  descricao text not null default '',
  loja_id text not null,
  criada_em timestamptz not null default now()
);

alter table public.usuarios enable row level security;
alter table public.sessoes enable row level security;
alter table public.rede enable row level security;
alter table public.dados_loja enable row level security;
alter table public.chaves_bot enable row level security;

revoke all on public.usuarios, public.sessoes, public.rede, public.dados_loja,
  public.chaves_bot from anon, authenticated;

-- ------------------------------------------------------------------
-- Funções internas
-- ------------------------------------------------------------------

create or replace function public._hash(p_texto text)
returns text language sql immutable
set search_path = public, extensions
as $$ select encode(extensions.digest(p_texto, 'sha256'), 'hex') $$;

create or replace function public._usuario_da_sessao(p_token text)
returns public.usuarios language sql stable security definer
set search_path = public, extensions
as $$
  select u.* from public.sessoes s
  join public.usuarios u on u.id = s.usuario_id
  where s.token_hash = public._hash(coalesce(p_token, ''))
    and s.expira_em > now()
$$;

create or replace function public._loja_do_bot(p_chave text)
returns text language sql stable security definer
set search_path = public, extensions
as $$
  select loja_id from public.chaves_bot
  where token_hash = public._hash(coalesce(p_chave, ''))
$$;

revoke execute on function public._hash(text) from public, anon, authenticated;
revoke execute on function public._usuario_da_sessao(text) from public, anon, authenticated;
revoke execute on function public._loja_do_bot(text) from public, anon, authenticated;

-- ------------------------------------------------------------------
-- Acesso
-- ------------------------------------------------------------------

create or replace function public.entrar(p_usuario text, p_senha text)
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $$
declare
  u public.usuarios;
  v_token text;
begin
  select * into u from public.usuarios
  where lower(usuario) = lower(trim(coalesce(p_usuario, '')));

  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Este acesso não existe.');
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
    return jsonb_build_object('ok', false, 'erro', 'Senha incorreta.');
  end if;

  update public.usuarios set falhas = 0, bloqueado_ate = null where id = u.id;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.sessoes (token_hash, usuario_id, expira_em)
  values (public._hash(v_token), u.id, now() + interval '30 days');

  return jsonb_build_object(
    'ok', true,
    'token', v_token,
    'usuario', jsonb_build_object(
      'id', u.id, 'usuario', u.usuario, 'nome', u.nome,
      'papel', u.papel, 'lojaId', u.loja_id
    )
  );
end $$;

-- Sair vence a sessão em vez de apagar: o efeito é o mesmo para quem tenta
-- usar o token depois, e fica o registro de quando a pessoa saiu.
create or replace function public.sair(p_token text)
returns jsonb language sql security definer
set search_path = public, extensions
as $$
  update public.sessoes set expira_em = now()
    where token_hash = public._hash(coalesce(p_token, '')) and expira_em > now();
  select jsonb_build_object('ok', true);
$$;

-- ------------------------------------------------------------------
-- Leitura
-- ------------------------------------------------------------------

/** O que esta pessoa pode ver. Loja só vê a própria; admin vê a rede. */
create or replace function public.ler_rede(p_token text)
returns jsonb language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  u public.usuarios;
  r public.rede;
  v_lojas jsonb;
  v_dados jsonb;
begin
  select * into u from public._usuario_da_sessao(p_token);
  if u.id is null then
    return jsonb_build_object('ok', false, 'erro', 'sessao');
  end if;

  select * into r from public.rede where id = 1;

  if u.papel = 'admin' then
    v_lojas := coalesce(r.lojas, '[]'::jsonb);
    select coalesce(jsonb_object_agg(loja_id,
             jsonb_build_object('dados', dados, 'versao', versao)), '{}'::jsonb)
      into v_dados from public.dados_loja;
  else
    select coalesce(jsonb_agg(l), '[]'::jsonb) into v_lojas
      from jsonb_array_elements(coalesce(r.lojas, '[]'::jsonb)) l
      where l->>'id' = u.loja_id;
    select coalesce(jsonb_object_agg(loja_id,
             jsonb_build_object('dados', dados, 'versao', versao)), '{}'::jsonb)
      into v_dados from public.dados_loja where loja_id = u.loja_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'usuario', jsonb_build_object(
      'id', u.id, 'usuario', u.usuario, 'nome', u.nome,
      'papel', u.papel, 'lojaId', u.loja_id
    ),
    'lojas', v_lojas,
    'versaoRede', coalesce(r.versao, 0),
    'dados', v_dados
  );
end $$;

/** Só os números de versão. É o que o painel consulta a cada poucos
    segundos para saber se precisa baixar tudo de novo. */
create or replace function public.versoes(p_token text)
returns jsonb language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  u public.usuarios;
  v jsonb;
begin
  select * into u from public._usuario_da_sessao(p_token);
  if u.id is null then
    return jsonb_build_object('ok', false, 'erro', 'sessao');
  end if;

  select coalesce(jsonb_object_agg(loja_id, versao), '{}'::jsonb) into v
    from public.dados_loja
    where u.papel = 'admin' or loja_id = u.loja_id;

  return jsonb_build_object(
    'ok', true,
    'versaoRede', (select versao from public.rede where id = 1),
    'lojas', v
  );
end $$;

-- ------------------------------------------------------------------
-- Gravação
-- ------------------------------------------------------------------

create or replace function public._gravar_dados(
  p_loja_id text, p_dados jsonb, p_versao int
) returns jsonb language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_nova int;
  v_atual int;
begin
  if p_dados is null or jsonb_typeof(p_dados) <> 'object' then
    return jsonb_build_object('ok', false, 'erro', 'Dados inválidos.');
  end if;
  -- Teto de tamanho: um documento de loja não tem motivo para passar disso,
  -- e o teto impede que alguém use o banco como depósito.
  if pg_column_size(p_dados) > 4000000 then
    return jsonb_build_object('ok', false, 'erro', 'Dados grandes demais.');
  end if;

  if p_versao = 0 then
    insert into public.dados_loja (loja_id, dados, versao)
    values (p_loja_id, p_dados, 1)
    on conflict (loja_id) do nothing;
    if found then
      return jsonb_build_object('ok', true, 'versao', 1);
    end if;
  else
    update public.dados_loja
      set dados = p_dados, versao = versao + 1, atualizado_em = now()
      where loja_id = p_loja_id and versao = p_versao
      returning versao into v_nova;
    if v_nova is not null then
      return jsonb_build_object('ok', true, 'versao', v_nova);
    end if;
  end if;

  select versao into v_atual from public.dados_loja where loja_id = p_loja_id;
  return jsonb_build_object('ok', false, 'conflito', true, 'versao', coalesce(v_atual, 0));
end $$;

revoke execute on function public._gravar_dados(text, jsonb, int) from public, anon, authenticated;

create or replace function public.gravar_dados(
  p_token text, p_loja_id text, p_dados jsonb, p_versao int
) returns jsonb language plpgsql security definer
set search_path = public, extensions
as $$
declare
  u public.usuarios;
begin
  select * into u from public._usuario_da_sessao(p_token);
  if u.id is null then
    return jsonb_build_object('ok', false, 'erro', 'sessao');
  end if;
  if u.papel <> 'admin' and u.loja_id is distinct from p_loja_id then
    return jsonb_build_object('ok', false, 'erro', 'Sem acesso a esta loja.');
  end if;
  return public._gravar_dados(p_loja_id, p_dados, p_versao);
end $$;

/** A lista de lojas. Admin grava a lista toda; quem opera uma loja só
    consegue mudar o cadastro da própria, e o resto da lista é ignorado. */
create or replace function public.gravar_lojas(
  p_token text, p_lojas jsonb, p_versao int
) returns jsonb language plpgsql security definer
set search_path = public, extensions
as $$
declare
  u public.usuarios;
  r public.rede;
  v_nova jsonb;
  v_minha jsonb;
begin
  select * into u from public._usuario_da_sessao(p_token);
  if u.id is null then
    return jsonb_build_object('ok', false, 'erro', 'sessao');
  end if;
  if p_lojas is null or jsonb_typeof(p_lojas) <> 'array' then
    return jsonb_build_object('ok', false, 'erro', 'Lista inválida.');
  end if;

  select * into r from public.rede where id = 1 for update;
  if r.versao <> p_versao then
    return jsonb_build_object('ok', false, 'conflito', true, 'versao', r.versao);
  end if;

  if u.papel = 'admin' then
    v_nova := p_lojas;
  else
    select l into v_minha from jsonb_array_elements(p_lojas) l
      where l->>'id' = u.loja_id limit 1;
    if v_minha is null then
      return jsonb_build_object('ok', true, 'versao', r.versao);
    end if;
    select coalesce(jsonb_agg(
             case when l->>'id' = u.loja_id then v_minha else l end), '[]'::jsonb)
      into v_nova from jsonb_array_elements(r.lojas) l;
  end if;

  update public.rede set lojas = v_nova, versao = versao + 1 where id = 1
    returning versao into r.versao;
  return jsonb_build_object('ok', true, 'versao', r.versao);
end $$;

-- ------------------------------------------------------------------
-- Bot do WhatsApp
-- ------------------------------------------------------------------

create or replace function public.bot_ler(p_chave text)
returns jsonb language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  v_loja text;
  v_perfil jsonb;
  d public.dados_loja;
begin
  v_loja := public._loja_do_bot(p_chave);
  if v_loja is null then
    return jsonb_build_object('ok', false, 'erro', 'Chave inválida.');
  end if;
  select l into v_perfil from public.rede r, jsonb_array_elements(r.lojas) l
    where r.id = 1 and l->>'id' = v_loja limit 1;
  select * into d from public.dados_loja where loja_id = v_loja;
  return jsonb_build_object(
    'ok', true, 'lojaId', v_loja, 'loja', v_perfil,
    'dados', d.dados, 'versao', coalesce(d.versao, 0)
  );
end $$;

create or replace function public.bot_gravar(p_chave text, p_dados jsonb, p_versao int)
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
  return public._gravar_dados(v_loja, p_dados, p_versao);
end $$;

grant execute on function public.entrar(text, text) to anon, authenticated;
grant execute on function public.sair(text) to anon, authenticated;
grant execute on function public.ler_rede(text) to anon, authenticated;
grant execute on function public.versoes(text) to anon, authenticated;
grant execute on function public.gravar_dados(text, text, jsonb, int) to anon, authenticated;
grant execute on function public.gravar_lojas(text, jsonb, int) to anon, authenticated;
grant execute on function public.bot_ler(text) to anon, authenticated;
grant execute on function public.bot_gravar(text, jsonb, int) to anon, authenticated;
