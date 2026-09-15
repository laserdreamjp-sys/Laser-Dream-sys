export const TABLE_LABELS: Record<string, string> = {
  sales: "Venda",
  cash_transactions: "Lançamento de caixa",
  clients: "Cliente",
  procedures: "Procedimento",
  sellers: "Vendedora",
  payment_methods: "Forma de pagamento",
  lead_origins: "Origem do lead",
  cash_categories: "Categoria de caixa",
};

export type ChangeRequest = {
  id: string;
  table_name: string;
  record_id: string;
  record_label: string | null;
  action: "edit" | "delete";
  payload: Record<string, unknown> | null;
  requested_at: string;
  profiles: { full_name: string } | null;
};
