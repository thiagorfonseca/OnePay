create or replace function public.is_meeting_participant(p_meeting_id uuid)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.hr_meeting_participants p
    join public.clinic_users cu on cu.id = p.clinic_user_id
    where p.meeting_id = p_meeting_id
      and cu.user_id = auth.uid()
      and cu.ativo = true
  );
$$;

drop policy if exists "hr_meetings_select" on public.hr_meetings;
create policy "hr_meetings_select"
on public.hr_meetings
for select
to authenticated
using (
  created_by = auth.uid()
  or public.is_meeting_participant(id)
  or public.is_clinic_admin(clinic_id)
  or exists (
    select 1 from public.app_current_user cu
    where cu.user_id = auth.uid()
      and cu.role in ('system_owner', 'super_admin')
  )
);

drop policy if exists "hr_meeting_participants_select" on public.hr_meeting_participants;
create policy "hr_meeting_participants_select"
on public.hr_meeting_participants
for select
to authenticated
using (
  public.is_meeting_participant(meeting_id)
  or exists (
    select 1
    from public.hr_meetings m
    where m.id = hr_meeting_participants.meeting_id
      and (
        m.created_by = auth.uid()
        or public.is_clinic_admin(m.clinic_id)
      )
  )
  or exists (
    select 1 from public.app_current_user cu
    where cu.user_id = auth.uid()
      and cu.role in ('system_owner', 'super_admin')
  )
);
