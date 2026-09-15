"use client";

import { useRouter, usePathname } from "next/navigation";

export function Pagination({
  page,
  pageSize,
  total,
  otherParams = {},
}: {
  page: number;
  pageSize: number;
  total: number;
  otherParams?: Record<string, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function irPara(novaPagina: number, novoTamanho?: number) {
    const params = new URLSearchParams(otherParams);
    params.set("pagina", String(novaPagina));
    params.set("porPagina", String(novoTamanho ?? pageSize));
    router.push(`${pathname}?${params.toString()}`);
  }

  const inicio = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const fim = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm">
      <p className="text-xs text-muted-foreground">
        {inicio}–{fim} de {total}
      </p>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Por página
          <select
            value={pageSize}
            onChange={(e) => irPara(1, Number(e.target.value))}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs"
          >
            {[25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-1">
          <button
            onClick={() => irPara(page - 1)}
            disabled={page <= 1}
            className="rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-muted disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="px-2 py-1 text-xs text-muted-foreground">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => irPara(page + 1)}
            disabled={page >= totalPages}
            className="rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-muted disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
}
