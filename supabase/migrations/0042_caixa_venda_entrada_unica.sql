-- 0042_caixa_venda_entrada_unica
-- Risco 3 (ARCHITECTURE.md 1.6): venda em dinheiro gerava duas entradas de caixa,
-- porque trg_lancar_entrada_caixa_venda e trg_sale_cash_sync inseriam em
-- cash_transactions no mesmo AFTER INSERT em sales.
-- Depois desta migração, fn_sale_cash_sync (trigger trg_sale_cash_sync) é a única
-- origem do lançamento automático, e o banco recusa um segundo lançamento por venda.

-- 1. Remove o trigger duplicado e sua função (nenhuma outra função a referencia).
drop trigger if exists trg_lancar_entrada_caixa_venda on public.sales;
drop function if exists public.lancar_entrada_caixa_venda();

-- 2. No máximo um lançamento de caixa por venda.
--    Lançamentos manuais (sale_id nulo) continuam livres.
--    Em 26/10/2026 cash_transactions tem 0 linhas, então não há duplicata a limpar.
create unique index if not exists uq_cash_transactions_sale_id
  on public.cash_transactions (sale_id)
  where sale_id is not null;
