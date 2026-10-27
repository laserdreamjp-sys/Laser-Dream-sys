import { describe, expect, it, vi } from "vitest";
import { baixarBackup, compartilharBackup, type DepsBaixar, type RespostaMinima } from "./backup-baixar";

function resposta(ok: boolean, status: number, corpo?: unknown): RespostaMinima {
  return {
    ok,
    status,
    headers: { get: (n) => (n === "Content-Disposition" ? `attachment; filename="b.zip"` : null) },
    arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    json: async () => {
      if (corpo === undefined) throw new Error("sem json");
      return corpo;
    },
  };
}

function montar(over: Partial<DepsBaixar> = {}) {
  const link = { href: "", download: "", click: vi.fn(), remove: vi.fn() };
  const agendados: Array<() => void> = [];
  const deps: DepsBaixar = {
    fetch: vi.fn(async () => resposta(true, 200)),
    criarLink: () => link,
    anexarLink: vi.fn(),
    criarUrl: () => "blob:x",
    revogarUrl: vi.fn(),
    agendar: (fn) => agendados.push(fn),
    ...over,
  };
  return { deps, link, agendados };
}

describe("baixarBackup", () => {
  it("sucesso: clica no link com o nome .zip e revoga depois", async () => {
    const { deps, link, agendados } = montar();
    const r = await baixarBackup("abc", deps);
    expect(deps.fetch).toHaveBeenCalledWith("/api/backup/download/abc?formato=zip");
    expect(link.download).toBe("b.zip");
    expect(link.click).toHaveBeenCalled();
    expect(r.tipo).toBe("sucesso");
    expect(r.mensagem).toBe("Arquivo b.zip salvo em Downloads (dentro dele está o backup .json).");
    expect(deps.revogarUrl).not.toHaveBeenCalled();
    agendados[0]();
    expect(deps.revogarUrl).toHaveBeenCalledWith("blob:x");
  });

  it("erro 403 mostra status e mensagem do JSON", async () => {
    const { deps, link } = montar({
      fetch: async () => resposta(false, 403, { error: "Apenas o administrador pode baixar backups." }),
    });
    const r = await baixarBackup("abc", deps);
    expect(r.tipo).toBe("erro");
    expect(r.mensagem).toBe("Não foi possível baixar (403): Apenas o administrador pode baixar backups.");
    expect(link.click).not.toHaveBeenCalled();
  });

  it("erro sem JSON ainda mostra o status", async () => {
    const { deps } = montar({ fetch: async () => resposta(false, 502) });
    const r = await baixarBackup("abc", deps);
    expect(r.mensagem).toContain("(502)");
  });

  it("erro de rede", async () => {
    const { deps } = montar({
      fetch: async () => {
        throw new TypeError("Failed to fetch");
      },
    });
    const r = await baixarBackup("abc", deps);
    expect(r.tipo).toBe("erro");
    expect(r.mensagem).toContain("falha de conexão");
  });
});

describe("compartilharBackup", () => {
  it("share suportado: chama share com o arquivo zip", async () => {
    const compartilhar = vi.fn(async (_d: { files: File[]; title: string }) => {});
    const { deps, link } = montar({ compartilhar, podeCompartilhar: () => true });
    const r = await compartilharBackup("abc", deps);
    expect(r.tipo).toBe("sucesso");
    const arg = compartilhar.mock.calls[0][0];
    expect(arg.files[0].name).toBe("b.zip");
    expect(arg.files[0].type).toBe("application/zip");
    expect(link.click).not.toHaveBeenCalled();
  });

  it("share cancelado (AbortError) não é erro", async () => {
    const abort = Object.assign(new Error("x"), { name: "AbortError" });
    const { deps } = montar({
      compartilhar: async () => {
        throw abort;
      },
      podeCompartilhar: () => true,
    });
    const r = await compartilharBackup("abc", deps);
    expect(r.tipo).toBe("cancelado");
  });

  it("share não suportado cai para download e avisa", async () => {
    const { deps, link } = montar({ podeCompartilhar: () => false });
    const r = await compartilharBackup("abc", deps);
    expect(link.click).toHaveBeenCalled();
    expect(r.tipo).toBe("aviso");
    expect(r.mensagem).toContain("salvo em Downloads");
  });

  it("erro 403 no compartilhar", async () => {
    const { deps } = montar({ fetch: async () => resposta(false, 403, { error: "Negado." }) });
    const r = await compartilharBackup("abc", deps);
    expect(r.mensagem).toBe("Não foi possível baixar (403): Negado.");
  });
});
