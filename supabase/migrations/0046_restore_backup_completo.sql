-- 0046_restore_backup_completo
-- Restauração de backup cobre 32 tabelas, com conferência e sem apagar às cegas
--
-- Antes: restore_from_backup apagava e recarregava 14 tabelas. Funil, orçamentos,
-- etiquetas, pacotes, histórico de vendas e log de unificação ficavam de fora, e
-- a restauração falharia assim que existisse um lead ou orçamento (eles dependem
-- de clientes, vendedoras e procedimentos, que a função apaga).
--
-- Agora (backup version 3, 32 tabelas):
-- 1. O arquivo precisa trazer todas as 32 tabelas; faltando alguma, nada é alterado.
-- 2. Se o arquivo traz "counts", cada contagem tem de bater com o tamanho da lista.
-- 3. A ordem de exclusão é o inverso da de inserção (filhos antes dos pais).
-- 4. A dependência circular entre venda e lead (sales.opportunity_id e
--    opportunities.sale_id) é desfeita antes de apagar e refeita no fim.
-- 5. Depois de cada tabela, a quantidade gravada é conferida; se divergir, tudo é
--    desfeito (a função roda numa transação só).
-- 6. Backup antigo (version 2, 14 tabelas) ainda é aceito, mas só se não houver
--    leads, orçamentos nem pacotes no banco, porque ele não os recarrega.
-- 7. O histórico de alterações não é apagado nem recarregado; a restauração
--    grava uma linha de resumo nele.

create or replace function public.restore_from_backup(payload jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_versao int := coalesce(nullif(payload ->> 'version', '')::int, 0);
  insert_v2 text[] := array[
    'org_settings','payment_methods','lead_origins','cash_categories',
    'sellers','seller_pairs','procedures','procedure_areas',
    'clients','sales','sale_areas','cash_transactions','cash_closures','change_requests'
  ];
  insert_v3 text[] := array[
    'org_settings','payment_methods','lead_origins','cash_categories',
    'sellers','seller_pairs','procedures','procedure_areas','packages',
    'funnels','loss_reasons','tags','pipeline_stages',
    'clients',
    'opportunities','opportunity_areas','opportunity_interest_areas','opportunity_events',
    'opportunity_notes','opportunity_tags','opportunity_tasks',
    'sales','sale_areas','sales_history',
    'cash_transactions','cash_closures','change_requests',
    'budgets','budget_items','budget_item_areas',
    'client_merge_log','duplicate_flags'
  ];
  insert_order text[];
  delete_order text[];
  tbl text;
  faltando text;
  linhas jsonb;
  n int;
  esperado int;
  v_nome text;
  counts jsonb := '{}'::jsonb;
begin
  if not is_admin() then
    raise exception 'Apenas administradores podem restaurar backups.';
  end if;

  if v_versao not in (2, 3) then
    raise exception 'Formato de backup não reconhecido (version %). Gere um backup novo. Nada foi alterado.',
      coalesce(payload ->> 'version', 'ausente');
  end if;
  if jsonb_typeof(payload -> 'tables') is distinct from 'object' then
    raise exception 'O backup não traz a lista de tabelas. Nada foi alterado.';
  end if;

  if v_versao = 3 then
    insert_order := insert_v3;
    select string_agg(t, ', ') into faltando
      from unnest(insert_order) as t
     where not (payload -> 'tables' ? t);
    if faltando is not null then
      raise exception 'Backup incompleto: faltam as tabelas %. Nada foi alterado.', faltando;
    end if;
  else
    insert_order := insert_v2;
    if exists (select 1 from opportunities)
       or exists (select 1 from budgets)
       or exists (select 1 from packages) then
      raise exception 'Este backup é antigo (14 tabelas) e não recarrega leads, orçamentos nem pacotes, que já existem no banco. Gere um backup novo e restaure a partir dele. Nada foi alterado.';
    end if;
  end if;

  -- Cada tabela precisa ser uma lista e, se houver counts, a contagem tem de bater.
  foreach tbl in array insert_order loop
    if jsonb_typeof(payload -> 'tables' -> tbl) is distinct from 'array' then
      raise exception 'Backup inválido: a tabela % não é uma lista. Nada foi alterado.', tbl;
    end if;
    if jsonb_typeof(payload -> 'counts') = 'object' and (payload -> 'counts') ? tbl then
      if (payload -> 'counts' ->> tbl)::int is distinct from jsonb_array_length(payload -> 'tables' -> tbl) then
        raise exception 'Backup inconsistente na tabela %: o arquivo registra % linhas e contém %. Nada foi alterado.',
          tbl, payload -> 'counts' ->> tbl, jsonb_array_length(payload -> 'tables' -> tbl);
      end if;
    end if;
  end loop;

  -- Filhos antes dos pais: o inverso da ordem de inserção.
  select array_agg(t order by ord desc) into delete_order
    from unnest(insert_order) with ordinality as u(t, ord);

  perform set_config('laser.sem_movimentacao', 'on', true);

  alter table sales disable trigger trg_sale_cash_sync;
  alter table sales disable trigger trg_sales_classify;
  alter table sales disable trigger trg_sales_audit;

  -- Desfaz as ligações circulares e os vínculos temporários que impediriam apagar.
  update opportunities set sale_id = null where sale_id is not null;
  update sales set opportunity_id = null where opportunity_id is not null;
  update cpf_import_staging set match_client_id = null where match_client_id is not null;

  foreach tbl in array delete_order loop
    execute format('delete from %I', tbl);
  end loop;

  foreach tbl in array insert_order loop
    linhas := payload -> 'tables' -> tbl;
    if tbl = 'opportunities' then
      -- sale_id volta no fim, depois que as vendas existirem.
      select coalesce(jsonb_agg(e - 'sale_id'), '[]'::jsonb) into linhas
        from jsonb_array_elements(linhas) as e;
    end if;

    execute format(
      'insert into %I select * from jsonb_populate_recordset(null::%I, $1)',
      tbl, tbl
    ) using linhas;

    execute format('select count(*) from %I', tbl) into n;
    esperado := jsonb_array_length(payload -> 'tables' -> tbl);
    if n <> esperado then
      raise exception 'Conferência falhou na tabela %: gravadas % de % linhas. Nada foi alterado.', tbl, n, esperado;
    end if;
    counts := counts || jsonb_build_object(tbl, n);
  end loop;

  if v_versao = 3 then
    update opportunities o
       set sale_id = x.sale_id
      from jsonb_to_recordset(payload -> 'tables' -> 'opportunities') as x(id uuid, sale_id uuid)
     where o.id = x.id and x.sale_id is not null;
  end if;

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
    jsonb_build_object('versao', v_versao, 'linhas_por_tabela', counts)
  );

  return jsonb_build_object('ok', true, 'counts', counts);
exception when others then
  alter table sales enable trigger trg_sale_cash_sync;
  alter table sales enable trigger trg_sales_classify;
  alter table sales enable trigger trg_sales_audit;
  raise;
end;
$function$;
