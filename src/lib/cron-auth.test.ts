import { describe, expect, it } from "vitest";
import { cronAutorizado } from "./cron-auth";

describe("cronAutorizado", () => {
  const secret = "uma-senha-longa-de-teste-1234567890";
  it("aceita o cabeçalho correto", () => {
    expect(cronAutorizado(`Bearer ${secret}`, secret)).toBe(true);
  });
  it("recusa senha errada, sem prefixo e cabeçalho ausente", () => {
    expect(cronAutorizado("Bearer outra", secret)).toBe(false);
    expect(cronAutorizado(secret, secret)).toBe(false);
    expect(cronAutorizado(null, secret)).toBe(false);
    expect(cronAutorizado("", secret)).toBe(false);
  });
  it("recusa tudo quando CRON_SECRET não está configurada, inclusive 'Bearer undefined'", () => {
    expect(cronAutorizado("Bearer undefined", undefined)).toBe(false);
    expect(cronAutorizado("Bearer ", "")).toBe(false);
    expect(cronAutorizado("Bearer ", undefined)).toBe(false);
  });
});
