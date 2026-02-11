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
  v_name text;
  v_email text;
  v_phone text;
  v_profession text;
  v_city text;
  v_collab_name text;
  v_collab_email text;
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

  v_name := nullif(trim(p_name), '');
  v_email := nullif(trim(p_email), '');
  v_phone := nullif(trim(p_phone), '');
  v_profession := nullif(trim(p_profession), '');
  v_city := nullif(trim(p_city), '');

  if v_collaborator_id is not null then
    select cu.name, cu.email
      into v_collab_name, v_collab_email
    from public.clinic_users cu
    where cu.id = v_collaborator_id
      and cu.clinic_id = p_clinic_id
    limit 1;

    v_name := coalesce(v_name, v_collab_name, 'Colaborador interno');
    v_email := coalesce(v_email, v_collab_email);
  else
    v_name := coalesce(v_name, 'Participante');
  end if;

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
    v_name,
    v_email,
    v_phone,
    v_profession,
    v_city,
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
