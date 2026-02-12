-- RPC for approving inventory counts and generating ledger adjustments

create or replace function public.apply_inventory_count(p_count_id uuid)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_count record;
  v_line record;
  v_diff numeric(14,4);
  v_unit_cost numeric(14,4);
begin
  select * into v_count
  from public.inventory_counts
  where id = p_count_id;

  if not found then
    raise exception 'Contagem não encontrada';
  end if;

  if v_count.status <> 'submitted' then
    raise exception 'Contagem deve estar em status submitted';
  end if;

  if not public.is_inventory_manager(v_count.clinic_id) and not public.is_system_admin() then
    raise exception 'Sem permissão para aprovar contagem';
  end if;

  for v_line in
    select *
    from public.inventory_count_lines
    where count_id = p_count_id
  loop
    v_diff := coalesce(v_line.diff_qty, v_line.counted_qty - coalesce(v_line.expected_qty, 0));

    update public.inventory_count_lines
      set diff_qty = v_diff
    where id = v_line.id;

    if v_diff <> 0 then
      select last_cost into v_unit_cost
      from public.inventory_items
      where id = v_line.item_id;

      insert into public.inventory_movements (
        clinic_id,
        item_id,
        batch_id,
        movement_type,
        qty_delta,
        unit_cost,
        reason,
        reference_type,
        reference_id,
        created_by
      ) values (
        v_count.clinic_id,
        v_line.item_id,
        v_line.batch_id,
        'inventory',
        v_diff,
        coalesce(v_line.unit_cost, v_unit_cost),
        'cycle_count',
        'inventory_count',
        v_count.id,
        auth.uid()
      );
    end if;
  end loop;

  update public.inventory_counts
    set status = 'approved',
        approved_by = auth.uid(),
        approved_at = now()
  where id = p_count_id;
end;
$$;

grant execute on function public.apply_inventory_count(uuid) to authenticated;
