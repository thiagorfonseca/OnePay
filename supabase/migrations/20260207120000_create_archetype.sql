create table if not exists public.archetype_public_links (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  token text not null unique,
  audience_type text not null default 'EXTERNAL',
  is_active boolean not null default true,
  created_by_user_id uuid null references auth.users(id)
);

create table if not exists public.archetype_respondents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  public_token text not null,
  audience_type text not null default 'EXTERNAL',
  name text not null,
  email text null,
  phone text null,
  profession text null,
  city text null,
  consent_lgpd boolean not null default false,
  scores jsonb not null,
  top_profile text not null,
  top_profiles text[] null,
  submitted_by_user_id uuid null references auth.users(id)
);

create table if not exists public.archetype_answers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  respondent_id uuid references public.archetype_respondents(id) on delete cascade,
  question_id int not null,
  selected_word text not null,
  scored_profile text not null,
  unique (respondent_id, question_id)
);

create index if not exists archetype_public_links_clinic_id_idx on public.archetype_public_links(clinic_id);
create index if not exists archetype_public_links_token_idx on public.archetype_public_links(token);
create index if not exists archetype_respondents_created_at_idx on public.archetype_respondents(created_at);
create index if not exists archetype_respondents_clinic_id_idx on public.archetype_respondents(clinic_id);
create index if not exists archetype_respondents_top_profile_idx on public.archetype_respondents(top_profile);
create index if not exists archetype_respondents_audience_type_idx on public.archetype_respondents(audience_type);
create index if not exists archetype_answers_respondent_id_idx on public.archetype_answers(respondent_id);
create index if not exists archetype_answers_clinic_id_idx on public.archetype_answers(clinic_id);

alter table public.archetype_public_links enable row level security;
alter table public.archetype_respondents enable row level security;
alter table public.archetype_answers enable row level security;

-- Public access: resolve active token (minimal fields via select)
drop policy if exists "archetype_public_links_select_anon" on public.archetype_public_links;
create policy "archetype_public_links_select_anon"
  on public.archetype_public_links
  for select
  to anon
  using (
    is_active = true
  );

-- Authenticated access for public links

drop policy if exists "archetype_public_links_select" on public.archetype_public_links;
create policy "archetype_public_links_select"
  on public.archetype_public_links
  for select
  to authenticated
  using (
    public.is_clinic_member(clinic_id)
    or exists (
      select 1 from public.app_current_user cu
      where cu.user_id = auth.uid()
        and cu.role in ('system_owner', 'super_admin')
    )
  );

drop policy if exists "archetype_public_links_insert" on public.archetype_public_links;
create policy "archetype_public_links_insert"
  on public.archetype_public_links
  for insert
  to authenticated
  with check (
    public.is_clinic_member(clinic_id)
    or exists (
      select 1 from public.app_current_user cu
      where cu.user_id = auth.uid()
        and cu.role in ('system_owner', 'super_admin')
    )
  );

drop policy if exists "archetype_public_links_update" on public.archetype_public_links;
create policy "archetype_public_links_update"
  on public.archetype_public_links
  for update
  to authenticated
  using (
    public.is_clinic_member(clinic_id)
    or exists (
      select 1 from public.app_current_user cu
      where cu.user_id = auth.uid()
        and cu.role in ('system_owner', 'super_admin')
    )
  )
  with check (
    public.is_clinic_member(clinic_id)
    or exists (
      select 1 from public.app_current_user cu
      where cu.user_id = auth.uid()
        and cu.role in ('system_owner', 'super_admin')
    )
  );

drop policy if exists "archetype_public_links_delete" on public.archetype_public_links;
create policy "archetype_public_links_delete"
  on public.archetype_public_links
  for delete
  to authenticated
  using (
    public.is_clinic_member(clinic_id)
    or exists (
      select 1 from public.app_current_user cu
      where cu.user_id = auth.uid()
        and cu.role in ('system_owner', 'super_admin')
    )
  );

-- Respondents: public insert guarded by active token

drop policy if exists "archetype_respondents_insert_anon" on public.archetype_respondents;
create policy "archetype_respondents_insert_anon"
  on public.archetype_respondents
  for insert
  to anon
  with check (
    exists (
      select 1
      from public.archetype_public_links l
      where l.token = public.archetype_respondents.public_token
        and l.is_active = true
        and l.clinic_id = public.archetype_respondents.clinic_id
        and l.audience_type = public.archetype_respondents.audience_type
    )
  );

-- Respondents: authenticated read

drop policy if exists "archetype_respondents_select" on public.archetype_respondents;
create policy "archetype_respondents_select"
  on public.archetype_respondents
  for select
  to authenticated
  using (
    public.is_clinic_member(clinic_id)
    or exists (
      select 1 from public.app_current_user cu
      where cu.user_id = auth.uid()
        and cu.role in ('system_owner', 'super_admin')
    )
  );

-- Respondents: authenticated insert (opcional)

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
  );

-- Answers: public insert guarded by active token

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

drop policy if exists "archetype_answers_insert_anon" on public.archetype_answers;
create policy "archetype_answers_insert_anon"
  on public.archetype_answers
  for insert
  to anon
  with check (
    public.is_archetype_respondent_valid(public.archetype_answers.respondent_id, public.archetype_answers.clinic_id)
  );

-- Answers: authenticated read

drop policy if exists "archetype_answers_select" on public.archetype_answers;
create policy "archetype_answers_select"
  on public.archetype_answers
  for select
  to authenticated
  using (
    public.is_clinic_member(clinic_id)
    or exists (
      select 1 from public.app_current_user cu
      where cu.user_id = auth.uid()
        and cu.role in ('system_owner', 'super_admin')
    )
  );

-- Answers: authenticated insert (opcional)

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
  );

grant select on public.archetype_public_links to anon, authenticated;
grant insert on public.archetype_respondents to anon, authenticated;
grant insert on public.archetype_answers to anon, authenticated;
grant select on public.archetype_respondents to authenticated;
grant select on public.archetype_answers to authenticated;
grant update, delete on public.archetype_public_links to authenticated;
