import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Tabelas de dados de negócio incluídas no backup.
 * Propositalmente NÃO inclui organizations/units/roles/profiles/invites/
 * role_permissions/user_units: são estrutura de identidade e permissão,
 * e restaurá-las erroneamente poderia quebrar login e papéis de acesso.
 * O backup e a restauração cobrem o que realmente muda no dia a dia:
 * catálogos, clientes, vendas e configurações.
 */
export const BACKUP_TABLES = [
  "org_settings",
  "payment_methods",
  "lead_origins",
  "cash_categories",
  "sellers",
  "seller_pairs",
  "procedures",
  "procedure_areas",
  "clients",
  "sales",
  "sale_areas",
  "cash_transactions",
  "cash_closures",
  "change_requests",
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];

export type BackupPayload = {
  version: 1;
  organization_id: string;
  generated_at: string;
  tables: Record<string, unknown[]>;
};

export async function buildBackupPayload(
  supabase: SupabaseClient,
  organizationId: string
): Promise<BackupPayload> {
  const tables: Record<string, unknown[]> = {};

  for (const table of BACKUP_TABLES) {
    const { data, error } = await supabase.from(table).select("*");
    if (error) {
      throw new Error(`Falha ao ler a tabela ${table}: ${error.message}`);
    }
    tables[table] = data ?? [];
  }

  return {
    version: 1,
    organization_id: organizationId,
    generated_at: new Date().toISOString(),
    tables,
  };
}

/**
 * Ordem de exclusão ao restaurar: filhos antes dos pais, para não violar
 * chave estrangeira. É o inverso da ordem de inserção.
 */
export const RESTORE_DELETE_ORDER: BackupTable[] = [
  "change_requests",
  "cash_closures",
  "cash_transactions",
  "sale_areas",
  "sales",
  "procedure_areas",
  "procedures",
  "seller_pairs",
  "sellers",
  "cash_categories",
  "lead_origins",
  "payment_methods",
  "clients",
  "org_settings",
];

export const RESTORE_INSERT_ORDER: BackupTable[] = [...RESTORE_DELETE_ORDER].reverse();
