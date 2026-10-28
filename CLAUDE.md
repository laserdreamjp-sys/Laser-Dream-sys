> **REGRA DE OURO: Sempre consulte o arquivo ARCHITECTURE.md antes de criar ou alterar qualquer código, e atualize tanto o ARCHITECTURE.md quanto o CLAUDE.md sempre que uma tabela ou funcionalidade for criada, editada ou removida.**

# CLAUDE.md: memória operacional do Laser Dream OS

Sistema de gestão de clínica (vendas, caixa, clientes, funil comercial, orçamentos, Radar de oportunidades, relatórios). Interface e dados em português do Brasil. Detalhes completos (dicionário de dados, regras de negócio, matriz de rastreabilidade, riscos) estão em `ARCHITECTURE.md`; este arquivo é o resumo operacional.

## 1. Comandos

| Objetivo | Comando |
|---|---|
| Instalar dependências | `npm install` |
| Rodar em desenvolvimento (http://localhost:3000) | `npm run dev` |
| Build de produção (inclui checagem de tipos) | `npm run build` |
| Servir o build | `npm run start` |
| Lint (ESLint padrão do Next) | `npm run lint` |
| Testes | `npm test` (vitest; um arquivo: `npx vitest run src/lib/datas.test.ts`). Regras puras novas em `src/lib/` ganham teste `*.test.ts` ao lado. Antes de publicar: `npm test` e `npm run build` |
| Página de SQL para o dono rodar (seção 12) | `python3 scripts/gerar-pagina-sql.py saida.html supabase/migrations/NNNN.sql --titulo ... --conferencia "select ..." --esperado coluna=valor` e publicar com a ferramenta Artifact |
| Auditar embeds ambíguos do Supabase | `python3 scripts/audit_embeds.py` (usa `scripts/fk_map.json`) |
| Deploy | push na branch `main` dispara deploy na Vercel; os crons vêm de `vercel.json` |
| Disparar cron manualmente | `curl -H "Authorization: Bearer $CRON_SECRET" https://<dominio>/api/cron/backup` e `/api/cron/funil-automacoes` |

Variáveis de ambiente (`.env.local` e painel da Vercel): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (somente servidor, usada pelos crons via `createServiceClient`), `CRON_SECRET`. Nunca expor a service role no cliente nem commitar valores.

Banco: Supabase, projeto `nlhohtbgtiuqyhewbjnu` (`laser-dream-os`, `sa-east-1`). Mudanças de schema são migrações numeradas (última: 0046); a partir da 0042 o SQL fica em `supabase/migrations/NNNN_nome.sql` e é aplicado com o mesmo nome no Supabase. Toda tabela nova precisa de `organization_id`, RLS habilitada e policies que usem `current_organization_id()`, `is_admin()`, `is_manager()` e `current_unit_ids()`.

## 2. Stack

Next.js 14.2.35 (App Router), React 18.3, TypeScript 5.5 em modo estrito, Tailwind 3.4, recharts, fflate (zip do backup), @dnd-kit, lucide-react, react-hook-form com zod, date-fns, Supabase (Postgres, Auth, Storage) com `@supabase/ssr` 0.5.1 e `supabase-js` 2.45.4, deploy na Vercel.

## 3. Padrões de código

1. Alias de import `@/` aponta para `src/`.
2. Textos de interface, mensagens de erro, nomes de papéis e valores de domínio em português; identificadores de banco em `snake_case` e em inglês ou português conforme já existem (ex.: `sale_date`, `valido_ate`, `tipo_venda`). Seguir o nome já usado na tabela, nunca renomear sem atualizar o `ARCHITECTURE.md`.
3. Páginas em `src/app/(app)/**/page.tsx` são Server Components que leem com `createClient` de `@/lib/supabase/server` e entregam dados a componentes de formulário marcados `"use client"`. Esses componentes gravam com o cliente de navegador (`@/lib/supabase/client`) e chamam `router.refresh()` depois.
4. Perfil e papel do usuário vêm de `getCurrentProfile()` (`src/lib/current-profile.ts`): `userId`, `organizationId`, `fullName`, `roleName`, `isAdmin`, `isManager`. O papel é comparado pelo nome (`Administrador`, `Gerente`).
5. Padrão administrador versus solicitação: administrador altera direto; os demais gravam uma linha em `change_requests` (`table_name`, `record_id`, `action`, `payload`, `reason`) e o administrador aprova em `/solicitacoes` (`request-actions.tsx`).
6. Embeds do PostgREST com mais de uma FK entre as tabelas devem usar o nome da FK (sintaxe `tabela!nome_da_fkey` dentro do `select`); conferir com `scripts/audit_embeds.py`.
7. Toda consulta de leitura em página deve passar por `unwrap(await consulta, "contexto")` de `src/lib/unwrap.ts`, que lança erro em vez de devolver lista vazia quando a consulta falha (evita tela zerada silenciosa).
8. Dados de teste: gravar com `is_test` vindo do modo teste (`localStorage` chave `laser_dream_modo_teste`, evento `modo-teste-mudou`); `limpar_dados_de_teste` apaga esses registros.
9. Dinheiro em `numeric`; datas de venda e caixa em `date`. "Hoje", "amanhã" e o mês corrente sempre por `hojeLocal`, `somarDias`, `mesAtualLocal`, `primeiroDiaDoMesLocal` e `dataLocal` de `src/lib/datas.ts` (fuso de Brasília); nunca `toISOString().slice(0,10)`, que dá a data em UTC.
10. Lista que pode passar de 1.000 linhas (clientes, vendas, `client_intelligence`, áreas de venda, caixa, exportações) usa `buscarTodas` de `src/lib/buscar-todas.ts`, com ordem estável terminando em coluna única. O Supabase corta em 1.000 sem erro.
11. Caixa: dia com `cash_closures` fechado bloqueia INSERT, UPDATE e DELETE em `cash_transactions` (trigger `trg_block_closed_day`).
12. Rotas de cron ficam em `/api/cron/*`, que o middleware deixa públicas (`rotaPublica`); validam `Authorization: Bearer CRON_SECRET` com `cronAutorizado` (recusa se a variável faltar) e usam a organização fixa `00000000-0000-0000-0000-000000000001`. Rota nova de cron fora desse prefixo seria redirecionada para `/login`.
13. Não criar migração, trigger ou função que repita efeito já existente. Antes de mexer em venda ou caixa, ler os triggers de `sales` e `cash_transactions` em `ARCHITECTURE.md` 1.2.4 e o risco 3 de 1.6.
14. Segurança: tabela nova não concede nada a `anon` (padrão fechado pela 0044); função nova termina com `revoke execute on function <nome> from public, anon;` e `grant execute ... to authenticated, service_role;`, e função de gatilho também sem `authenticated`. Só `get_invite_by_token` é aberta para `anon`. Serviço externo novo no navegador precisa entrar na CSP de `next.config.mjs`.
15. Senha de usuário passa por `problemaSenha` de `src/lib/senha.ts` (8 caracteres, minúscula, maiúscula e número) antes de `signUp` ou troca de senha.
16. Funil: mover lead passa sempre por `solicitarMovimento` em `funil-board.tsx` (Lista com "Mover ▾" e Quadro com arrastar usam o mesmo caminho e a mesma regra de motivo de perda); a visão escolhida fica em `localStorage` `laser_dream_funil_visao`.

## 4. Papéis

`Administrador` (tudo), `Gerente` (visão da organização, caixa das suas unidades, catálogos), qualquer outro papel (vendas das suas unidades; edição e exclusão via `change_requests`).

## 5. Banco de dados: referência rápida (42 tabelas, schema `public`)

Formato: coluna→tabela indica chave estrangeira. `organization_id` aparece em quase todas e aponta para `organizations`. Dicionário completo (tipos, obrigatoriedade, defaults, RLS, índices) em `ARCHITECTURE.md` 1.2.

| Tabela | PK | Colunas |
|---|---|---|
| `backups` | `id` | `id`, `organization_id`, `storage_path`, `size_bytes`, `kind`, `created_by`→profiles, `created_at` |
| `budget_item_areas` | `budget_item_id,area_id` | `budget_item_id`→budget_items, `area_id`→procedure_areas |
| `budget_items` | `id` | `id`, `budget_id`→budgets, `procedure_id`→procedures, `amount`, `position` |
| `budgets` | `id` | `id`, `organization_id`, `client_id`→clients, `opportunity_id`→opportunities, `seller_id`→sellers, `payment_method_id`→payment_methods, `desconto_valor`, `desconto_percentual`, `status`, `loss_reason_id`→loss_reasons, `notes`, `created_by`→profiles, `created_at`, `updated_at`, `valido_ate`, `is_test` |
| `cash_categories` | `id` | `id`, `organization_id`, `name`, `type`, `active` |
| `cash_closures` | `id` | `id`, `organization_id`, `unit_id`→units, `closure_date`, `opening_balance`, `total_in`, `total_out`, `closing_balance`, `closed_by`→profiles, `closed_at`, `reopened` |
| `cash_transactions` | `id` | `id`, `organization_id`, `unit_id`→units, `type`, `transaction_date`, `description`, `category_id`→cash_categories, `amount`, `responsible_id`→profiles, `sale_id`→sales, `receipt_url`, `created_by`→profiles, `created_at` |
| `change_requests` | `id` | `id`, `organization_id`, `table_name`, `record_id`, `record_label`, `action`, `payload`, `reason`, `status`, `requested_by`→profiles, `requested_at`, `resolved_by`→profiles, `resolved_at` |
| `client_merge_log` | `id` | `id`, `organization_id`, `kept_client_id`→clients, `absorbed_client_id`, `absorbed_snapshot`, `sales_moved`, `merged_by`→profiles, `merged_at` |
| `clients` | `id` | `id`, `organization_id`, `name`, `phone`, `email`, `created_at`, `birth_date`, `cpf`, `cep`, `logradouro`, `numero`, `complemento`, `bairro`, `cidade`, `uf`, `created_by`→profiles |
| `cpf_import_staging` | `id` | `id`, `organization_id`, `linha`, `cpf`, `nome`, `telefone`, `data_nascimento`, `cep`, `logradouro`, `numero`, `complemento`, `bairro`, `cidade`, `uf`, `match_client_id`→clients, `match_tipo`, `match_score`, `match_detalhe`, `aplicado`, `created_at` |
| `duplicate_flags` | `id` | `id`, `organization_id`, `kind`, `record_a`, `record_b`, `similarity`, `detail`, `status`, `resolved_by`→profiles, `resolved_at`, `created_at` |
| `funnels` | `id` | `id`, `organization_id`, `name`, `position`, `active`, `created_at` |
| `invites` | `id` | `id`, `organization_id`, `email`, `role_id`→roles, `unit_id`→units, `token`, `status`, `expires_at`, `created_by`→profiles, `created_at` |
| `lead_origins` | `id` | `id`, `organization_id`, `name`, `code`, `active`, `created_at` |
| `movimentacoes` | `id` | `id`, `organization_id`, `ocorrido_em`, `usuario_id`→profiles, `usuario_nome`, `acao`, `entidade`, `entidade_id`, `descricao`, `detalhes` |
| `loss_reasons` | `id` | `id`, `organization_id`, `name`, `active` |
| `opportunities` | `id` | `id`, `organization_id`, `unit_id`→units, `client_id`→clients, `stage_id`→pipeline_stages, `seller_id`→sellers, `lead_origin_id`→lead_origins, `estimated_value`, `notes`, `loss_reason_id`→loss_reasons, `sale_id`→sales, `created_by`→profiles, `created_at`, `updated_at`, `referred_by_name`, `interesse_procedure_id`→procedures, `data_avaliacao`, `is_test` |
| `opportunity_areas` | `opportunity_id,area_id` | `opportunity_id`→opportunities, `area_id`→procedure_areas |
| `opportunity_events` | `id` | `id`, `opportunity_id`→opportunities, `from_stage_id`→pipeline_stages, `to_stage_id`→pipeline_stages, `changed_by`→profiles, `created_at` |
| `opportunity_interest_areas` | `opportunity_id,area_id` | `opportunity_id`→opportunities, `area_id`→procedure_areas |
| `opportunity_notes` | `id` | `id`, `organization_id`, `opportunity_id`→opportunities, `author_id`→profiles, `content`, `created_at` |
| `opportunity_tags` | `opportunity_id,tag_id` | `opportunity_id`→opportunities, `tag_id`→tags |
| `opportunity_tasks` | `id` | `id`, `organization_id`, `opportunity_id`→opportunities, `title`, `due_date`, `done`, `assigned_to`→sellers, `created_by`→profiles, `created_at`, `auto_rule` |
| `org_settings` | `organization_id` | `organization_id`, `radar_retorno_min`, `radar_retorno_max`, `radar_risco_dias`, `radar_frio_dias`, `radar_ativo_dias`, `recorrente_alerta`, `recorrente_limite`, `ticket_atencao`, `ticket_meta`, `updated_at`, `tier_prata`, `tier_ouro`, `tier_diamante`, `duplicate_client_threshold`, `senha_exclusao_permanente` |
| `organizations` | `id` | `id`, `name`, `created_at` |
| `packages` | `id` | `id`, `organization_id`, `procedure_id`→procedures, `name`, `description`, `active` |
| `payment_methods` | `id` | `id`, `organization_id`, `name`, `code`, `active`, `created_at` |
| `pipeline_stages` | `id` | `id`, `organization_id`, `name`, `position`, `is_won`, `is_lost`, `created_at`, `funnel_id`→funnels |
| `procedure_areas` | `id` | `id`, `organization_id`, `segment`, `procedure_id`→procedures, `group_label`, `name`, `active` |
| `procedures` | `id` | `id`, `organization_id`, `name`, `category`, `active`, `segment` |
| `profiles` | `id` | `id`→users, `organization_id`, `role_id`→roles, `primary_unit_id`→units, `full_name`, `phone`, `active`, `created_at` |
| `role_permissions` | `id` | `id`, `role_id`→roles, `module`, `action`, `allowed` |
| `roles` | `id` | `id`, `organization_id`, `name`, `created_at` |
| `sale_areas` | `sale_id,area_id` | `sale_id`→sales, `area_id`→procedure_areas |
| `sales` | `id` | `id`, `organization_id`, `unit_id`→units, `sale_date`, `client_id`→clients, `procedure_id`→procedures, `package_id`→packages, `amount`, `installments`, `seller_id`→sellers, `notes`, `status`, `created_by`→profiles, `created_at`, `updated_by`→profiles, `updated_at`, `transaction_code`, `classificacao_financeira`, `tipo_venda`, `payment_method_id`→payment_methods, `lead_origin_id`→lead_origins, `co_seller_id`→sellers, `opportunity_id`→opportunities |
| `sales_history` | `id` | `id`, `sale_id`→sales, `changed_by`→profiles, `changed_at`, `field_name`, `old_value`, `new_value` |
| `seller_pairs` | `seller_id,partner_id` | `seller_id`→sellers, `partner_id`→sellers |
| `sellers` | `id` | `id`, `organization_id`, `unit_id`→units, `name`, `active`, `created_at` |
| `tags` | `id` | `id`, `organization_id`, `name`, `color`, `created_at` |
| `units` | `id` | `id`, `organization_id`, `name`, `city`, `active`, `created_at` |
| `user_units` | `user_id,unit_id` | `user_id`→profiles, `unit_id`→units |

View: `client_intelligence` (`security_invoker`, uma linha por cliente e unidade, com buckets e tiers do Radar). Bucket de Storage privado: `backups`.

## 6. Funções, RPCs e triggers

RPCs chamadas pela aplicação: `get_invite_by_token`, `buscar_clientes_parecidos`, `scan_duplicates`, `merge_clients`, `permanent_delete_sale`, `limpar_dados_de_teste`, `restore_from_backup`.

Funções de apoio a RLS: `current_organization_id`, `current_unit_ids`, `is_admin`, `is_manager`. Outras: `is_valid_cpf`, `classify_cpf_import`, `apply_cpf_import`, `avancar_followup`, `fn_block_closed_day`, `fn_handle_new_user`, `fn_sale_cash_sync`, `fn_sales_audit`, `fn_sales_classify`, `fn_registrar_movimentacao`.

Triggers: `trg_sales_classify` (BEFORE INSERT em `sales`), `trg_sales_audit` (AFTER UPDATE em `sales`), `trg_sale_cash_sync` (AFTER INSERT e UPDATE em `sales`, única origem da entrada de caixa de venda em dinheiro; índice único parcial `uq_cash_transactions_sale_id` garante uma entrada por venda), `trg_block_closed_day` (BEFORE INSERT, UPDATE e DELETE em `cash_transactions`), `trg_movimentacao` (AFTER INSERT, UPDATE e DELETE em 18 tabelas, grava `movimentacoes`; tabela nova com dado de negócio ganha esse gatilho), `trg_avancar_followup` (AFTER UPDATE em `opportunity_tasks`), `trg_handle_new_user` (AFTER INSERT em `auth.users`).

## 7. Rotas de API e crons

| Rota | Acesso | Função |
|---|---|---|
| `POST /api/backup/generate` | Administrador | Backup manual |
| `GET /api/backup/list` | Administrador | Lista backups com o link de download |
| `GET /api/backup/download/[id]` | Administrador | Entrega o backup pela própria origem do app, por padrão em `.zip` (`?formato=json` para o JSON puro), sempre como anexo |
| `POST /api/backup/restore` | Administrador | Restaura (exige `confirm = "RESTAURAR"`; `validarPayloadParaRestaurar` recusa backup `version: 1`, tabela faltando ou `counts` divergente; arquivo corrompido dá erro 400; faz backup de segurança antes) |
| `GET /api/cron/backup` | Bearer `CRON_SECRET` | Backup diário às 06:00 UTC, retenção de 30 dias |
| `GET /api/cron/funil-automacoes` | Bearer `CRON_SECRET` | Tarefas e etiquetas do funil e expiração de orçamentos, 09:00 UTC |
| `GET /api/relatorios/vendas`, `clientes-completo`, `clientes-procedimentos`, `radar` | Administrador | Exportações CSV |

## 8. Telas

`/login`, `/convite/[token]`, `/dashboard`, `/vendas`, `/vendas/novo`, `/caixa`, `/clientes`, `/clientes/[id]`, `/funil`, `/orcamentos`, `/orcamentos/novo`, `/orcamentos/[id]`, `/radar`, `/relatorios`, `/relatorios/funil`, `/solicitacoes`, `/usuarios`, `/configuracoes`, `/movimentacoes` (Histórico, só Administrador). Regras de cada uma em `ARCHITECTURE.md` 1.3.

## 9. Pontos de atenção atuais

Resumo dos riscos de `ARCHITECTURE.md` 1.6: (1) backup automático: corrigido (o middleware bloqueava o agendador e faltavam `CRON_SECRET` e `SUPABASE_SERVICE_ROLE_KEY` na Vercel); falta confirmar o primeiro backup `automatico` no banco; backups manuais existem; (2) resolvido: `buildBackupPayload` pagina, grava `counts` (formato `version: 3`, 32 tabelas) e falha se faltar linha, mas backups `version: 1` podem estar truncados; (3) resolvido na 0042: um só trigger lança a entrada de caixa da venda; (4) organização fixa no código; (5) resolvido na 0044: `anon` sem acesso a tabelas, só `get_invite_by_token` aberta; (9) resolvido: datas no fuso de Brasília; (14) resolvido: listas grandes paginadas com `buscarTodas`; (15) resolvido na 0045: histórico de alterações ativo, tela `/movimentacoes`; (16) resolvido na 0046: backup de 32 tabelas e restauração nova, aplicada e testada com dados reais; a restauração leva ~5 s e o limite da chamada logada é 8 s (ver risco 16 em `ARCHITECTURE.md`). A restauração recusa backup `version: 1` e backup cujo `counts` não bata com `tables`.

## 10. Como manter este arquivo

Ao criar, editar ou remover tabela, coluna, função, trigger, rota ou funcionalidade: atualizar a seção correspondente de `ARCHITECTURE.md` (1.2 dicionário, 1.3 funcionalidades, 1.4 matriz, 1.5 integrações), atualizar a tabela da seção 5 e as listas das seções 6 a 8 deste arquivo, e commitar tudo junto.

## 11. Papel do agente principal: liderança e coordenação

O agente principal lidera e coordena a equipe de agentes subordinados. Ele está acima dos demais e responde pelo resultado final de toda tarefa, inclusive das partes executadas por outros agentes.

### 11.1 Princípio geral

1. Delegar é o procedimento padrão. Sempre que um agente subordinado tiver capacidade para executar uma tarefa ou parte dela, o agente principal deve delegá-la em vez de executá-la.
2. A delegação nunca pode comprometer a qualidade, a segurança nem a conclusão da tarefa. Quando houver conflito entre delegar e proteger um desses três pontos, prevalece a proteção.
3. Delegar não transfere a responsabilidade. O agente principal continua responsável pelo resultado final, e um erro entregue por um subordinado e não detectado é um erro do agente principal.
4. O agente principal só usa os agentes e as capacidades que de fato existem no ambiente. Não deve presumir que um agente consegue executar algo sem que isso esteja confirmado.

### 11.2 Antes de agir

Antes de iniciar qualquer tarefa, o agente principal deve:

1. Entender o objetivo e o critério de sucesso da tarefa.
2. Dividir a tarefa em partes e identificar quais podem ser delegadas.
3. Escolher, para cada parte delegável, o agente mais adequado à natureza do trabalho.
4. Identificar dependências entre as partes e definir a ordem de execução. Partes independentes devem ser delegadas ao mesmo tempo.
5. Separar as partes que ele mesmo deve executar (ver 11.5).

### 11.3 Como delegar

Cada delegação deve conter, de forma explícita:

1. **Instrução clara:** o que deve ser feito, em linguagem objetiva e sem ambiguidade.
2. **Contexto suficiente:** o objetivo maior da tarefa, o que já foi apurado, os arquivos ou dados relevantes e as regras do projeto que se aplicam (por exemplo, as regras deste arquivo e do `ARCHITECTURE.md`). O subordinado não enxerga a conversa do agente principal; o que não for informado será desconhecido para ele.
3. **Resultado esperado:** o que deve ser entregue, em que formato e com qual critério de aceitação.
4. **Limites:** o que o agente não deve alterar e quais ações exigem aprovação prévia.

Não delegar a compreensão do problema. O agente principal define o que precisa ser resolvido; o subordinado executa.

### 11.4 Acompanhamento, revisão e integração

1. Acompanhar o andamento das tarefas delegadas e tratar sem demora qualquer bloqueio ou desvio.
2. Tratar todo resultado recebido como informação a ser verificada, nunca como verdade. Antes de aceitar, conferir se o resultado cumpre o pedido, se está correto e se respeita as regras do projeto.
3. Verificar a consistência entre as entregas de agentes diferentes e entre cada entrega e o restante do sistema.
4. Quando o resultado for insuficiente ou incorreto, devolver ao agente com a correção necessária ou corrigir diretamente.
5. Integrar as partes em um único resultado coerente e validar o conjunto antes de entregar ao usuário.
6. Relatar ao usuário o que foi concluído, o que não foi, o que foi alterado e quais problemas ocorreram, sem omitir falhas.

### 11.5 Quando o agente principal age diretamente

O agente principal deve executar ou intervir diretamente quando:

1. A tarefa não puder ser delegada porque nenhum agente disponível tem capacidade para ela.
2. A tarefa exigir decisão de coordenação, como priorização, resolução de conflito entre entregas, escolha entre alternativas ou definição de escopo.
3. A tarefa apresentar risco relevante, como perda de dados, alteração irreversível, ação em produção, segurança ou dinheiro. Nesses casos ele conduz a ação ou a supervisiona de perto e obtém a aprovação do usuário quando as regras exigirem.
4. O resultado entregue precisar de correção que seja mais segura ou mais rápida de fazer diretamente do que de devolver.
5. A delegação custar mais do que a execução, como em ajustes triviais que dependem de todo o contexto que ele já possui.

### 11.6 Regras de conduta

1. Não delegar só para delegar: se a delegação não melhora o resultado, a velocidade ou a segurança, executar diretamente.
2. Não aceitar entrega que não foi verificada.
3. Não declarar uma tarefa concluída sem ter confirmado que o resultado final cumpre o que foi pedido.
4. Manter a documentação (`ARCHITECTURE.md` e `CLAUDE.md`) atualizada no mesmo commit, independentemente de quem executou a alteração.

## 12. Ações no Supabase que o usuário precisa executar

Sempre que uma ação no Supabase depender do usuário (rodar SQL, aplicar migração, ajustar configuração), o agente publica um artefato de página única em português, legível no celular, com:

1. Link direto para o SQL Editor do projeto com consulta nova: `https://supabase.com/dashboard/project/nlhohtbgtiuqyhewbjnu/sql/new` (outras telas do painel também por link direto).
2. Passos numerados e curtos, com o resultado esperado de cada um (por exemplo, `Success. No rows returned`).
3. Um bloco de código por script, numerado, com botão "Copiar SQL N", para rodar um de cada vez e na ordem indicada. Avisar quando o Supabase pedir confirmação por causa de `drop`.
4. Uma consulta de conferência somente de leitura, com botão de copiar e a tabela dos valores esperados.
5. A instrução de parar no primeiro erro e enviar a mensagem exata.

Migrações continuam salvas em `supabase/migrations/NNNN_nome.sql` e documentadas em `ARCHITECTURE.md`; o artefato é só o meio de entrega ao usuário. Depois que o usuário confirmar, o agente confere o resultado no banco antes de dar a ação por concluída.
