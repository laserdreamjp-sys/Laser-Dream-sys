-- 0045_movimentacoes
-- Histórico de alterações (quem fez o quê e quando)
--
-- Prática trazida da Harmonize (tabela movimentacoes), adaptada à Laser Dream:
-- lá as telas gravam por funções do banco, que chamam registrar_movimentacao;
-- aqui as telas gravam direto nas tabelas, então quem registra é um gatilho.
-- A tabela não tem política de insert, update nem delete: ninguém reescreve o
-- histórico pela API. Só o administrador lê.
--
-- Não repete sales_history: na edição de venda, valor, status e forma de
-- pagamento continuam só em sales_history; aqui entram os demais campos, a
-- criação e a exclusão da venda.
-- A senha de exclusão permanente (org_settings) aparece só como ***.
-- A restauração de backup não gera milhares de linhas: desliga o registro
-- durante a carga e grava uma linha só, com a contagem por tabela.

create table if not exists public.movimentacoes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  ocorrido_em timestamptz not null default now(),
  usuario_id uuid references public.profiles(id) on delete set null,
  usuario_nome text not null,
  acao text not null check (acao in ('criado', 'editado', 'excluido', 'restaurado')),
  entidade text not null,
  entidade_id text,
  descricao text not null,
  detalhes jsonb not null default '{}'::jsonb
);

create index if not exists movimentacoes_org_data_idx
  on public.movimentacoes (organization_id, ocorrido_em desc);
create index if not exists movimentacoes_entidade_idx
  on public.movimentacoes (entidade, entidade_id);

comment on table public.movimentacoes is
  'Histórico de alterações: quem fez o quê e quando. Escrita só pelo gatilho fn_registrar_movimentacao e por restore_from_backup; sem política de escrita, para o histórico não poder ser reescrito.';

alter table public.movimentacoes enable row level security;

drop policy if exists movimentacoes_select on public.movimentacoes;
create policy movimentacoes_select on public.movimentacoes
  for select using (organization_id = current_organization_id() and is_admin());

revoke all on public.movimentacoes from anon;
grant select on public.movimentacoes to authenticated;

-- Gatilho genérico. Argumentos opcionais: 'ignorar:<coluna>' (fica fora da
-- comparação na edição) e 'ocultar:<coluna>' (valor trocado por ***).
create or replace function public.fn_registrar_movimentacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  r jsonb;
  v_ignorar text[] := array['updated_at', 'updated_by'];
  v_ocultar text[] := array[]::text[];
  v_arg text;
  v_k text;
  v_detalhes jsonb := '{}'::jsonb;
  v_acao text;
  v_org uuid;
  v_nome text;
  v_rotulo text;
begin
  if coalesce(current_setting('laser.sem_movimentacao', true), '') = 'on' then
    return null;
  end if;

  if tg_nargs > 0 then
    foreach v_arg in array tg_argv loop
      if v_arg like 'ignorar:%' then
        v_ignorar := v_ignorar || substr(v_arg, 9);
      elsif v_arg like 'ocultar:%' then
        v_ocultar := v_ocultar || substr(v_arg, 9);
      end if;
    end loop;
  end if;

  if tg_op = 'UPDATE' then
    v_acao := 'editado';
    for v_k in select jsonb_object_keys(v_new) loop
      if v_k = any(v_ignorar) then continue; end if;
      if (v_old -> v_k) is distinct from (v_new -> v_k) then
        v_detalhes := v_detalhes || jsonb_build_object(v_k, jsonb_build_object(
          'de', case when v_k = any(v_ocultar) then to_jsonb('***'::text) else v_old -> v_k end,
          'para', case when v_k = any(v_ocultar) then to_jsonb('***'::text) else v_new -> v_k end));
      end if;
    end loop;
    if v_detalhes = '{}'::jsonb then
      return null;
    end if;
  else
    v_acao := case when tg_op = 'INSERT' then 'criado' else 'excluido' end;
    v_detalhes := coalesce(v_new, v_old);
    foreach v_k in array v_ocultar loop
      if v_detalhes ? v_k then
        v_detalhes := v_detalhes || jsonb_build_object(v_k, '***');
      end if;
    end loop;
  end if;

  r := coalesce(v_new, v_old);
  v_org := coalesce((r ->> 'organization_id')::uuid, current_organization_id());

  select full_name into v_nome from profiles where id = auth.uid();

  v_rotulo := case tg_table_name
    when 'clients' then 'Cliente ' || coalesce(r ->> 'name', '')
    when 'sales' then 'Venda de R$ ' || replace(to_char((r ->> 'amount')::numeric, 'FM999999990.00'), '.', ',')
      || ' em ' || to_char((r ->> 'sale_date')::date, 'DD/MM/YYYY')
      || coalesce(' para ' || (select name from clients where id = (r ->> 'client_id')::uuid), '')
    when 'cash_transactions' then
      case when r ->> 'type' = 'entrada' then 'Entrada' else 'Saída' end
      || ' de caixa de R$ ' || replace(to_char((r ->> 'amount')::numeric, 'FM999999990.00'), '.', ',')
      || ' em ' || to_char((r ->> 'transaction_date')::date, 'DD/MM/YYYY')
      || coalesce(': ' || (r ->> 'description'), '')
    when 'cash_closures' then 'Fechamento de caixa de ' || to_char((r ->> 'closure_date')::date, 'DD/MM/YYYY')
      || coalesce(' (' || (select name from units where id = (r ->> 'unit_id')::uuid) || ')', '')
    when 'org_settings' then 'Configurações da clínica'
    when 'profiles' then 'Usuário ' || coalesce(r ->> 'full_name', '')
    when 'user_units' then 'Acesso de ' || coalesce((select full_name from profiles where id = (r ->> 'user_id')::uuid), 'usuário')
      || ' à unidade ' || coalesce((select name from units where id = (r ->> 'unit_id')::uuid), '')
    when 'invites' then 'Convite para ' || coalesce(r ->> 'email', '')
    when 'change_requests' then 'Solicitação (' || coalesce(r ->> 'action', '') || ' em ' || coalesce(r ->> 'table_name', '') || ')'
      || coalesce(': ' || (r ->> 'record_label'), '')
    when 'backups' then 'Backup ' || coalesce(r ->> 'kind', '')
    when 'payment_methods' then 'Forma de pagamento ' || coalesce(r ->> 'name', '')
    when 'procedures' then 'Procedimento ' || coalesce(r ->> 'name', '')
    when 'procedure_areas' then 'Área ' || coalesce(r ->> 'name', '')
    when 'sellers' then 'Vendedora ' || coalesce(r ->> 'name', '')
    when 'lead_origins' then 'Origem de lead ' || coalesce(r ->> 'name', '')
    when 'cash_categories' then 'Categoria de caixa ' || coalesce(r ->> 'name', '')
    when 'units' then 'Unidade ' || coalesce(r ->> 'name', '')
    when 'roles' then 'Papel ' || coalesce(r ->> 'name', '')
    else tg_table_name
  end;

  insert into movimentacoes (organization_id, usuario_id, usuario_nome, acao, entidade, entidade_id, descricao, detalhes)
  values (
    v_org,
    auth.uid(),
    coalesce(nullif(trim(v_nome), ''), case when auth.uid() is null then 'Sistema (automático)' else 'Usuário sem nome' end),
    v_acao,
    tg_table_name,
    coalesce(r ->> 'id', r ->> 'organization_id', r ->> 'user_id'),
    v_rotulo,
    v_detalhes
  );

  return null;
end;
$$;

revoke execute on function public.fn_registrar_movimentacao() from public, anon, authenticated;

-- Tabelas acompanhadas: dinheiro, clientes, acesso, configurações e catálogos.
-- O funil já tem opportunity_events e fica de fora.
do $$
declare
  t text;
begin
  foreach t in array array[
    'clients', 'cash_transactions', 'cash_closures', 'profiles', 'user_units', 'invites',
    'change_requests', 'backups', 'payment_methods', 'procedures', 'procedure_areas',
    'sellers', 'lead_origins', 'cash_categories', 'units', 'roles'
  ] loop
    execute format('drop trigger if exists trg_movimentacao on public.%I', t);
    execute format(
      'create trigger trg_movimentacao after insert or update or delete on public.%I
         for each row execute function public.fn_registrar_movimentacao()', t);
  end loop;
end $$;

drop trigger if exists trg_movimentacao on public.sales;
create trigger trg_movimentacao after insert or update or delete on public.sales
  for each row execute function public.fn_registrar_movimentacao(
    'ignorar:amount', 'ignorar:status', 'ignorar:payment_method_id');

drop trigger if exists trg_movimentacao on public.org_settings;
create trigger trg_movimentacao after insert or update or delete on public.org_settings
  for each row execute function public.fn_registrar_movimentacao('ocultar:senha_exclusao_permanente');

-- Restauração: mesmo corpo de antes, com o registro desligado durante a carga
-- e uma linha de resumo no fim.
create or replace function public.restore_from_backup(payload jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  tbl text;
  delete_order text[] := array[
    'change_requests','cash_closures','cash_transactions','sale_areas','sales',
    'procedure_areas','procedures','seller_pairs','sellers',
    'cash_categories','lead_origins','payment_methods','clients','org_settings'
  ];
  insert_order text[] := array[
    'org_settings','payment_methods','lead_origins','cash_categories',
    'sellers','seller_pairs','procedures','procedure_areas',
    'clients','sales','sale_areas','cash_transactions','cash_closures','change_requests'
  ];
  counts jsonb := '{}'::jsonb;
  n int;
  v_nome text;
begin
  if not is_admin() then
    raise exception 'Apenas administradores podem restaurar backups.';
  end if;

  perform set_config('laser.sem_movimentacao', 'on', true);

  alter table sales disable trigger trg_sale_cash_sync;
  alter table sales disable trigger trg_sales_classify;
  alter table sales disable trigger trg_sales_audit;

  foreach tbl in array delete_order loop
    execute format('delete from %I', tbl);
  end loop;

  foreach tbl in array insert_order loop
    if payload->'tables'->tbl is not null then
      execute format(
        'insert into %I select * from jsonb_populate_recordset(null::%I, $1)',
        tbl, tbl
      ) using (payload->'tables'->tbl);
      execute format('select count(*) from %I', tbl) into n;
      counts := counts || jsonb_build_object(tbl, n);
    end if;
  end loop;

  alter table sales enable trigger trg_sale_cash_sync;
  alter table sales enable trigger trg_sales_classify;
  alter table sales enable trigger trg_sales_audit;

  perform set_config('laser.sem_movimentacao', 'off', true);

  select full_name into v_nome from profiles where id = auth.uid();
  insert into movimentacoes (organization_id, usuario_id, usuario_nome, acao, entidade, entidade_id, descricao, detalhes)
  values (
    current_organization_id(), auth.uid(), coalesce(nullif(trim(v_nome), ''), 'Usuário sem nome'),
    'restaurado', 'backup', payload ->> 'generated_at',
    'Restauração do backup gerado em ' || coalesce(payload ->> 'generated_at', 'data desconhecida'),
    jsonb_build_object('linhas_por_tabela', counts)
  );

  return jsonb_build_object('ok', true, 'counts', counts);
exception when others then
  alter table sales enable trigger trg_sale_cash_sync;
  alter table sales enable trigger trg_sales_classify;
  alter table sales enable trigger trg_sales_audit;
  raise;
end;
$function$;
