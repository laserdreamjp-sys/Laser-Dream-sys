import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Tabelas de dados de negócio incluídas no backup (formato version 3, 32 tabelas).
 * Entram: configurações, catálogos (formas de pagamento, origens, categorias de
 * caixa, vendedoras, procedimentos, áreas, pacotes), funis, motivos de perda,
 * etiquetas, etapas, clientes, funil comercial (leads e tudo que pende deles),
 * vendas e histórico, caixa, solicitações, orçamentos, log de unificação e
 * duplicidades.
 * Ficam de fora de propósito: organizations, units, roles, profiles, user_units,
 * invites, role_permissions (identidade e permissão: restaurá-las poderia
 * quebrar login e papéis de acesso), backups (os próprios arquivos),
 * movimentacoes (histórico de alterações, que a restauração não apaga) e
 * cpf_import_staging (área temporária de importação).
 * A ordem da lista é a ordem de inserção da restauração (pais antes dos filhos)
 * e tem de ser idêntica à lista insert_v3 de restore_from_backup (migração 0046).
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
  "packages",
  "funnels",
  "loss_reasons",
  "tags",
  "pipeline_stages",
  "clients",
  "opportunities",
  "opportunity_areas",
  "opportunity_interest_areas",
  "opportunity_events",
  "opportunity_notes",
  "opportunity_tags",
  "opportunity_tasks",
  "sales",
  "sale_areas",
  "sales_history",
  "cash_transactions",
  "cash_closures",
  "change_requests",
  "budgets",
  "budget_items",
  "budget_item_areas",
  "client_merge_log",
  "duplicate_flags",
] as const;

/** Tabelas do formato antigo (version 2), ainda aceitas na restauração. */
export const LEGACY_V2_TABLES = [
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

/** Nome do arquivo de um backup, a partir do caminho no Storage (`<org>/backup-<carimbo>.json`). */
export function nomeDoArquivoDeBackup(storagePath: string): string {
  const nome = storagePath.split("/").pop() ?? "";
  const limpo = nome.replace(/[^A-Za-z0-9._-]/g, "_");
  return limpo.length > 0 ? limpo : "backup.json";
}

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
  packages: ["id"],
  funnels: ["id"],
  loss_reasons: ["id"],
  tags: ["id"],
  pipeline_stages: ["id"],
  clients: ["id"],
  opportunities: ["id"],
  opportunity_areas: ["opportunity_id", "area_id"],
  opportunity_interest_areas: ["opportunity_id", "area_id"],
  opportunity_events: ["id"],
  opportunity_notes: ["id"],
  opportunity_tags: ["opportunity_id", "tag_id"],
  opportunity_tasks: ["id"],
  sales: ["id"],
  sale_areas: ["sale_id", "area_id"],
  sales_history: ["id"],
  cash_transactions: ["id"],
  cash_closures: ["id"],
  change_requests: ["id"],
  budgets: ["id"],
  budget_items: ["id"],
  budget_item_areas: ["budget_item_id", "area_id"],
  client_merge_log: ["id"],
  duplicate_flags: ["id"],
};

export type BackupPayload = {
  /** 3: 32 tabelas. 2: 14 tabelas (ainda restaurável). 1: sem contagem, recusado. */
  version: 3;
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
  for (;;) {
    const from = rows.length;
    let query = supabase.from(table).select("*");
    for (const column of ORDER_COLUMNS[table]) {
      query = query.order(column, { ascending: true });
    }
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
    if (error) {
      throw new Error(`Falha ao ler a tabela ${table} (linhas a partir de ${from}): ${error.message}`);
    }
    const page = data ?? [];
    // Avança pelo que veio e para só no lote vazio: se o servidor tiver um
    // limite menor que PAGE_SIZE, nenhuma linha é pulada.
    if (page.length === 0) break;
    rows.push(...page);
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
    version: 3,
    organization_id: organizationId,
    generated_at: new Date().toISOString(),
    counts,
    tables,
  };
}

/**
 * Ordem de inserção ao restaurar: pais antes dos filhos. Igual a insert_v3 de
 * restore_from_backup (migração 0046).
 */
export const RESTORE_INSERT_ORDER: BackupTable[] = [...BACKUP_TABLES];

/**
 * Ordem de exclusão ao restaurar: filhos antes dos pais, para não violar
 * chave estrangeira. É o inverso da ordem de inserção.
 */
export const RESTORE_DELETE_ORDER: BackupTable[] = [...RESTORE_INSERT_ORDER].reverse();

/**
 * Confere, sem tocar no banco, se um arquivo de backup pode ser restaurado.
 * Aceita version 3 (32 tabelas) e version 2 (14 tabelas). Recusa tudo o mais.
 */
export function validarPayloadParaRestaurar(
  payload: unknown
): { ok: true; versao: 2 | 3 } | { ok: false; erro: string } {
  const falha = (erro: string) => ({ ok: false as const, erro });

  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return falha("Arquivo de backup inválido: o conteúdo não é um objeto. Restauração cancelada; nenhum dado foi alterado.");
  }
  const p = payload as Record<string, unknown>;
  const versao = p.version;
  if (versao !== 2 && versao !== 3) {
    return falha(
      "Este backup é de um formato antigo (version 1) ou desconhecido e pode estar incompleto, com no máximo 1.000 linhas por tabela. Restauração cancelada; nenhum dado foi alterado. Gere um backup novo e restaure a partir dele."
    );
  }
  const { tables, counts } = p;
  if (typeof tables !== "object" || tables === null || Array.isArray(tables)) {
    return falha("Backup inválido: o arquivo não traz a lista de tabelas. Restauração cancelada; nenhum dado foi alterado.");
  }
  if (typeof counts !== "object" || counts === null || Array.isArray(counts)) {
    return falha("Backup inválido: o arquivo não traz a contagem de linhas por tabela. Restauração cancelada; nenhum dado foi alterado.");
  }
  const t = tables as Record<string, unknown>;
  const c = counts as Record<string, unknown>;
  const exigidas: readonly string[] = versao === 3 ? BACKUP_TABLES : LEGACY_V2_TABLES;

  for (const tabela of exigidas) {
    if (!(tabela in t)) {
      return falha(`Backup incompleto: falta a tabela ${tabela}. Restauração cancelada; nenhum dado foi alterado.`);
    }
    const linhas = t[tabela];
    if (!Array.isArray(linhas)) {
      return falha(`Backup inválido: a tabela ${tabela} não é uma lista. Restauração cancelada; nenhum dado foi alterado.`);
    }
    const esperado = c[tabela];
    if (typeof esperado !== "number" || esperado !== linhas.length) {
      return falha(
        `Backup inconsistente na tabela ${tabela}: o arquivo registra ${typeof esperado === "number" ? esperado : "sem contagem"} linhas e contém ${linhas.length}. Restauração cancelada; nenhum dado foi alterado.`
      );
    }
  }
  return { ok: true, versao };
}
