"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function ClearTestDataButton() {
  const supabase = createClient();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleClick() {
    if (!confirm("Apagar todos os leads e orçamentos marcados como teste? Não tem volta.")) return;
    setBusy(true);
    setResult(null);
    const { data, error } = await supabase.rpc("limpar_dados_de_teste");
    setBusy(false);
    if (error) {
      setResult(`Erro: ${error.message}`);
      return;
    }
    const r = data as { leads_apagados: number; orcamentos_apagados: number };
    setResult(`Apagados: ${r.leads_apagados} lead(s) e ${r.orcamentos_apagados} orçamento(s) de teste.`);
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="mb-1 text-sm font-medium text-foreground">Limpar dados de teste</p>
      <p className="mb-3 text-xs text-muted-foreground">
        Apaga todo lead e orçamento criado com o "Modo de teste" ligado. Não afeta nada real.
      </p>
      <button
        onClick={handleClick}
        disabled={busy}
        className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
      >
        {busy ? "Limpando..." : "Limpar dados de teste"}
      </button>
      {result && <p className="mt-2 text-xs text-muted-foreground">{result}</p>}
    </div>
  );
}
