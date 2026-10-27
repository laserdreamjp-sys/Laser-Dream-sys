-- 0043_remove_reverter_entrada_caixa
-- Após a 0042 nenhuma entrada de caixa recebe a descrição 'Venda em dinheiro',
-- então este trigger não apaga nada. O cancelamento da venda já é tratado por
-- fn_sale_cash_sync (trg_sale_cash_sync), que apaga os lançamentos da venda.
drop trigger if exists trg_reverter_entrada_caixa_venda_cancelada on public.sales;
drop function if exists public.reverter_entrada_caixa_venda_cancelada();
