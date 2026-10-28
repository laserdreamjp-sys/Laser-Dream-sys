import { timingSafeEqual } from "node:crypto";

/**
 * Confere o cabeçalho Authorization de uma chamada de cron.
 * Recusa quando CRON_SECRET não está configurada (ou está vazia): sem isso,
 * comparar com `Bearer ${undefined}` deixaria passar quem mandasse
 * "Bearer undefined". A comparação é em tempo constante.
 */
export function cronAutorizado(authorization: string | null, secret: string | undefined): boolean {
  if (!secret || !authorization) return false;
  const esperado = Buffer.from(`Bearer ${secret}`);
  const recebido = Buffer.from(authorization);
  if (recebido.length !== esperado.length) return false;
  return timingSafeEqual(recebido, esperado);
}
