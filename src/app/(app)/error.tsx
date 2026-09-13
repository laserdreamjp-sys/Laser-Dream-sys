"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Laser Dream OS]", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl rounded-lg border border-destructive bg-destructive/5 p-6">
      <h2 className="font-display text-lg font-semibold text-destructive">
        Algo falhou ao carregar esta tela
      </h2>
      <p className="mt-2 text-sm text-foreground">
        O sistema não conseguiu buscar os dados. Isso não significa que algo foi perdido: os
        registros continuam salvos no banco.
      </p>
      <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs text-muted-foreground">
        {error.message}
      </pre>
      <button
        onClick={reset}
        className="mt-4 rounded-md bg-gold-500 px-4 py-2 text-sm font-medium text-white hover:bg-gold-600"
      >
        Tentar de novo
      </button>
    </div>
  );
}
