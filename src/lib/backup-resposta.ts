import { montarZipDoBackup, nomeDoZip } from "./backup-zip";

/**
 * Monta a resposta HTTP de download do backup. O formato padrão é zip, que o
 * Android abre/salva sem depender de como o navegador trata .json.
 */
export function criarRespostaDeBackup({
  nome,
  bytes,
  formato,
}: {
  nome: string;
  bytes: Uint8Array;
  formato: "zip" | "json";
}): Response {
  const zip = formato === "zip";
  const nomeFinal = zip ? nomeDoZip(nome) : nome;
  const corpo = zip ? montarZipDoBackup(nome, bytes) : bytes;
  const headers = new Headers({
    "Content-Type": zip ? "application/zip" : "application/octet-stream",
    "Content-Disposition": `attachment; filename="${nomeFinal}"; filename*=UTF-8''${encodeURIComponent(nomeFinal)}`,
    "Content-Length": String(corpo.byteLength),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  return new Response(corpo as unknown as BodyInit, { status: 200, headers });
}
