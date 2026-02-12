create or replace function public.is_one_doctor_internal()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.app_current_user cu
    where cu.user_id = auth.uid()
      and cu.role in ('system_owner', 'super_admin', 'one_doctor_admin', 'one_doctor_sales')
  );
$$;

create table if not exists public.od_clients (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  trade_name text,
  cnpj text,
  state_registration text,
  email_financeiro text,
  email_principal text,
  telefone text,
  whatsapp text,
  address_logradouro text,
  address_numero text,
  address_complemento text,
  address_bairro text,
  address_cidade text,
  address_uf text,
  address_cep text,
  contact_person_name text,
  contact_person_cpf text,
  status text not null default 'lead'::text
    check (status in ('lead', 'em_negociacao', 'ativo', 'pausado', 'cancelado')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.od_contract_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  html_content text not null,
  is_active boolean not null default true,
  version int not null default 1,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.od_proposals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.od_clients(id) on delete set null,
  title text not null,
  direct_link boolean not null default false,
  requires_signature boolean not null default true,
  confirmation_text text,
  product_type text not null default 'platform'::text
    check (product_type in ('platform', 'course', 'other')),
  payment_methods jsonb not null default '{"creditCard":true,"boleto":false,"pix":false}'::jsonb,
  installments int,
  amount_cents int not null,
  contract_template_id uuid references public.od_contract_templates(id) on delete set null,
  package_id uuid references public.content_packages(id) on delete set null,
  status text not null default 'draft'::text
    check (status in ('draft','sent','form_filled','signature_sent','signed','payment_created','paid','provisioned','expired','canceled')),
  public_token text not null default encode(gen_random_bytes(24), 'hex'),
  expires_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.od_proposal_form_submissions (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.od_proposals(id) on delete cascade,
  payload jsonb not null,
  submitted_at timestamptz default now()
);

create table if not exists public.od_zapsign_documents (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.od_proposals(id) on delete cascade,
  zapsign_doc_id text not null,
  status text not null default 'created'::text
    check (status in ('created','sent','signed','rejected','canceled','error')),
  signer_email text,
  signer_name text,
  signed_at timestamptz,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.od_asaas_payments (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.od_proposals(id) on delete cascade,
  asaas_customer_id text,
  asaas_payment_id text not null,
  invoice_url text,
  status text not null default 'created'::text
    check (status in ('created','pending','paid','overdue','canceled','refunded','error')),
  paid_at timestamptz,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.od_entitlements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.clinics(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  package_id uuid references public.content_packages(id) on delete set null,
  products jsonb not null default '[]'::jsonb,
  status text not null default 'active'::text
    check (status in ('active','inactive')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz default now()
);

create unique index if not exists od_proposals_public_token_unique
  on public.od_proposals(public_token);

create index if not exists od_clients_cnpj_idx
  on public.od_clients(cnpj);

create index if not exists od_proposals_client_id_idx
  on public.od_proposals(client_id);

create index if not exists od_proposals_status_idx
  on public.od_proposals(status);

create index if not exists od_proposals_created_at_idx
  on public.od_proposals(created_at desc);

create index if not exists od_proposal_submissions_proposal_id_idx
  on public.od_proposal_form_submissions(proposal_id);

create unique index if not exists od_zapsign_documents_doc_id_unique
  on public.od_zapsign_documents(zapsign_doc_id);

create index if not exists od_zapsign_documents_proposal_id_idx
  on public.od_zapsign_documents(proposal_id);

create unique index if not exists od_asaas_payments_payment_id_unique
  on public.od_asaas_payments(asaas_payment_id);

create index if not exists od_asaas_payments_proposal_id_idx
  on public.od_asaas_payments(proposal_id);

create index if not exists od_entitlements_tenant_id_idx
  on public.od_entitlements(tenant_id);

create index if not exists od_entitlements_user_id_idx
  on public.od_entitlements(user_id);

create index if not exists od_entitlements_package_id_idx
  on public.od_entitlements(package_id);

create trigger od_clients_set_updated_at
before update on public.od_clients
for each row execute procedure public.handle_updated_at();

create trigger od_contract_templates_set_updated_at
before update on public.od_contract_templates
for each row execute procedure public.handle_updated_at();

create trigger od_proposals_set_updated_at
before update on public.od_proposals
for each row execute procedure public.handle_updated_at();

create trigger od_zapsign_documents_set_updated_at
before update on public.od_zapsign_documents
for each row execute procedure public.handle_updated_at();

create trigger od_asaas_payments_set_updated_at
before update on public.od_asaas_payments
for each row execute procedure public.handle_updated_at();

alter table public.od_clients enable row level security;
alter table public.od_contract_templates enable row level security;
alter table public.od_proposals enable row level security;
alter table public.od_proposal_form_submissions enable row level security;
alter table public.od_zapsign_documents enable row level security;
alter table public.od_asaas_payments enable row level security;
alter table public.od_entitlements enable row level security;

drop policy if exists "od_clients_internal" on public.od_clients;
create policy "od_clients_internal"
  on public.od_clients
  for all
  to authenticated
  using (public.is_one_doctor_internal())
  with check (public.is_one_doctor_internal());

drop policy if exists "od_contract_templates_internal" on public.od_contract_templates;
create policy "od_contract_templates_internal"
  on public.od_contract_templates
  for all
  to authenticated
  using (public.is_one_doctor_internal())
  with check (public.is_one_doctor_internal());

drop policy if exists "od_proposals_internal" on public.od_proposals;
create policy "od_proposals_internal"
  on public.od_proposals
  for all
  to authenticated
  using (public.is_one_doctor_internal())
  with check (public.is_one_doctor_internal());

drop policy if exists "od_proposal_form_submissions_internal" on public.od_proposal_form_submissions;
create policy "od_proposal_form_submissions_internal"
  on public.od_proposal_form_submissions
  for all
  to authenticated
  using (public.is_one_doctor_internal())
  with check (public.is_one_doctor_internal());

drop policy if exists "od_zapsign_documents_internal" on public.od_zapsign_documents;
create policy "od_zapsign_documents_internal"
  on public.od_zapsign_documents
  for all
  to authenticated
  using (public.is_one_doctor_internal())
  with check (public.is_one_doctor_internal());

drop policy if exists "od_asaas_payments_internal" on public.od_asaas_payments;
create policy "od_asaas_payments_internal"
  on public.od_asaas_payments
  for all
  to authenticated
  using (public.is_one_doctor_internal())
  with check (public.is_one_doctor_internal());

drop policy if exists "od_entitlements_internal" on public.od_entitlements;
create policy "od_entitlements_internal"
  on public.od_entitlements
  for all
  to authenticated
  using (public.is_one_doctor_internal())
  with check (public.is_one_doctor_internal());
