import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Falha alto em vez de falhar calado.
 *
 * O padrao `const { data } = await query` descarta o erro: se a consulta
 * quebra, data vira null e a tela mostra "nenhum registro" como se o banco
 * estivesse vazio. Foi exatamente assim que uma consulta quebrada deixou o
 * Dashboard e a tela de Vendas zerados tendo 1.684 vendas no banco.
 *
 * Use assim:
 *   const vendas = unwrap(await supabase.from("sales").select("..."), "vendas");
 */
export function unwrap<T>(
  res: { data: T | null; error: PostgrestError | null },
  contexto: string
): T {
  if (res.error) {
    throw new Error(
      `Falha ao carregar ${contexto}: ${res.error.message}` +
        (res.error.hint ? ` (dica: ${res.error.hint})` : "")
    );
  }
  return (res.data ?? []) as T;
}
