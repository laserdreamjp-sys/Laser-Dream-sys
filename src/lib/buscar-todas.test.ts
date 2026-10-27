import type { PostgrestError } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { TAMANHO_DO_LOTE, buscarTodas } from "@/lib/buscar-todas";

type Linha = { id: number };
type Resposta = { data: Linha[] | null; error: PostgrestError | null };

function linhas(n: number): Linha[] {
  return Array.from({ length: n }, (_, i) => ({ id: i }));
}

function erro(message: string, hint = ""): PostgrestError {
  return { message, details: "", hint, code: "XX000", name: "PostgrestError" } as PostgrestError;
}

/** Servidor falso: devolve o intervalo pedido, cortado em `maxPorResposta`. */
function servidor(dados: Linha[], maxPorResposta = Infinity) {
  return vi.fn(async (de: number, ate: number): Promise<Resposta> => {
    const fim = Math.min(ate + 1, de + maxPorResposta);
    return { data: dados.slice(de, fim), error: null };
  });
}

describe("buscarTodas", () => {
  it("junta lotes até vir lote vazio", async () => {
    const dados = linhas(2500);
    const consulta = servidor(dados);
    const resultado = await buscarTodas(consulta, "as vendas");
    expect(resultado).toEqual(dados);
    expect(consulta.mock.calls).toEqual([
      [0, TAMANHO_DO_LOTE - 1],
      [1000, 1999],
      [2000, 2999],
      [2500, 3499],
    ]);
  });

  it("não pula linhas quando o servidor corta em menos que o lote", async () => {
    const dados = linhas(1000);
    const consulta = servidor(dados, 400);
    const resultado = await buscarTodas(consulta, "os clientes");
    expect(resultado).toHaveLength(1000);
    expect(resultado.map((l) => l.id)).toEqual(dados.map((l) => l.id));
    expect(consulta.mock.calls).toEqual([
      [0, 999],
      [400, 1399],
      [800, 1799],
      [1000, 1999],
    ]);
  });

  it("lista vazia devolve []", async () => {
    const consulta = servidor([]);
    await expect(buscarTodas(consulta, "nada")).resolves.toEqual([]);
    expect(consulta).toHaveBeenCalledTimes(1);
  });

  it("data null é tratado como lote vazio", async () => {
    const consulta = vi.fn(async (): Promise<Resposta> => ({ data: null, error: null }));
    await expect(buscarTodas(consulta, "nada")).resolves.toEqual([]);
  });

  it("erro no primeiro lote lança Error com o contexto", async () => {
    const consulta = vi.fn(async (): Promise<Resposta> => ({ data: null, error: erro("timeout") }));
    await expect(buscarTodas(consulta, "o Radar")).rejects.toThrow("Falha ao carregar o Radar: timeout");
  });

  it("erro num lote do meio lança em vez de devolver lista parcial", async () => {
    const dados = linhas(3000);
    const consulta = vi.fn(async (de: number, ate: number): Promise<Resposta> => {
      if (de === 1000) return { data: null, error: erro("conexão perdida", "tente de novo") };
      return { data: dados.slice(de, ate + 1), error: null };
    });
    const falha = await buscarTodas(consulta, "as vendas").catch((e: unknown) => e);
    expect(falha).toBeInstanceOf(Error);
    expect((falha as Error).message).toBe("Falha ao carregar as vendas: conexão perdida (dica: tente de novo)");
    expect(consulta).toHaveBeenCalledTimes(2);
  });

  it("passar do limite lança erro", async () => {
    const consulta = servidor(linhas(5000));
    await expect(buscarTodas(consulta, "os clientes", 3000)).rejects.toThrow(
      "Falha ao carregar os clientes: chegou ao limite de 3000 linhas; refine o filtro."
    );
  });

  it("exatamente no limite também lança (não confirma que acabou)", async () => {
    const consulta = servidor(linhas(2000));
    await expect(buscarTodas(consulta, "os clientes", 2000)).rejects.toThrow("chegou ao limite de 2000 linhas");
  });
});
