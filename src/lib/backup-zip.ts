import { zipSync } from "fflate";

/** Empacota o JSON do backup num zip de um só arquivo (nível 6). */
export function montarZipDoBackup(nomeJson: string, conteudo: Uint8Array): Uint8Array {
  return zipSync({ [nomeJson]: conteudo }, { level: 6 });
}

/** Troca a extensão do nome por .zip (ou acrescenta, se não houver). */
export function nomeDoZip(nomeJson: string): string {
  const base = nomeJson.replace(/\.[^./\\]+$/, "");
  return `${base || "backup"}.zip`;
}
