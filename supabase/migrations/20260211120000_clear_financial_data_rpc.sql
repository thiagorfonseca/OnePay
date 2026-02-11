create or replace function public.clear_financial_data(p_clinic_id uuid)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if p_clinic_id is null then
    raise exception 'clinic_id obrigatório';
  end if;

  if not exists (
    select 1
    from public.app_current_user cu
    where cu.user_id = auth.uid()
      and cu.role in ('system_owner', 'super_admin')
  ) then
    raise exception 'Apenas administrador geral pode limpar dados financeiros';
  end if;

  delete from public.revenues where clinic_id = p_clinic_id;
  delete from public.expenses where clinic_id = p_clinic_id;
end;
$$;

grant execute on function public.clear_financial_data(uuid) to authenticated;
