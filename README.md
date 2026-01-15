<div align="center">
  <img width="1200" height="475" alt="OnePay" src="https://ibb.co/gK1hZD4" />
</div>

# OnePay

Plataforma web para gestao financeira de clinicas medicas. Centraliza receitas, despesas, fluxo de caixa, DRE e indicadores para tomada de decisao com dados em tempo real.

## Beneficios

- Visao consolidada de contas bancarias e saldo atualizado.
- Fluxo de caixa previsto por dia e por mes.
- DRE por competencia e comparativos de receitas x despesas.
- Controle de receitas por forma de pagamento (credito, debito, pix, dinheiro, boleto, cheque).
- Analises de cartoes, conciliacao bancaria e indicadores comerciais.

## Requisitos de sistema

- Node.js 18+ e npm.
- Projeto Supabase (Auth, Database e Storage).
- Supabase CLI (opcional, para migrations e Edge Functions).

## Instalacao e configuracao

1) Instale as dependencias:

```bash
npm install
```

2) Configure as variaveis de ambiente:

```bash
cp .env.example .env.local
```

Preencha no `.env.local`:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Se for usar a Edge Function `clinic-assistant`, adicione tambem:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Opcional (modo hibrido de IA):

- `OPENAI_API_KEY`
- `OPENAI_MODEL`

3) Aplique as migrations no Supabase:

```bash
supabase db push
```

4) (Opcional) Deploy da Edge Function:

```bash
supabase functions deploy clinic-assistant
supabase secrets set SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=...
```

## Como rodar

```bash
npm run dev
```

Abra `http://localhost:5173` no navegador.

## Linting

```bash
npm run lint
```

## Build e preview

```bash
npm run build
npm run preview
```

## Exemplos de uso

- Cadastrar uma conta bancaria em `Contas Bancarias`.
- Lancar uma receita em PIX e conferir o saldo atualizado no dashboard.
- Acompanhar o fluxo de caixa em `?tab=caixa` e o DRE em `?tab=dre`.

## Contato e suporte

- Suporte: defina um canal interno (helpdesk/Slack) ou um email de suporte.
- Contato tecnico: atualize este README com o email do responsavel.

