"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR");
}

export type ExistingClosure = {
  id: string;
  opening_balance: number;
  total_in: number;
  total_out: number;
  closing_balance: number;
  closed_by_name: string | null;
  closed_at: string;
  reopened: boolean;
};

export function CloseRegisterForm({
  organizationId,
  userId,
  unitId,
  unitName,
  closureDate,
  openingBalance,
  totalIn,
  totalOut,
  existingClosure,
  isAdmin,
}: {
  organizationId: string;
  userId: string;
  unitId: string;
  unitName: string;
  closureDate: string;
  openingBalance: number;
  totalIn: number;
  totalOut: number;
  existingClosure: ExistingClosure | null;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();

  const expected = openingBalance + totalIn - totalOut;

  const [counted, setCounted] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClose(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const closingBalance = Number(counted.replace(",", "."));

    const { error } = existingClosure
      ? await supabase
          .from("cash_closures")
          .update({
            opening_balance: openingBalance,
            total_in: totalIn,
            total_out: totalOut,
            closing_balance: closingBalance,
            closed_by: userId,
            closed_at: new Date().toISOString(),
            reopened: false,
          })
          .eq("id", existingClosure.id)
      : await supabase.from("cash_closures").insert({
          organization_id: organizationId,
          unit_id: unitId,
          closure_date: closureDate,
          opening_balance: openingBalance,
          total_in: totalIn,
          total_out: totalOut,
          closing_balance: closingBalance,
          closed_by: userId,
        });

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setCounted("");
    router.refresh();
  }

  async function handleReopen() {
    if (!existingClosure) return;
    setSaving(true);
    setError(null);

    const { error } = await supabase
      .from("cash_closures")
      .update({ reopened: true })
      .eq("id", existingClosure.id);

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.refresh();
  }

  // Caixa já fechado hoje e ninguém reabriu: mostra resumo, só.
  if (existingClosure && !existingClosure.reopened) {
    const diff = existingClosure.closing_balance - (existingClosure.opening_balance + existingClosure.total_in - existingClosure.total_out);

    return (
      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-medium text-foreground">{unitName}</h3>
          <span className="rounded-full bg-gold-100 px-2 py-0.5 text-xs text-gold-800">Fechado</span>
        </div>
        <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">Abertura</dt>
            <dd>{formatCurrency(existingClosure.opening_balance)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Entradas</dt>
            <dd>{formatCurrency(existingClosure.total_in)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Saídas</dt>
            <dd>{formatCurrency(existingClosure.total_out)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Contado</dt>
            <dd>{formatCurrency(existingClosure.closing_balance)}</dd>
          </div>
        </dl>
        <p className={`mt-2 text-sm ${diff === 0 ? "text-muted-foreground" : "text-destructive"}`}>
          {diff === 0
            ? "Sem diferença de caixa."
            : `Diferença de ${formatCurrency(diff)} (${diff > 0 ? "sobrou" : "faltou"}) em relação ao esperado.`}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Fechado em {formatDateTime(existingClosure.closed_at)}
          {existingClosure.closed_by_name ? ` por ${existingClosure.closed_by_name}` : ""}.
        </p>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        {isAdmin && (
          <button
            onClick={handleReopen}
            disabled={saving}
            className="mt-3 rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted disabled:opacity-60"
          >
            {saving ? "Reabrindo..." : "Reabrir caixa"}
          </button>
        )}
      </div>
    );
  }

  // Sem fechamento hoje, ou reaberto: formulário de fechar/atualizar.
  return (
    <form onSubmit={handleClose} className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-medium text-foreground">{unitName}</h3>
        {existingClosure?.reopened && (
          <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs text-muted-foreground">Reaberto</span>
        )}
      </div>
      <dl className="mb-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-muted-foreground">Abertura</dt>
          <dd>{formatCurrency(openingBalance)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Entradas (hoje)</dt>
          <dd>{formatCurrency(totalIn)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Saídas (hoje)</dt>
          <dd>{formatCurrency(totalOut)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Saldo esperado</dt>
          <dd className="font-medium">{formatCurrency(expected)}</dd>
        </div>
      </dl>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex-1 text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">Valor contado no caixa (R$)</span>
          <input
            required
            inputMode="decimal"
            value={counted}
            onChange={(e) => setCounted(e.target.value)}
            className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-gold-500"
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-gold-500 px-4 py-2 text-sm font-medium text-white hover:bg-gold-600 disabled:opacity-60"
        >
          {saving ? "Salvando..." : existingClosure ? "Atualizar fechamento" : "Fechar caixa"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </form>
  );
}
