import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { BACKUP_TABLES, buildBackupPayload } from "@/lib/backup";

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
  it("gera version 2 com counts iguais ao tamanho de cada lista e lê mais de 1.000 linhas por completo", async () => {
    const dados: Record<string, Linha[]> = {
      clients: linhas(2345, "c"),
      sales: linhas(1000, "s"),
      sellers: linhas(7, "v"),
    };
    const { cliente, chamadas } = clienteFalso({ dados });

    const payload = await buildBackupPayload(cliente, ORG);

    expect(payload.version).toBe(2);
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
