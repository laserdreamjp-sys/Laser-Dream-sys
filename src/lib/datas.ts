/**
 * Datas no fuso da clínica (America/Sao_Paulo).
 *
 * `new Date().toISOString().slice(0, 10)` devolve a data em UTC: depois das
 * 21h em Brasília já é o dia seguinte, e a venda, o lançamento de caixa ou a
 * tarefa caem no dia errado. O servidor da Vercel roda em UTC, então nem
 * `getDate()` serve no servidor. Use sempre estas funções para "hoje" e para
 * o mês corrente, no servidor e no navegador.
 */

const FUSO = "America/Sao_Paulo";

const formatador = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Data (AAAA-MM-DD) de um instante, no fuso de Brasília. */
export function dataLocal(instante: Date = new Date()): string {
  // en-CA formata como AAAA-MM-DD.
  return formatador.format(instante);
}

/** Hoje (AAAA-MM-DD) no fuso de Brasília. */
export function hojeLocal(): string {
  return dataLocal(new Date());
}

/** Soma (ou subtrai) dias a uma data AAAA-MM-DD, sem passar por fuso. */
export function somarDias(data: string, dias: number): string {
  const [a, m, d] = data.split("-").map(Number);
  const u = new Date(Date.UTC(a, m - 1, d + dias));
  return u.toISOString().slice(0, 10);
}

/** Mês corrente (AAAA-MM) no fuso de Brasília. */
export function mesAtualLocal(): string {
  return hojeLocal().slice(0, 7);
}

/** Primeiro dia do mês corrente (AAAA-MM-01) no fuso de Brasília. */
export function primeiroDiaDoMesLocal(): string {
  return `${mesAtualLocal()}-01`;
}
