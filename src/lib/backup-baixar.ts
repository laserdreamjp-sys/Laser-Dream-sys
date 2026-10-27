/**
 * Lógica de download/compartilhamento do backup no navegador, pura e com
 * dependências injetadas (fetch, document, navigator, URL) para ser testável.
 */

export type RespostaMinima = {
  ok: boolean;
  status: number;
  headers: { get(nome: string): string | null };
  arrayBuffer(): Promise<ArrayBuffer>;
  json(): Promise<unknown>;
};

export type DepsBaixar = {
  fetch: (url: string) => Promise<RespostaMinima>;
  criarLink: () => { href: string; download: string; click(): void; remove(): void };
  anexarLink: (link: { remove(): void }) => void;
  criarUrl: (blob: Blob) => string;
  revogarUrl: (url: string) => void;
  agendar: (fn: () => void, ms: number) => void;
  compartilhar?: (dados: { files: File[]; title: string }) => Promise<void>;
  podeCompartilhar?: (dados: { files: File[] }) => boolean;
};

export type ResultadoBaixar = { tipo: "sucesso" | "aviso" | "cancelado" | "erro"; mensagem: string };

type Arquivo = { nome: string; bytes: Uint8Array };

function nomeDoCabecalho(res: RespostaMinima): string {
  const cd = res.headers.get("Content-Disposition") ?? "";
  const m = /filename="([^"]+)"/.exec(cd);
  return m?.[1] ?? "backup.zip";
}

async function buscarZip(
  id: string,
  deps: DepsBaixar
): Promise<{ arquivo: Arquivo } | { erro: ResultadoBaixar }> {
  let res: RespostaMinima;
  try {
    res = await deps.fetch(`/api/backup/download/${id}?formato=zip`);
  } catch (e) {
    const detalhe = e instanceof Error && e.message ? ` (${e.message})` : "";
    return {
      erro: {
        tipo: "erro",
        mensagem: `Não foi possível baixar: falha de conexão${detalhe}. Verifique a internet e tente de novo.`,
      },
    };
  }
  if (!res.ok) {
    let motivo = "";
    try {
      const corpo = (await res.json()) as { error?: unknown };
      if (typeof corpo?.error === "string") motivo = corpo.error;
    } catch {
      // corpo sem JSON
    }
    return {
      erro: {
        tipo: "erro",
        mensagem: `Não foi possível baixar (${res.status}): ${motivo || "resposta sem detalhes do servidor."}`,
      },
    };
  }
  try {
    const bytes = new Uint8Array(await res.arrayBuffer());
    return { arquivo: { nome: nomeDoCabecalho(res), bytes } };
  } catch {
    return { erro: { tipo: "erro", mensagem: "Não foi possível baixar: a transferência foi interrompida." } };
  }
}

function salvarArquivo(arquivo: Arquivo, deps: DepsBaixar) {
  const blob = new Blob([arquivo.bytes as BlobPart], { type: "application/zip" });
  const url = deps.criarUrl(blob);
  const link = deps.criarLink();
  link.href = url;
  link.download = arquivo.nome;
  deps.anexarLink(link);
  link.click();
  link.remove();
  deps.agendar(() => deps.revogarUrl(url), 10000);
}

export async function baixarBackup(id: string, deps: DepsBaixar): Promise<ResultadoBaixar> {
  const r = await buscarZip(id, deps);
  if ("erro" in r) return r.erro;
  try {
    salvarArquivo(r.arquivo, deps);
  } catch (e) {
    return { tipo: "erro", mensagem: `Não foi possível salvar o arquivo: ${e instanceof Error ? e.message : "erro desconhecido"}.` };
  }
  return {
    tipo: "sucesso",
    mensagem: `Arquivo ${r.arquivo.nome} salvo em Downloads (dentro dele está o backup .json).`,
  };
}

export async function compartilharBackup(id: string, deps: DepsBaixar): Promise<ResultadoBaixar> {
  const r = await buscarZip(id, deps);
  if ("erro" in r) return r.erro;
  const { arquivo } = r;
  const file = new File([arquivo.bytes as BlobPart], arquivo.nome, { type: "application/zip" });
  if (deps.compartilhar && deps.podeCompartilhar?.({ files: [file] })) {
    try {
      await deps.compartilhar({ files: [file], title: `Backup Laser Dream: ${arquivo.nome}` });
      return { tipo: "sucesso", mensagem: `Arquivo ${arquivo.nome} compartilhado.` };
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        return { tipo: "cancelado", mensagem: "Compartilhamento cancelado." };
      }
      return {
        tipo: "erro",
        mensagem: `Não foi possível compartilhar: ${e instanceof Error && e.message ? e.message : "erro desconhecido"}. Tente Baixar (.zip).`,
      };
    }
  }
  try {
    salvarArquivo(arquivo, deps);
  } catch (e) {
    return { tipo: "erro", mensagem: `Não foi possível salvar o arquivo: ${e instanceof Error ? e.message : "erro desconhecido"}.` };
  }
  return {
    tipo: "aviso",
    mensagem: `Este aparelho não permite compartilhar arquivos daqui. O arquivo ${arquivo.nome} foi salvo em Downloads (dentro dele está o backup .json).`,
  };
}
