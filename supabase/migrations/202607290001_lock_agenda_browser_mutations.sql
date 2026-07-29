begin;

-- Todas as alterações de trilhas passam pela API administrativa do servidor.
-- O service_role continua autorizado e as leituras públicas permanecem intactas.
-- Isso impede que um usuário autenticado contorne o bloqueio de trilhas
-- encerradas chamando diretamente a API REST do Supabase pelo navegador.

drop policy if exists "agendas admin insert" on public.agendas;
drop policy if exists "agendas admin update" on public.agendas;
drop policy if exists "agendas admin delete" on public.agendas;

revoke insert, update, delete on public.agendas from authenticated;
revoke insert, update, delete on public.agendas from anon;

insert into public.audit_logs (
  action,
  resource_type,
  metadata
) values (
  'agenda_browser_mutations_locked',
  'agendas',
  jsonb_build_object(
    'rule', 'agenda mutations are restricted to authenticated server routes',
    'archived_unlock', 'server-side credential plus short-lived HttpOnly session'
  )
);

commit;
