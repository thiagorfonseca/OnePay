-- Extensões básicas
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Tabela de clínicas
create table if not exists public.clinics (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  responsavel_nome text,
  documento text, -- CPF ou CNPJ
  email_contato text,
  telefone_contato text,
  plano text default 'basico',
  paginas_liberadas text[],
  ativo boolean default true,
  created_at timestamptz default now()
);

alter table public.clinics
  add column if not exists responsavel_nome text,
  add column if not exists documento text,
  add column if not exists email_contato text,
  add column if not exists telefone_contato text,
  add column if not exists plano text default 'basico',
  add column if not exists paginas_liberadas text[],
  add column if not exists ativo boolean default true;

-- Perfis vinculados ao usuário do auth
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  clinic_id uuid references public.clinics(id) on delete set null,
  full_name text,
  role text default 'admin',
  created_at timestamptz default now()
);

-- Contas bancárias
create table if not exists public.bank_accounts (
  id uuid primary key default uuid_generate_v4(),
  clinic_id uuid references public.clinics(id) on delete cascade,
  nome_conta text not null,
  banco text not null,
  initial_balance numeric(14,2) default 0,
  current_balance numeric(14,2) default 0,
  ativo boolean default true,
  created_at timestamptz default now()
);

-- Taxas de Cartão (por bandeira)
create table if not exists public.card_fees (
  id uuid primary key default uuid_generate_v4(),
  clinic_id uuid references public.clinics(id) on delete cascade,
  bandeira text not null,
  metodo text not null default 'Cartão de Crédito',
  taxa_percent numeric(6,3) not null default 0,
  min_installments int not null default 1,
  max_installments int not null default 1,
  created_at timestamptz default now()
);

-- Ajuste para tabelas já existentes: garantir colunas de parcelas
alter table public.card_fees
  add column if not exists min_installments int not null default 1,
  add column if not exists max_installments int not null default 1;

-- Categorias
create table if not exists public.categories (
  id uuid primary key default uuid_generate_v4(),
  clinic_id uuid references public.clinics(id) on delete cascade,
  name text not null,
  tipo text not null check (tipo in ('receita','despesa')),
  cor_opcional text,
  created_at timestamptz default now()
);

-- Receitas
create table if not exists public.revenues (
  id uuid primary key default uuid_generate_v4(),
  clinic_id uuid references public.clinics(id) on delete cascade,
  bank_account_id uuid references public.bank_accounts(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  description text,
  valor_bruto numeric(14,2),
  valor_liquido numeric(14,2),
  valor numeric(14,2),
  data_competencia date,
  data_recebimento date,
  paciente text,
  forma_pagamento text,
  forma_pagamento_taxa numeric(6,3),
  bandeira text,
  parcelas int default 1,
  observacoes text,
  status text not null default 'paid' check (status in ('paid','pending')),
  created_at timestamptz default now()
);

-- Ajuste para receitas existentes
alter table public.revenues
  add column if not exists parcelas int default 1,
  add column if not exists forma_pagamento_taxa numeric(6,3),
  add column if not exists bandeira text;

-- Despesas
create table if not exists public.expenses (
  id uuid primary key default uuid_generate_v4(),
  clinic_id uuid references public.clinics(id) on delete cascade,
  bank_account_id uuid references public.bank_accounts(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  description text,
  valor numeric(14,2),
  data_competencia date,
  data_pagamento date,
  forma_pagamento text,
  parcelas int default 1,
  fornecedor text,
  tipo_despesa text,
  observacoes text,
  status text not null default 'paid' check (status in ('paid','pending')),
  created_at timestamptz default now()
);

-- Ajustes para tabelas existentes de despesas (compatibilidade com lançamentos)
alter table public.expenses
  add column if not exists forma_pagamento text,
  add column if not exists parcelas int default 1,
  add column if not exists pessoa_tipo text,
  add column if not exists tipo_despesa text;

-- Fornecedores
create table if not exists public.suppliers (
  id uuid primary key default uuid_generate_v4(),
  clinic_id uuid references public.clinics(id) on delete cascade,
  nome text not null,
  cnpj text,
  telefone text,
  created_at timestamptz default now()
);
alter table public.suppliers
  add column if not exists cnpj text,
  add column if not exists telefone text;

-- Vincular fornecedores às despesas
alter table public.expenses
  add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;

-- Fornecedores
create table if not exists public.suppliers (
  id uuid primary key default uuid_generate_v4(),
  clinic_id uuid references public.clinics(id) on delete cascade,
  nome text not null,
  cnpj text,
  telefone text,
  created_at timestamptz default now()
);
alter table public.suppliers
  add column if not exists cnpj text,
  add column if not exists telefone text;

-- Procedimentos
create table if not exists public.procedures (
  id uuid primary key default uuid_generate_v4(),
  clinic_id uuid references public.clinics(id) on delete cascade,
  categoria text,
  procedimento text not null,
  valor_cobrado numeric(14,2),
  custo_insumo numeric(14,2),
  tempo_minutos int,
  created_at timestamptz default now()
);
alter table public.procedures
  add column if not exists categoria text,
  add column if not exists procedimento text,
  add column if not exists valor_cobrado numeric(14,2),
  add column if not exists custo_insumo numeric(14,2),
  add column if not exists tempo_minutos int;

-- Gastos para precificação
create table if not exists public.pricing_expenses (
  id uuid primary key default uuid_generate_v4(),
  clinic_id uuid references public.clinics(id) on delete cascade,
  categoria text not null,
  nome text not null,
  valor_base numeric(14,2) not null,
  valor_calculado numeric(14,2) not null,
  created_at timestamptz default now()
);
alter table public.pricing_expenses
  add column if not exists categoria text,
  add column if not exists nome text,
  add column if not exists valor_base numeric(14,2),
  add column if not exists valor_calculado numeric(14,2);

-- Profissionais (venda/execução)
create table if not exists public.professionals (
  id uuid primary key default uuid_generate_v4(),
  clinic_id uuid references public.clinics(id) on delete cascade,
  nome text not null,
  tipo text not null check (tipo in ('venda','execucao')),
  created_at timestamptz default now()
);
alter table public.professionals
  add column if not exists tipo text;

-- Relação receitas x procedimentos
create table if not exists public.revenue_procedures (
  id uuid primary key default uuid_generate_v4(),
  revenue_id uuid references public.revenues(id) on delete cascade,
  procedure_id uuid references public.procedures(id) on delete set null,
  categoria text,
  procedimento text,
  valor_cobrado numeric(14,2),
  quantidade int default 1,
  created_at timestamptz default now()
);
alter table public.revenue_procedures
  add column if not exists procedure_id uuid references public.procedures(id) on delete set null,
  add column if not exists categoria text,
  add column if not exists procedimento text,
  add column if not exists valor_cobrado numeric(14,2),
  add column if not exists quantidade int default 1;

-- Ajuste receitas: relacionar profissionais após tabela existir
alter table public.revenues
  add column if not exists sale_professional_id uuid references public.professionals(id) on delete set null,
  add column if not exists exec_professional_id uuid references public.professionals(id) on delete set null;

-- Clientes
create table if not exists public.customers (
  id uuid primary key default uuid_generate_v4(),
  clinic_id uuid references public.clinics(id) on delete cascade,
  name text not null,
  cpf text,
  cep text,
  created_at timestamptz default now()
);

-- Usuários por clínica (multiusuário)
create table if not exists public.clinic_users (
  id uuid primary key default uuid_generate_v4(),
  clinic_id uuid references public.clinics(id) on delete cascade,
  name text not null,
  email text not null,
  role text default 'user',
  paginas_liberadas text[],
  ativo boolean default true,
  created_at timestamptz default now()
);
alter table public.clinic_users
  add column if not exists paginas_liberadas text[];

-- Lançamentos bancários importados (OFX)
create table if not exists public.bank_transactions (
  id uuid primary key default uuid_generate_v4(),
  bank_account_id uuid references public.bank_accounts(id) on delete cascade,
  data date,
  descricao text,
  valor numeric(14,2),
  tipo text,
  hash_transacao text unique,
  conciliado boolean default false,
  arquivado boolean default false,
  revenue_id_opcional uuid references public.revenues(id) on delete set null,
  expense_id_opcional uuid references public.expenses(id) on delete set null,
  created_at timestamptz default now()
);

-- RLS básico: tudo liberado para usuários autenticados (demo)
alter table public.clinics enable row level security;
alter table public.profiles enable row level security;
alter table public.bank_accounts enable row level security;
alter table public.card_fees enable row level security;
alter table public.categories enable row level security;
alter table public.revenues enable row level security;
alter table public.expenses enable row level security;
alter table public.customers enable row level security;
alter table public.bank_transactions enable row level security;
alter table public.clinic_users enable row level security;
alter table public.procedures enable row level security;
alter table public.pricing_expenses enable row level security;
alter table public.revenue_procedures enable row level security;
alter table public.professionals enable row level security;
alter table public.suppliers enable row level security;

-- Garantir idempotência em novas execuções
drop policy if exists "Authenticated access" on public.clinics;
drop policy if exists "Own profile" on public.profiles;
drop policy if exists "Insert own profile" on public.profiles;
drop policy if exists "Update own profile" on public.profiles;
drop policy if exists "Authenticated access" on public.bank_accounts;
drop policy if exists "Authenticated access" on public.card_fees;
drop policy if exists "Authenticated access" on public.categories;
drop policy if exists "Authenticated access" on public.revenues;
drop policy if exists "Authenticated access" on public.expenses;
drop policy if exists "Authenticated access" on public.customers;
drop policy if exists "Authenticated access" on public.bank_transactions;
drop policy if exists "Authenticated access" on public.clinic_users;
drop policy if exists "Authenticated access" on public.procedures;
drop policy if exists "Authenticated access" on public.pricing_expenses;
drop policy if exists "Authenticated access" on public.revenue_procedures;
drop policy if exists "Authenticated access" on public.professionals;
drop policy if exists "Authenticated access" on public.suppliers;

create policy "Authenticated access" on public.clinics for all
  to authenticated using (true) with check (true);

create policy "Own profile" on public.profiles for select
  to authenticated using (auth.uid() = id);
create policy "Insert own profile" on public.profiles for insert
  to authenticated with check (auth.uid() = id);
create policy "Update own profile" on public.profiles for update
  to authenticated using (auth.uid() = id);

create policy "Authenticated access" on public.bank_accounts for all
  to authenticated using (true) with check (true);

create policy "Authenticated access" on public.card_fees for all
  to authenticated using (true) with check (true);

create policy "Authenticated access" on public.categories for all
  to authenticated using (true) with check (true);

create policy "Authenticated access" on public.revenues for all
  to authenticated using (true) with check (true);

create policy "Authenticated access" on public.expenses for all
  to authenticated using (true) with check (true);

create policy "Authenticated access" on public.customers for all
  to authenticated using (true) with check (true);

create policy "Authenticated access" on public.bank_transactions for all
  to authenticated using (true) with check (true);

create policy "Authenticated access" on public.clinic_users for all
  to authenticated using (true) with check (true);
create policy "Authenticated access" on public.procedures for all
  to authenticated using (true) with check (true);
create policy "Authenticated access" on public.pricing_expenses for all
  to authenticated using (true) with check (true);
create policy "Authenticated access" on public.revenue_procedures for all
  to authenticated using (true) with check (true);
create policy "Authenticated access" on public.professionals for all
  to authenticated using (true) with check (true);
create policy "Authenticated access" on public.suppliers for all
  to authenticated using (true) with check (true);
