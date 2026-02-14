create table if not exists public.od_proposal_form_drafts (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.od_proposals(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  step int not null default 1,
  meta jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

create unique index if not exists od_proposal_form_drafts_proposal_id_key
  on public.od_proposal_form_drafts(proposal_id);

create trigger od_proposal_form_drafts_set_updated_at
before update on public.od_proposal_form_drafts
for each row execute procedure public.handle_updated_at();

alter table public.od_proposal_form_drafts enable row level security;

drop policy if exists "od_proposal_form_drafts_internal" on public.od_proposal_form_drafts;
create policy "od_proposal_form_drafts_internal"
  on public.od_proposal_form_drafts
  for all
  using (public.is_one_doctor_internal())
  with check (public.is_one_doctor_internal());
