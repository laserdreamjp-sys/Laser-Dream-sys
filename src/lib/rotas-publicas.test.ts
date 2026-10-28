import { describe, expect, it } from "vitest";
import { rotaPublica } from "./rotas-publicas";

describe("rotaPublica", () => {
  it("libera login e convite", () => {
    expect(rotaPublica("/login")).toBe(true);
    expect(rotaPublica("/convite/abc-123")).toBe(true);
  });
  it("libera as rotas de cron, que se protegem com CRON_SECRET", () => {
    expect(rotaPublica("/api/cron/backup")).toBe(true);
    expect(rotaPublica("/api/cron/funil-automacoes")).toBe(true);
  });
  it("continua exigindo sessão nas demais rotas, inclusive nas de backup e relatórios", () => {
    for (const p of [
      "/", "/dashboard", "/vendas", "/movimentacoes", "/configuracoes",
      "/api/backup/list", "/api/backup/download/1", "/api/backup/restore", "/api/backup/generate",
      "/api/relatorios/vendas",
    ]) {
      expect(rotaPublica(p)).toBe(false);
    }
  });
  it("não confunde prefixos parecidos com /api/cron", () => {
    expect(rotaPublica("/api/cronos")).toBe(false);
    expect(rotaPublica("/api/crontab/x")).toBe(false);
    expect(rotaPublica("/x/api/cron/backup")).toBe(false);
  });
});
