create or replace function public.is_archetype_respondent_valid(p_respondent_id uuid, p_clinic_id uuid)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.archetype_respondents r
    join public.archetype_public_links l on l.token = r.public_token and l.is_active = true
    where r.id = p_respondent_id
      and r.clinic_id = p_clinic_id
      and l.clinic_id = r.clinic_id
      and l.audience_type = r.audience_type
  );
$$;

create or replace function public.is_archetype_link_valid(p_token text, p_clinic_id uuid, p_audience_type text)
returns boolean
language sql
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.archetype_public_links l
    where l.token = p_token
      and l.is_active = true
      and l.clinic_id = p_clinic_id
      and l.audience_type = p_audience_type
  );
$$;

-- Atualiza policy de insert anon para respondentes

drop policy if exists "archetype_respondents_insert_anon" on public.archetype_respondents;
create policy "archetype_respondents_insert_anon"
  on public.archetype_respondents
  for insert
  to anon
  with check (
    public.is_archetype_link_valid(public.archetype_respondents.public_token, public.archetype_respondents.clinic_id, public.archetype_respondents.audience_type)
  );

-- Atualiza policy de insert anon para respostas

drop policy if exists "archetype_answers_insert_anon" on public.archetype_answers;
create policy "archetype_answers_insert_anon"
  on public.archetype_answers
  for insert
  to anon
  with check (
    public.is_archetype_respondent_valid(public.archetype_answers.respondent_id, public.archetype_answers.clinic_id)
  );

-- Permite insert autenticado via token (caso usuário esteja logado ao responder)

drop policy if exists "archetype_respondents_insert" on public.archetype_respondents;
create policy "archetype_respondents_insert"
  on public.archetype_respondents
  for insert
  to authenticated
  with check (
    public.is_clinic_member(clinic_id)
    or exists (
      select 1 from public.app_current_user cu
      where cu.user_id = auth.uid()
        and cu.role in ('system_owner', 'super_admin')
    )
    or public.is_archetype_link_valid(public.archetype_respondents.public_token, public.archetype_respondents.clinic_id, public.archetype_respondents.audience_type)
  );

drop policy if exists "archetype_answers_insert" on public.archetype_answers;
create policy "archetype_answers_insert"
  on public.archetype_answers
  for insert
  to authenticated
  with check (
    public.is_clinic_member(clinic_id)
    or exists (
      select 1 from public.app_current_user cu
      where cu.user_id = auth.uid()
        and cu.role in ('system_owner', 'super_admin')
    )
    or public.is_archetype_respondent_valid(public.archetype_answers.respondent_id, public.archetype_answers.clinic_id)
  );

-- Grants básicos

grant select on public.archetype_public_links to anon, authenticated;
grant insert on public.archetype_respondents to anon, authenticated;
grant insert on public.archetype_answers to anon, authenticated;
grant select on public.archetype_respondents to authenticated;
grant select on public.archetype_answers to authenticated;
grant update, delete on public.archetype_public_links to authenticated;
