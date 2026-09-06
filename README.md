# Laser Dream OS

Gestão de vendas e controle de caixa da Laser Dream. Next.js 14 + Supabase.

## Rodando localmente

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

## Infraestrutura

- Banco: Supabase, projeto `laser-dream-os` (ref `nlhohtbgtiuqyhewbjnu`), região `sa-east-1`.
- Deploy: Vercel, importando este repositório e configurando as duas variáveis de `.env.local.example` em Project Settings → Environment Variables.
- Autenticação: Supabase Auth, cadastro somente por convite (tabela `invites`). O primeiro acesso do Administrador usa o link `/convite/[token]` gerado no banco.

## Estrutura

- `src/app/login` — login por e-mail e senha.
- `src/app/convite/[token]` — aceite de convite e criação de conta.
- `src/app/(app)` — área logada (dashboard, vendas, caixa, clientes, usuários, configurações), protegida pelo middleware.
- `src/lib/supabase` — clientes Supabase (browser e servidor).
- `src/types/database.ts` — tipos TypeScript gerados a partir do schema real do banco.

## Estado atual (fase 1 do plano)

Feito: schema completo, RLS, fluxo de convite, login, layout com sidebar, dashboard com KPIs reais, listagem de vendas.

Próximo: formulário de nova venda, módulo de caixa, matriz de permissões editável, exportação para Excel/CSV.
