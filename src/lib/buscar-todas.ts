import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Lê todas as linhas de uma consulta, em lotes.
 *
 * O Supabase devolve no máximo 1.000 linhas por resposta e corta o resto sem
 * erro. Com 4.672 clientes e 1.686 vendas, qualquer lista que não pagina
 * (Radar, exportações CSV) mostra só parte dos dados como se fosse tudo.
 *
 * Recebe uma função que monta a consulta para um intervalo, porque o mesmo
 * objeto de consulta não pode ser reaproveitado entre lotes. A consulta
 * PRECISA ter ordem estável e única (termine o `order` numa coluna única,
 * como `id`), senão lotes podem pular ou repetir linhas.
 *
 * Lança erro em vez de devolver lista parcial ou vazia (mesmo princípio do
 * `unwrap`).
 *
 *   const vendas = await buscarTodas(
 *     (de, ate) => supabase.from("sales").select("id, amount")
 *       .order("sale_date").order("id").range(de, ate),
 *     "as vendas"
 *   );
 */
export const TAMANHO_DO_LOTE = 1000;

type Resposta<T> = PromiseLike<{ data: T[] | null; error: PostgrestError | null }>;

export async function buscarTodas<T>(
  consulta: (de: number, ate: number) => Resposta<T>,
  contexto: string,
  limite = 50000
): Promise<T[]> {
  const linhas: T[] = [];
  while (linhas.length < limite) {
    const de = linhas.length;
    const { data, error } = await consulta(de, de + TAMANHO_DO_LOTE - 1);
    if (error) {
      throw new Error(
        `Falha ao carregar ${contexto}: ${error.message}` + (error.hint ? ` (dica: ${error.hint})` : "")
      );
    }
    const lote = data ?? [];
    // Avança pelo que veio e só para no lote vazio: se o servidor tiver um
    // limite menor que o lote, nenhuma linha é pulada.
    if (lote.length === 0) return linhas;
    linhas.push(...lote);
  }
  throw new Error(`Falha ao carregar ${contexto}: chegou ao limite de ${limite} linhas; refine o filtro.`);
}
