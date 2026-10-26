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

/**
 * Tamanho de cada lote lido com .range(). Igual ao limite padrão de linhas
 * por resposta do PostgREST (max-rows = 1000); um lote maior seria cortado
 * pelo servidor sem erro.
 */
const PAGE_SIZE = 1000;

/**
 * Colunas da chave primária de cada tabela, usadas para ordenar a leitura.
 * Sem ordem estável, a paginação por .range() pode pular ou repetir linhas.
 */
const ORDER_COLUMNS: Record<BackupTable, string[]> = {
  org_settings: ["organization_id"],
  payment_methods: ["id"],
  lead_origins: ["id"],
  cash_categories: ["id"],
  sellers: ["id"],
  seller_pairs: ["seller_id", "partner_id"],
  procedures: ["id"],
  procedure_areas: ["id"],
  clients: ["id"],
  sales: ["id"],
  sale_areas: ["sale_id", "area_id"],
  cash_transactions: ["id"],
  cash_closures: ["id"],
  change_requests: ["id"],
};

export type BackupPayload = {
  /** 2: leitura paginada e campo `counts`. Arquivos version 1 não têm contagem. */
  version: 2;
  organization_id: string;
  generated_at: string;
  /** Quantidade de linhas gravadas por tabela (igual a tables[t].length). */
  counts: Record<string, number>;
  tables: Record<string, unknown[]>;
};

async function countRows(supabase: SupabaseClient, table: BackupTable): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) {
    throw new Error(`Falha ao contar a tabela ${table}: ${error.message}`);
  }
  if (count === null) {
    throw new Error(`O banco não devolveu a contagem da tabela ${table}.`);
  }
  return count;
}

async function readAllRows(supabase: SupabaseClient, table: BackupTable): Promise<unknown[]> {
  const rows: unknown[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase.from(table).select("*");
    for (const column of ORDER_COLUMNS[table]) {
      query = query.order(column, { ascending: true });
    }
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
    if (error) {
      throw new Error(`Falha ao ler a tabela ${table} (linhas a partir de ${from}): ${error.message}`);
    }
    const page = data ?? [];
    rows.push(...page);
    // Para só quando um lote volta vazio: assim um limite de servidor menor
    // que PAGE_SIZE não encerra a leitura antes da hora.
    if (page.length === 0) break;
  }
  return rows;
}

/**
 * Lê todas as linhas de cada tabela em lotes e confere com a contagem real.
 * Lança erro (e nenhum arquivo deve ser gravado) se alguma tabela vier com
 * menos linhas do que o banco informa: um backup truncado apagaria dados na
 * restauração, porque restore_from_backup esvazia as tabelas antes de recarregar.
 */
export async function buildBackupPayload(
  supabase: SupabaseClient,
  organizationId: string
): Promise<BackupPayload> {
  const tables: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};

  for (const table of BACKUP_TABLES) {
    const expected = await countRows(supabase, table);
    const rows = await readAllRows(supabase, table);
    if (rows.length < expected) {
      throw new Error(
        `Backup incompleto na tabela ${table}: lidas ${rows.length} de ${expected} linhas. Nenhum backup foi salvo.`
      );
    }
    tables[table] = rows;
    counts[table] = rows.length;
  }

  return {
    version: 2,
    organization_id: organizationId,
    generated_at: new Date().toISOString(),
    counts,
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
