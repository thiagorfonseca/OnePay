alter table public.archetype_public_links
  add column if not exists collaborator_id uuid references public.clinic_users(id) on delete set null;

create index if not exists archetype_public_links_collaborator_id_idx
  on public.archetype_public_links(collaborator_id);

create or replace function public.submit_archetype_response(
  p_public_token text,
  p_clinic_id uuid,
  p_audience_type text,
  p_name text,
  p_email text,
  p_phone text,
  p_profession text,
  p_city text,
  p_consent_lgpd boolean,
  p_scores jsonb,
  p_top_profile text,
  p_top_profiles text[],
  p_answers jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_audience text;
  v_respondent_id uuid;
  v_collaborator_id uuid;
begin
  v_audience := upper(trim(p_audience_type));

  if not exists (
    select 1
    from public.archetype_public_links l
    where l.token = p_public_token
      and l.is_active = true
      and l.clinic_id = p_clinic_id
      and l.audience_type = v_audience
  ) then
    raise exception 'Token inválido ou expirado';
  end if;

  select l.collaborator_id
    into v_collaborator_id
  from public.archetype_public_links l
  where l.token = p_public_token
    and l.is_active = true
    and l.clinic_id = p_clinic_id
    and l.audience_type = v_audience
  limit 1;

  insert into public.archetype_respondents (
    clinic_id,
    public_token,
    audience_type,
    name,
    email,
    phone,
    profession,
    city,
    consent_lgpd,
    scores,
    top_profile,
    top_profiles
  )
  values (
    p_clinic_id,
    p_public_token,
    v_audience,
    p_name,
    nullif(p_email, ''),
    nullif(p_phone, ''),
    nullif(p_profession, ''),
    nullif(p_city, ''),
    p_consent_lgpd,
    p_scores,
    p_top_profile,
    p_top_profiles
  )
  returning id into v_respondent_id;

  insert into public.archetype_answers (
    clinic_id,
    respondent_id,
    question_id,
    selected_word,
    scored_profile
  )
  select
    p_clinic_id,
    v_respondent_id,
    (ans->>'question_id')::int,
    ans->>'selected_word',
    ans->>'scored_profile'
  from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb)) as ans;

  if v_collaborator_id is not null then
    insert into public.hr_collaborators (
      clinic_id,
      clinic_user_id,
      archetype
    )
    values (
      p_clinic_id,
      v_collaborator_id,
      p_top_profile
    )
    on conflict (clinic_user_id)
    do update set archetype = excluded.archetype;
  end if;

  update public.archetype_public_links
  set is_active = false
  where token = p_public_token
    and clinic_id = p_clinic_id
    and audience_type = v_audience;

  return v_respondent_id;
end;
$$;
