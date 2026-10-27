import { describe, expect, it } from "vitest";
import { unzipSync } from "fflate";
import { criarRespostaDeBackup } from "./backup-resposta";

const json = new TextEncoder().encode(JSON.stringify({ version: 2, x: "é" }));

describe("criarRespostaDeBackup", () => {
  it("zip: cabeçalhos e corpo descompacta para o JSON original", async () => {
    const res = criarRespostaDeBackup({ nome: "backup-1.json", bytes: json, formato: "zip" });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/zip");
    expect(res.headers.get("Content-Disposition")).toBe(
      `attachment; filename="backup-1.zip"; filename*=UTF-8''backup-1.zip`
    );
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    const corpo = new Uint8Array(await res.arrayBuffer());
    expect(res.headers.get("Content-Length")).toBe(String(corpo.byteLength));
    const arquivos = unzipSync(corpo);
    expect(Array.from(arquivos["backup-1.json"])).toEqual(Array.from(json));
  });

  it("json: octet-stream com nome .json e corpo idêntico", async () => {
    const res = criarRespostaDeBackup({ nome: "backup-1.json", bytes: json, formato: "json" });
    expect(res.headers.get("Content-Type")).toBe("application/octet-stream");
    expect(res.headers.get("Content-Disposition")).toContain(`filename="backup-1.json"`);
    expect(res.headers.get("Content-Length")).toBe(String(json.byteLength));
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(Array.from(new Uint8Array(await res.arrayBuffer()))).toEqual(Array.from(json));
  });
});
