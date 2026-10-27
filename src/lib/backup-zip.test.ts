import { describe, expect, it } from "vitest";
import { unzipSync } from "fflate";
import { montarZipDoBackup, nomeDoZip } from "./backup-zip";

describe("backup-zip", () => {
  it("ida e volta mantém o conteúdo e o nome do arquivo", () => {
    const conteudo = new TextEncoder().encode(JSON.stringify({ version: 2, nome: "Ação" }));
    const zip = montarZipDoBackup("backup-1.json", conteudo);
    const arquivos = unzipSync(zip);
    expect(Object.keys(arquivos)).toEqual(["backup-1.json"]);
    expect(Array.from(arquivos["backup-1.json"])).toEqual(Array.from(conteudo));
  });

  it("nomeDoZip troca a extensão", () => {
    expect(nomeDoZip("backup-2026-01-01.json")).toBe("backup-2026-01-01.zip");
    expect(nomeDoZip("a.b.json")).toBe("a.b.zip");
    expect(nomeDoZip("semextensao")).toBe("semextensao.zip");
  });
});
