"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type ChangeRequest = {
  id: string;
  table_name: string;
  record_id: string;
  record_label: string | null;
  action: "edit" | "delete";
  payload: Record<string, unknown> | null;
  requested_at: string;
  profiles: { full_name: string } | null;
};

const TABLE_LABELS: Record<string, string> = {
  sales: "Venda",
  cash_transactions: "Lançamento de caixa",
  clients: "Cliente",
  procedures: "Procedimento",
  sellers: "Vendedora",
  payment_methods: "Forma de pagamento",
  lead_origins: "Origem do lead",
  cash_categories: "Categoria de caixa",
};

export function RequestActions({ request, userId }: { request: ChangeRequest; userId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApprove() {
    setBusy(true);
    setError(null);

    if (request.action === "delete") {
      if (request.table_name === "sales") {
        const { error: applyError } = await supabase
          .from("sales")
          .update({ status: "cancelada", updated_by: userId })
          .eq("id", request.record_id);
        if (applyError) {
          setBusy(false);
          setError(applyError.message);
          return;
        }
      } else {
        const { error: applyError } = await supabase.from(request.table_name).delete().eq("id", request.record_id);
        if (applyError) {
          setBusy(false);
          setError(applyError.message);
          return;
        }
      }
    } else {
      const payload = { ...(request.payload ?? {}) };
      if (request.table_name === "sales") payload.updated_by = userId;

      const { error: applyError } = await supabase
        .from(request.table_name)
        .update(payload)
        .eq("id", request.record_id);
      if (applyError) {
        setBusy(false);
        setError(applyError.message);
        return;
      }
    }

    const { error: resolveError } = await supabase
      .from("change_requests")
      .update({ status: "aprovada", resolved_by: userId, resolved_at: new Date().toISOString() })
      .eq("id", request.id);

    setBusy(false);
    if (resolveError) {
      setError(resolveError.message);
      return;
    }
    router.refresh();
  }

  async function handleReject() {
    setBusy(true);
    setError(null);

    const { error: resolveError } = await supabase
      .from("change_requests")
      .update({ status: "rejeitada", resolved_by: userId, resolved_at: new Date().toISOString() })
      .eq("id", request.id);

    setBusy(false);
    if (resolveError) {
      setError(resolveError.message);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <div className="flex gap-2">
        <button
          onClick={handleApprove}
          disabled={busy}
          className="rounded-md bg-gold-500 px-3 py-1 text-xs font-medium text-white hover:bg-gold-600 disabled:opacity-60"
        >
          Aprovar
        </button>
        <button
          onClick={handleReject}
          disabled={busy}
          className="rounded-md border border-gold-200 px-3 py-1 text-xs text-ink-700 hover:bg-gold-50 disabled:opacity-60"
        >
          Rejeitar
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

export { TABLE_LABELS };
export type { ChangeRequest };
