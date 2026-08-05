begin;

create or replace function public.admin_adjust_client_points(
  p_client_id uuid,
  p_delta integer,
  p_reason text,
  p_actor_id uuid,
  p_actor_email text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current integer;
  v_new_balance integer;
  v_transaction_id uuid;
  v_reference text := 'ADMIN:' || gen_random_uuid()::text;
begin
  if p_delta = 0 or abs(p_delta) > 100000 then
    raise exception 'Quantidade de pontos inválida';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Informe um motivo com pelo menos 5 caracteres';
  end if;

  select coalesce(pontos, 0)
  into v_current
  from public.clients
  where id = p_client_id
  for update;

  if not found then raise exception 'Cliente não encontrado'; end if;
  v_new_balance := v_current + p_delta;
  if v_new_balance < 0 then
    raise exception 'O cliente possui apenas % pontos disponíveis', v_current;
  end if;

  insert into public.points_transactions (
    client_id,
    points,
    description,
    provider_payment_id
  ) values (
    p_client_id,
    p_delta,
    'Ajuste administrativo: ' || left(trim(p_reason), 180),
    v_reference
  ) returning id into v_transaction_id;

  update public.clients
  set pontos = v_new_balance,
      updated_at = now()
  where id = p_client_id;

  insert into public.audit_logs (
    actor_id,
    actor_email,
    action,
    resource_type,
    resource_id,
    metadata
  ) values (
    p_actor_id,
    p_actor_email,
    case when p_delta > 0 then 'loyalty.points_added' else 'loyalty.points_removed' end,
    'client_points',
    p_client_id::text,
    jsonb_build_object(
      'delta', p_delta,
      'previous_balance', v_current,
      'new_balance', v_new_balance,
      'reason', left(trim(p_reason), 180),
      'transaction_id', v_transaction_id
    )
  );

  return jsonb_build_object(
    'client_id', p_client_id,
    'delta', p_delta,
    'previous_balance', v_current,
    'new_balance', v_new_balance,
    'transaction_id', v_transaction_id
  );
end;
$$;

revoke all on function public.admin_adjust_client_points(uuid,integer,text,uuid,text)
from public, anon, authenticated;
grant execute on function public.admin_adjust_client_points(uuid,integer,text,uuid,text)
to service_role;

commit;
