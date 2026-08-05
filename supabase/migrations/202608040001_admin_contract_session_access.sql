begin;

-- Permite que administradores autenticados consultem os contratos usando a
-- própria sessão. Assim, a tela administrativa não depende da chave service
-- role para operações somente de leitura.
alter table public.client_contracts enable row level security;

drop policy if exists "contracts admin read" on public.client_contracts;
create policy "contracts admin read"
  on public.client_contracts
  for select
  to authenticated
  using (public.is_admin());

grant select on public.client_contracts to authenticated;

-- Preserva o registro de auditoria dos downloads feitos pelo administrador.
alter table public.audit_logs enable row level security;

drop policy if exists "audit logs admin insert" on public.audit_logs;
create policy "audit logs admin insert"
  on public.audit_logs
  for insert
  to authenticated
  with check (
    public.is_admin()
    and actor_id = auth.uid()
  );

grant insert on public.audit_logs to authenticated;

commit;
