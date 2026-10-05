-- ------------------------------------------------------------------
-- Um registro por item, em vez de um documento por loja.
--
-- O modelo anterior (dados_loja) guardava a loja inteira num JSON só. Isso
-- tinha dois tetos: o documento não podia passar de 4 MB (o histórico de
-- pedidos e conversas chega lá em poucos meses), e cada mudança fazia todas
-- as telas baixarem o documento inteiro de novo, o que estoura a franquia de
-- tráfego do plano gratuito.
--
-- Aqui cada cliente, produto, conversa e pedido é uma linha, com versão
-- própria. Duas pessoas mexendo em pedidos diferentes não brigam mais, e a
-- tela baixa só o que mudou desde a última vez (pelo número de sequência).
--
-- A regra de sempre continua: ninguém de fora lê tabela. Tudo passa por
-- funções que conferem a sessão.
-- ------------------------------------------------------------------

create sequence if not exists public.seq_registros;

create table if not exists public.registros (
  loja_id text not null,
  colecao text not null check (colecao in (
    'loja', 'ajustes', 'estado', 'clientes', 'produtos', 'campanhas',
    'conversas', 'pedidos', 'eventos', 'envios'
  )),
  id text not null,
  dados jsonb not null,
  versao int not null default 1,
  -- Cresce a cada gravação, no banco inteiro. A tela guarda o maior número
  -- que já viu e pergunta "o que mudou depois dele?".
  seq bigint not null,
  -- O instante que importa para consultar por período: criação do pedido,
  -- última mensagem da conversa, momento do evento.
  momento bigint not null default 0,
  -- Apagar marca em vez de remover: a tela de outra pessoa precisa ficar
  -- sabendo que o item sumiu, e só fica sabendo se a linha continuar lá.
  apagado boolean not null default false,
  atualizado_em timestamptz not null default now(),
  primary key (loja_id, colecao, id)
);

create index if not exists registros_seq on public.registros (seq);
create index if not exists registros_momento
  on public.registros (loja_id, colecao, momento desc);

-- Senha curta da área de ajustes da loja (dados da loja e do agente).
create table if not exists public.pins_loja (
  loja_id text primary key,
  pin_hash text not null,
  falhas int not null default 0,
  bloqueado_ate timestamptz
);

-- Até quando esta sessão pode mexer nos ajustes protegidos.
alter table public.sessoes add column if not exists ajustes_ate timestamptz;

alter table public.registros enable row level security;
alter table public.pins_loja enable row level security;
revoke all on public.registros, public.pins_loja from anon, authenticated;
revoke all on sequence public.seq_registros from anon, authenticated;

-- ------------------------------------------------------------------
-- Ajudas internas
-- ------------------------------------------------------------------

create or replace function public._numero(p_texto text)
returns bigint language sql immutable
set search_path = public
as $$
  select case when p_texto ~ '^-?[0-9]+(\.[0-9]+)?$'
              then floor(p_texto::numeric)::bigint else 0 end
$$;

create or replace function public._momento(p_colecao text, p_dados jsonb)
returns bigint language sql immutable
set search_path = public
as $$
  select case p_colecao
    when 'conversas' then public._numero(p_dados->>'atualizadaEm')
    when 'eventos' then public._numero(p_dados->>'em')
    when 'loja' then public._numero(p_dados->>'criadaEm')
    else public._numero(p_dados->>'criadoEm')
  end
$$;

/** As lojas que esta sessão enxerga. Admin: todas. Loja: só a dela. */
create or replace function public._lojas_visiveis(u public.usuarios)
returns text[] language sql stable security definer
set search_path = public
as $$
  select case
    when u.papel = 'admin' then coalesce(
      (select array_agg(distinct r.loja_id) from public.registros r
        where r.colecao = 'loja' and not r.apagado), '{}'::text[])
    else array[u.loja_id]
  end
$$;

/**
 * O que a tela carrega ao abrir: tudo que está em uso, sem o histórico
 * antigo. Pedido fechado há mais de 60 dias e conversa resolvida há mais de
 * 90 ficam no banco e são buscados sob demanda (histórico, ficha do cliente).
 */
create or replace function public._quentes(p_lojas text[])
returns jsonb language sql stable security definer
set search_path = public
as $$
  with agora as (
    select (extract(epoch from now()) * 1000)::bigint as ms
  ),
  linhas as (
    select r.loja_id, r.colecao, r.id, r.dados, r.versao
    from public.registros r, agora
    where r.loja_id = any(p_lojas) and not r.apagado and (
      r.colecao in ('loja', 'ajustes', 'estado', 'clientes', 'produtos', 'campanhas')
      or (r.colecao = 'conversas' and (
            coalesce(r.dados->>'status', '') <> 'resolvida'
            or r.momento > agora.ms - 90::bigint * 86400000))
      or (r.colecao = 'pedidos' and (
            coalesce(r.dados->>'status', '') not in ('entregue', 'cancelado')
            or r.momento > agora.ms - 60::bigint * 86400000))
      or (r.colecao = 'envios' and r.momento > agora.ms - 7::bigint * 86400000)
    )
    union all
    select e.loja_id, e.colecao, e.id, e.dados, e.versao
    from unnest(p_lojas) as l(loja)
    cross join lateral (
      select r.* from public.registros r
      where r.loja_id = l.loja and r.colecao = 'eventos' and not r.apagado
      order by r.momento desc limit 150
    ) e
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'l', loja_id, 'c', colecao, 'i', id, 'd', dados, 'v', versao)), '[]'::jsonb)
  from linhas
$$;

create or replace function public._mudancas(p_lojas text[], p_desde bigint)
returns jsonb language plpgsql stable security definer
set search_path = public
as $$
declare
  v_max bigint;
  v_qtd int;
  v_linhas jsonb;
begin
  select coalesce(max(seq), 0) into v_max from public.registros;
  select count(*) into v_qtd from public.registros
    where seq > p_desde and loja_id = any(p_lojas);
  -- Ficou muito tempo fora (aba dormindo, internet caída): é mais barato
  -- carregar de novo do que receber milhares de mudanças uma a uma.
  if v_qtd > 1500 then
    return jsonb_build_object('ok', true, 'recarregar', true, 'seq', v_max);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'l', loja_id, 'c', colecao, 'i', id,
      'd', case when apagado then null else dados end,
      'v', versao, 'x', apagado) order by seq), '[]'::jsonb)
    into v_linhas
    from public.registros
    where seq > p_desde and loja_id = any(p_lojas);
  return jsonb_build_object('ok', true, 'seq', v_max, 'registros', v_linhas);
end $$;

/**
 * Grava um lote de mudanças, tudo ou nada.
 *
 * Cada item diz a versão que a tela tinha. Se alguém gravou antes (versão
 * diferente), nada é gravado e a resposta traz o estado atual dos itens em
 * conflito: a tela reaplica a mesma mudança em cima dele e tenta de novo.
 *
 * As gravações passam uma de cada vez (trava única). É o que garante que os
 * números de sequência aparecem para quem lê sempre em ordem, sem buraco:
 * sem isso, uma tela poderia pular uma mudança que ainda estava sendo
 * gravada.
 */
create or replace function public._gravar(
  p_lojas text[], p_admin boolean, p_protegido_ok boolean,
  p_colecoes text[], p_ops jsonb
) returns jsonb language plpgsql security definer
set search_path = public
as $$
declare
  op jsonb;
  v_l text; v_c text; v_i text; v_d jsonb; v_v int;
  atual public.registros;
  v_conflitos jsonb := '[]'::jsonb;
  v_feitos jsonb := '[]'::jsonb;
  v_seq bigint := 0;
  v_nova int;
begin
  if p_ops is null or jsonb_typeof(p_ops) <> 'array' then
    return jsonb_build_object('ok', false, 'erro', 'Lote inválido.');
  end if;
  if jsonb_array_length(p_ops) = 0 then
    return jsonb_build_object('ok', true, 'ops', '[]'::jsonb);
  end if;
  if jsonb_array_length(p_ops) > 300 then
    return jsonb_build_object('ok', false, 'erro', 'Lote grande demais.');
  end if;

  perform pg_advisory_xact_lock(4210001);

  for op in select * from jsonb_array_elements(p_ops) loop
    v_l := op->>'l'; v_c := op->>'c'; v_i := op->>'i';
    v_d := op->'d'; v_v := coalesce(public._numero(op->>'v'), 0)::int;

    if v_l is null or v_c is null or v_i is null or length(v_i) > 120 then
      return jsonb_build_object('ok', false, 'erro', 'Item inválido.');
    end if;
    if not (v_c = any(p_colecoes)) then
      return jsonb_build_object('ok', false, 'erro', 'Sem permissão para ' || v_c || '.');
    end if;
    -- Admin pode criar loja nova; fora isso, só nas lojas que enxerga.
    if not (v_l = any(p_lojas)) and not (p_admin and v_c = 'loja') then
      return jsonb_build_object('ok', false, 'erro', 'Sem acesso a esta loja.');
    end if;
    if v_c in ('loja', 'ajustes') and not p_protegido_ok then
      return jsonb_build_object('ok', false, 'erro', 'protegido');
    end if;
    if v_d is not null and jsonb_typeof(v_d) not in ('object', 'null') then
      return jsonb_build_object('ok', false, 'erro', 'Dados inválidos.');
    end if;
    if v_d is not null and pg_column_size(v_d) > 600000 then
      return jsonb_build_object('ok', false, 'erro', 'Item grande demais.');
    end if;

    select * into atual from public.registros
      where loja_id = v_l and colecao = v_c and id = v_i for update;
    if coalesce(atual.versao, 0) <> v_v then
      v_conflitos := v_conflitos || jsonb_build_object(
        'l', v_l, 'c', v_c, 'i', v_i,
        'd', case when atual.apagado or atual.versao is null then null else atual.dados end,
        'v', coalesce(atual.versao, 0),
        'x', coalesce(atual.apagado, true));
    end if;
  end loop;

  if jsonb_array_length(v_conflitos) > 0 then
    return jsonb_build_object('ok', false, 'conflito', true, 'atuais', v_conflitos);
  end if;

  for op in select * from jsonb_array_elements(p_ops) loop
    v_l := op->>'l'; v_c := op->>'c'; v_i := op->>'i'; v_d := op->'d';
    v_seq := nextval('public.seq_registros');
    v_nova := null;

    if v_d is null or jsonb_typeof(v_d) = 'null' then
      update public.registros
        set apagado = true, versao = versao + 1, seq = v_seq, atualizado_em = now()
        where loja_id = v_l and colecao = v_c and id = v_i
        returning versao into v_nova;
    else
      insert into public.registros (loja_id, colecao, id, dados, versao, seq, momento)
      values (v_l, v_c, v_i, v_d, 1, v_seq, public._momento(v_c, v_d))
      on conflict (loja_id, colecao, id) do update
        set dados = excluded.dados, versao = public.registros.versao + 1,
            seq = excluded.seq, momento = excluded.momento,
            apagado = false, atualizado_em = now()
      returning versao into v_nova;
    end if;

    v_feitos := v_feitos || jsonb_build_object(
      'l', v_l, 'c', v_c, 'i', v_i, 'v', coalesce(v_nova, 0));
  end loop;

  return jsonb_build_object('ok', true, 'ops', v_feitos, 'seq', v_seq);
end $$;

create or replace function public._buscar(
  p_lojas text[], p_loja text, p_colecao text, p_de bigint, p_ate bigint, p_limite int
) returns jsonb language sql stable security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'l', loja_id, 'c', colecao, 'i', id, 'd', dados, 'v', versao)
      order by momento desc), '[]'::jsonb)
  from (
    select * from public.registros
    where p_loja = any(p_lojas) and loja_id = p_loja and colecao = p_colecao
      and p_colecao in ('pedidos', 'conversas', 'eventos', 'envios')
      and not apagado and momento between p_de and p_ate
    order by momento desc
    limit least(greatest(coalesce(p_limite, 2000), 1), 10000)
  ) t
$$;

revoke execute on function public._numero(text) from public, anon, authenticated;
revoke execute on function public._momento(text, jsonb) from public, anon, authenticated;
revoke execute on function public._lojas_visiveis(public.usuarios) from public, anon, authenticated;
revoke execute on function public._quentes(text[]) from public, anon, authenticated;
revoke execute on function public._mudancas(text[], bigint) from public, anon, authenticated;
revoke execute on function public._gravar(text[], boolean, boolean, text[], jsonb) from public, anon, authenticated;
revoke execute on function public._buscar(text[], text, text, bigint, bigint, int) from public, anon, authenticated;

-- ------------------------------------------------------------------
-- Funções públicas: painel
-- ------------------------------------------------------------------

create or replace function public._usuario_json(u public.usuarios)
returns jsonb language sql immutable
set search_path = public
as $$
  select jsonb_build_object('id', u.id, 'usuario', u.usuario, 'nome', u.nome,
                            'papel', u.papel, 'lojaId', u.loja_id)
$$;
revoke execute on function public._usuario_json(public.usuarios) from public, anon, authenticated;

create or replace function public.carregar(p_token text)
returns jsonb language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  u public.usuarios;
  v_lojas text[];
  v_ate timestamptz;
begin
  select * into u from public._usuario_da_sessao(p_token);
  if u.id is null then
    return jsonb_build_object('ok', false, 'erro', 'sessao');
  end if;
  v_lojas := public._lojas_visiveis(u);
  select ajustes_ate into v_ate from public.sessoes
    where token_hash = public._hash(p_token);
  return jsonb_build_object(
    'ok', true,
    'usuario', public._usuario_json(u),
    'seq', (select coalesce(max(seq), 0) from public.registros),
    'ajustesAte', case when v_ate > now()
                       then (extract(epoch from v_ate) * 1000)::bigint else 0 end,
    'registros', public._quentes(v_lojas)
  );
end $$;

create or replace function public.mudancas(p_token text, p_desde bigint)
returns jsonb language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  u public.usuarios;
begin
  select * into u from public._usuario_da_sessao(p_token);
  if u.id is null then
    return jsonb_build_object('ok', false, 'erro', 'sessao');
  end if;
  return public._mudancas(public._lojas_visiveis(u), coalesce(p_desde, 0));
end $$;

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
  select ajustes_ate into v_ate from public.sessoes
    where token_hash = public._hash(p_token);
  return public._gravar(
    public._lojas_visiveis(u),
    u.papel = 'admin',
    u.papel = 'admin' or coalesce(v_ate > now(), false),
    array['loja', 'ajustes', 'estado', 'clientes', 'produtos', 'campanhas',
          'conversas', 'pedidos', 'eventos', 'envios'],
    p_ops);
end $$;

/** Histórico sob demanda: pedidos, conversas, eventos ou envios de um período. */
create or replace function public.buscar(
  p_token text, p_loja text, p_colecao text, p_de bigint, p_ate bigint, p_limite int
) returns jsonb language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  u public.usuarios;
begin
  select * into u from public._usuario_da_sessao(p_token);
  if u.id is null then
    return jsonb_build_object('ok', false, 'erro', 'sessao');
  end if;
  return jsonb_build_object('ok', true, 'registros',
    public._buscar(public._lojas_visiveis(u), p_loja, p_colecao, p_de, p_ate, p_limite));
end $$;

/** Tudo de um cliente (conversas e pedidos), pelo telefone, sem limite de data. */
create or replace function public.historico_cliente(
  p_token text, p_loja text, p_digitos text
) returns jsonb language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  u public.usuarios;
  v_fim text := right(regexp_replace(coalesce(p_digitos, ''), '\D', '', 'g'), 8);
begin
  select * into u from public._usuario_da_sessao(p_token);
  if u.id is null then
    return jsonb_build_object('ok', false, 'erro', 'sessao');
  end if;
  if not (p_loja = any(public._lojas_visiveis(u))) then
    return jsonb_build_object('ok', false, 'erro', 'Sem acesso a esta loja.');
  end if;
  if length(v_fim) < 8 then
    return jsonb_build_object('ok', true, 'registros', '[]'::jsonb);
  end if;
  return jsonb_build_object('ok', true, 'registros', (
    select coalesce(jsonb_agg(jsonb_build_object(
        'l', loja_id, 'c', colecao, 'i', id, 'd', dados, 'v', versao)
        order by momento desc), '[]'::jsonb)
    from (
      select * from public.registros
      where loja_id = p_loja and colecao in ('conversas', 'pedidos') and not apagado
        and right(regexp_replace(coalesce(dados->>'telefone', ''), '\D', '', 'g'), 8) = v_fim
      order by momento desc limit 500
    ) t));
end $$;

-- ------------------------------------------------------------------
-- Área protegida da loja (dados da loja e conhecimento do agente)
-- ------------------------------------------------------------------

create or replace function public.liberar_ajustes(p_token text, p_pin text)
returns jsonb language plpgsql security definer
set search_path = public, extensions
as $$
declare
  u public.usuarios;
  p public.pins_loja;
  v_ate timestamptz := now() + interval '20 minutes';
begin
  select * into u from public._usuario_da_sessao(p_token);
  if u.id is null then
    return jsonb_build_object('ok', false, 'erro', 'sessao');
  end if;

  -- O administrador já entrou com a senha dele; não precisa de outra.
  if u.papel <> 'admin' then
    select * into p from public.pins_loja where loja_id = u.loja_id;
    if not found then
      return jsonb_build_object('ok', false, 'erro', 'Esta loja ainda não tem senha de ajustes. Peça ao administrador.');
    end if;
    if p.bloqueado_ate is not null and p.bloqueado_ate > now() then
      return jsonb_build_object('ok', false, 'erro', 'Muitas tentativas erradas. Tente de novo em alguns minutos.');
    end if;
    if extensions.crypt(coalesce(p_pin, ''), p.pin_hash) <> p.pin_hash then
      update public.pins_loja
        set falhas = case when falhas + 1 >= 5 then 0 else falhas + 1 end,
            bloqueado_ate = case when falhas + 1 >= 5
                                 then now() + interval '15 minutes' else bloqueado_ate end
        where loja_id = p.loja_id;
      return jsonb_build_object('ok', false, 'erro', 'Senha incorreta.');
    end if;
    update public.pins_loja set falhas = 0, bloqueado_ate = null where loja_id = p.loja_id;
  end if;

  update public.sessoes set ajustes_ate = v_ate
    where token_hash = public._hash(p_token);
  return jsonb_build_object('ok', true,
    'ate', (extract(epoch from v_ate) * 1000)::bigint);
end $$;

create or replace function public.encerrar_ajustes(p_token text)
returns jsonb language sql security definer
set search_path = public, extensions
as $$
  update public.sessoes set ajustes_ate = now()
    where token_hash = public._hash(coalesce(p_token, ''));
  select jsonb_build_object('ok', true);
$$;

create or replace function public.trocar_pin(p_token text, p_loja text, p_novo text)
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
  select ajustes_ate into v_ate from public.sessoes
    where token_hash = public._hash(p_token);
  if u.papel <> 'admin' and (u.loja_id is distinct from p_loja or not coalesce(v_ate > now(), false)) then
    return jsonb_build_object('ok', false, 'erro', 'Abra a área de ajustes antes de trocar a senha.');
  end if;
  if coalesce(p_novo, '') !~ '^[0-9]{4,8}$' then
    return jsonb_build_object('ok', false, 'erro', 'A senha precisa ter de 4 a 8 números.');
  end if;
  insert into public.pins_loja (loja_id, pin_hash)
    values (p_loja, extensions.crypt(p_novo, extensions.gen_salt('bf')))
    on conflict (loja_id) do update
      set pin_hash = excluded.pin_hash, falhas = 0, bloqueado_ate = null;
  return jsonb_build_object('ok', true);
end $$;

-- ------------------------------------------------------------------
-- Funções públicas: bot do WhatsApp
-- ------------------------------------------------------------------

create or replace function public.bot_carregar(p_chave text)
returns jsonb language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  v_loja text;
begin
  v_loja := public._loja_do_bot(p_chave);
  if v_loja is null then
    return jsonb_build_object('ok', false, 'erro', 'Chave inválida.');
  end if;
  return jsonb_build_object(
    'ok', true, 'lojaId', v_loja,
    'seq', (select coalesce(max(seq), 0) from public.registros),
    'registros', public._quentes(array[v_loja]));
end $$;

create or replace function public.bot_mudancas(p_chave text, p_desde bigint)
returns jsonb language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  v_loja text;
begin
  v_loja := public._loja_do_bot(p_chave);
  if v_loja is null then
    return jsonb_build_object('ok', false, 'erro', 'Chave inválida.');
  end if;
  return public._mudancas(array[v_loja], coalesce(p_desde, 0));
end $$;

/** O bot grava atendimento, nunca cadastro da loja, catálogo ou ajustes. */
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
  return public._gravar(array[v_loja], false, false,
    array['estado', 'clientes', 'conversas', 'pedidos', 'eventos', 'envios'], p_ops);
end $$;

-- ------------------------------------------------------------------
-- Mídia (fotos, áudios, arquivos)
--
-- Os arquivos ficam num balde privado do Storage. Quem entrega é a função
-- de borda `midia`, que roda dentro do Supabase com a chave de serviço e
-- pergunta a esta função se quem pediu pode ver aquela loja. A chave de
-- serviço nunca sai do Supabase.
-- ------------------------------------------------------------------

create or replace function public.acesso_midia(p_token text, p_chave text, p_loja text)
returns boolean language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  u public.usuarios;
begin
  if coalesce(p_chave, '') <> '' then
    return public._loja_do_bot(p_chave) = p_loja;
  end if;
  select * into u from public._usuario_da_sessao(p_token);
  if u.id is null then return false; end if;
  return p_loja = any(public._lojas_visiveis(u));
end $$;

revoke execute on function public.acesso_midia(text, text, text) from public, anon, authenticated;
grant execute on function public.acesso_midia(text, text, text) to service_role;

insert into storage.buckets (id, name, public, file_size_limit)
values ('midia', 'midia', false, 16777216)
on conflict (id) do nothing;

grant execute on function public.carregar(text) to anon, authenticated;
grant execute on function public.mudancas(text, bigint) to anon, authenticated;
grant execute on function public.gravar(text, jsonb) to anon, authenticated;
grant execute on function public.buscar(text, text, text, bigint, bigint, int) to anon, authenticated;
grant execute on function public.historico_cliente(text, text, text) to anon, authenticated;
grant execute on function public.liberar_ajustes(text, text) to anon, authenticated;
grant execute on function public.encerrar_ajustes(text) to anon, authenticated;
grant execute on function public.trocar_pin(text, text, text) to anon, authenticated;
grant execute on function public.bot_carregar(text) to anon, authenticated;
grant execute on function public.bot_mudancas(text, bigint) to anon, authenticated;
grant execute on function public.bot_gravar_ops(text, jsonb) to anon, authenticated;
