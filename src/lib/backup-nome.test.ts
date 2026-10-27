import { describe, expect, it } from "vitest";
import { nomeDoArquivoDeBackup } from "./backup";

describe("nomeDoArquivoDeBackup", () => {
  it("pega o nome depois da última barra", () => {
    expect(nomeDoArquivoDeBackup("00000000-0000-0000-0000-000000000001/backup-2026-10-27T04-00-40-644Z.json")).toBe(
      "backup-2026-10-27T04-00-40-644Z.json"
    );
  });
  it("troca caracteres que quebram o cabeçalho de download", () => {
    expect(nomeDoArquivoDeBackup('org/back"up\r\n x.json')).toBe("back_up___x.json");
  });
  it("usa um nome padrão quando o caminho vem vazio", () => {
    expect(nomeDoArquivoDeBackup("")).toBe("backup.json");
    expect(nomeDoArquivoDeBackup("org/")).toBe("backup.json");
  });
});
