import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import {
  BACKUP_TABLES,
  buildBackupPayload,
  LEGACY_V2_TABLES,
  RESTORE_DELETE_ORDER,
  RESTORE_INSERT_ORDER,
  validarPayloadParaRestaurar,
} from "@/lib/backup";

type Linha = Record<string, unknown>;
type Erro = { message: string };

type Opcoes = {
  /** Linhas em memória por tabela (tabela ausente = vazia). */
  dados?: Record<string, Linha[]>;
  /** Máximo de linhas por resposta do servidor (PostgREST max-rows). */
  maxPorResposta?: number;
  /** Contagem informada pelo servidor, quando diferente do real. */
  contagem?: Record<string, number>;
  /** Linhas que o servidor "perde" na leitura (some do resultado do range). */
  perdeNaLeitura?: Record<string, number>;
  /** Erro devolvido na leitura (range) de uma tabela. */
  erroNaLeitura?: Record<string, Erro>;
  /** Erro devolvido na contagem de uma tabela. */
  erroNaContagem?: Record<string, Erro>;
};

type Chamada = { tabela: string; order: string[]; de: number; ate: number };

/** Cliente Supabase falso, só com o que buildBackupPayload usa. */
function clienteFalso(op: Opcoes = {}) {
  const chamadas: Chamada[] = [];
  const max = op.maxPorResposta ?? 1000;

  const cliente = {
    from(tabela: string) {
      const todas = op.dados?.[tabela] ?? [];
      const visiveis = todas.slice(0, todas.length - (op.perdeNaLeitura?.[tabela] ?? 0));
      const ordem: string[] = [];

      const construtor = {
        select(_colunas: string, opcoes?: { count?: "exact"; head?: boolean }) {
          if (opcoes?.head) {
            const resposta = op.erroNaContagem?.[tabela]
              ? { data: null, count: null, error: op.erroNaContagem[tabela] }
              : { data: null, count: op.contagem?.[tabela] ?? todas.length, error: null };
            return Promise.resolve(resposta);
          }
          return construtor;
        },
        order(coluna: string) {
          ordem.push(coluna);
          return construtor;
        },
        range(de: number, ate: number) {
          chamadas.push({ tabela, order: [...ordem], de, ate });
          if (op.erroNaLeitura?.[tabela]) {
            return Promise.resolve({ data: null, error: op.erroNaLeitura[tabela] });
          }
          const fim = Math.min(ate + 1, de + max);
          return Promise.resolve({ data: visiveis.slice(de, fim), error: null });
        },
      };
      return construtor;
    },
  };

  return { cliente: cliente as unknown as SupabaseClient, chamadas };
}

function linhas(n: number, prefixo = "r"): Linha[] {
  return Array.from({ length: n }, (_, i) => ({ id: `${prefixo}-${String(i).padStart(5, "0")}` }));
}

const ORG = "00000000-0000-0000-0000-000000000001";

describe("buildBackupPayload", () => {
  it("gera version 3 com counts iguais ao tamanho de cada lista e lê mais de 1.000 linhas por completo", async () => {
    const dados: Record<string, Linha[]> = {
      clients: linhas(2345, "c"),
      sales: linhas(1000, "s"),
      opportunities: linhas(1001, "o"),
      sales_history: linhas(2500, "h"),
      sellers: linhas(7, "v"),
    };
    const { cliente, chamadas } = clienteFalso({ dados });

    const payload = await buildBackupPayload(cliente, ORG);

    expect(payload.version).toBe(3);
    expect(BACKUP_TABLES).toHaveLength(32);
    expect(payload.organization_id).toBe(ORG);
    expect(Number.isNaN(Date.parse(payload.generated_at))).toBe(false);
    expect(Object.keys(payload.tables).sort()).toEqual([...BACKUP_TABLES].sort());
    for (const tabela of BACKUP_TABLES) {
      expect(payload.counts[tabela]).toBe(payload.tables[tabela].length);
      expect(payload.tables[tabela]).toEqual(dados[tabela] ?? []);
    }
    expect(payload.counts.clients).toBe(2345);

    const lotesClientes = chamadas.filter((c) => c.tabela === "clients");
    expect(lotesClientes.map((c) => [c.de, c.ate])).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
      [2345, 3344],
    ]);
    expect(lotesClientes.every((c) => c.order.join(",") === "id")).toBe(true);

    const lotesPares = chamadas.filter((c) => c.tabela === "sale_areas");
    expect(lotesPares[0].order).toEqual(["sale_id", "area_id"]);
    const lotesTags = chamadas.filter((c) => c.tabela === "opportunity_tags");
    expect(lotesTags[0].order).toEqual(["opportunity_id", "tag_id"]);
    const lotesConfig = chamadas.filter((c) => c.tabela === "org_settings");
    expect(lotesConfig[0].order).toEqual(["organization_id"]);
  });

  it("lê tabelas novas com mais de 1.000 linhas", async () => {
    const dados = { budget_items: linhas(1500, "b"), opportunity_events: linhas(3000, "e") };
    const { cliente } = clienteFalso({ dados });
    const payload = await buildBackupPayload(cliente, ORG);
    expect(payload.counts.budget_items).toBe(1500);
    expect(payload.counts.opportunity_events).toBe(3000);
    expect(payload.tables.opportunity_events).toEqual(dados.opportunity_events);
  });

  it("não pula linhas se o servidor cortar em menos de 1.000 por resposta", async () => {
    const dados = { sales: linhas(1200, "s") };
    const { cliente } = clienteFalso({ dados, maxPorResposta: 500 });
    const payload = await buildBackupPayload(cliente, ORG);
    expect(payload.tables.sales).toEqual(dados.sales);
    expect(payload.counts.sales).toBe(1200);
  });

  it("lança erro com o nome da tabela quando o servidor perde linhas na leitura", async () => {
    const { cliente } = clienteFalso({
      dados: { clients: linhas(1500, "c") },
      perdeNaLeitura: { clients: 3 },
    });
    await expect(buildBackupPayload(cliente, ORG)).rejects.toThrow(
      "Backup incompleto na tabela clients: lidas 1497 de 1500 linhas."
    );
  });

  it("lança erro quando a contagem real é maior que o lido", async () => {
    const { cliente } = clienteFalso({
      dados: { sales: linhas(10, "s") },
      contagem: { sales: 11 },
    });
    await expect(buildBackupPayload(cliente, ORG)).rejects.toThrow(/tabela sales/);
  });

  it("lança erro quando a leitura de uma tabela falha", async () => {
    const { cliente } = clienteFalso({
      dados: { sales: linhas(5, "s") },
      erroNaLeitura: { sales: { message: "permission denied" } },
    });
    await expect(buildBackupPayload(cliente, ORG)).rejects.toThrow(
      "Falha ao ler a tabela sales (linhas a partir de 0): permission denied"
    );
  });

  it("lança erro quando a contagem de uma tabela falha", async () => {
    const { cliente } = clienteFalso({
      erroNaContagem: { procedures: { message: "timeout" } },
    });
    await expect(buildBackupPayload(cliente, ORG)).rejects.toThrow(
      "Falha ao contar a tabela procedures: timeout"
    );
  });
});

describe("ordem de restauração", () => {
  it("exclusão é o inverso da inserção e cobre as 32 tabelas", () => {
    expect(RESTORE_INSERT_ORDER).toEqual([...BACKUP_TABLES]);
    expect(RESTORE_DELETE_ORDER).toEqual([...BACKUP_TABLES].reverse());
    expect(new Set(BACKUP_TABLES).size).toBe(32);
  });
  it("as 14 tabelas antigas são subconjunto das 32", () => {
    expect(LEGACY_V2_TABLES).toHaveLength(14);
    for (const t of LEGACY_V2_TABLES) expect(BACKUP_TABLES).toContain(t);
  });
});

function arquivo(tabelas: readonly string[], versao = 3) {
  const tables: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};
  for (const t of tabelas) {
    tables[t] = [{ id: `${t}-1` }, { id: `${t}-2` }];
    counts[t] = 2;
  }
  return { version: versao, organization_id: ORG, generated_at: "2026-01-01T00:00:00Z", counts, tables };
}

describe("validarPayloadParaRestaurar", () => {
  it("aceita v3 completo", () => {
    expect(validarPayloadParaRestaurar(arquivo(BACKUP_TABLES))).toEqual({ ok: true, versao: 3 });
  });
  it("aceita v2 com as 14 tabelas", () => {
    expect(validarPayloadParaRestaurar(arquivo(LEGACY_V2_TABLES, 2))).toEqual({ ok: true, versao: 2 });
  });
  it("recusa v1", () => {
    const r = validarPayloadParaRestaurar({ version: 1, tables: {} });
    expect(r.ok).toBe(false);
  });
  it("recusa v2 com tabela faltando", () => {
    const a = arquivo(LEGACY_V2_TABLES, 2);
    delete a.tables.sales;
    const r = validarPayloadParaRestaurar(a);
    expect(r).toMatchObject({ ok: false });
    expect(!r.ok && r.erro).toContain("sales");
    expect(!r.ok && r.erro).toContain("nenhum dado foi alterado");
  });
  it("recusa v3 sem uma tabela", () => {
    const a = arquivo(BACKUP_TABLES);
    delete a.tables.budgets;
    const r = validarPayloadParaRestaurar(a);
    expect(!r.ok && r.erro).toContain("budgets");
  });
  it("recusa v3 com apenas as 14 tabelas antigas", () => {
    expect(validarPayloadParaRestaurar(arquivo(LEGACY_V2_TABLES, 3)).ok).toBe(false);
  });
  it("recusa counts divergente", () => {
    const a = arquivo(BACKUP_TABLES);
    a.counts.clients = 5;
    const r = validarPayloadParaRestaurar(a);
    expect(!r.ok && r.erro).toContain("clients");
  });
  it("recusa tabela sem contagem", () => {
    const a = arquivo(BACKUP_TABLES);
    delete a.counts.tags;
    expect(validarPayloadParaRestaurar(a).ok).toBe(false);
  });
  it("recusa tabela que não é lista", () => {
    const a = arquivo(BACKUP_TABLES) as { tables: Record<string, unknown> };
    a.tables.funnels = { id: 1 };
    const r = validarPayloadParaRestaurar(a);
    expect(!r.ok && r.erro).toContain("funnels");
  });
  it("recusa sem tables ou sem counts", () => {
    expect(validarPayloadParaRestaurar({ version: 3, counts: {} }).ok).toBe(false);
    expect(validarPayloadParaRestaurar({ version: 3, tables: {} }).ok).toBe(false);
  });
  it("recusa nulo, lista e texto", () => {
    expect(validarPayloadParaRestaurar(null).ok).toBe(false);
    expect(validarPayloadParaRestaurar([]).ok).toBe(false);
    expect(validarPayloadParaRestaurar("x").ok).toBe(false);
    expect(validarPayloadParaRestaurar(undefined).ok).toBe(false);
  });
});
