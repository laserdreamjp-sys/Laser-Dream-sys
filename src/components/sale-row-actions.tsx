"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type PaymentOption = { id: string; name: string };

export function SaleRowActions({
  saleId,
  organizationId,
  userId,
  isAdmin,
  currentAmount,
  currentPaymentMethodId,
  currentNotes,
  paymentMethods,
}: {
  saleId: string;
  organizationId: string;
  userId: string;
  isAdmin: boolean;
  currentAmount: number;
  currentPaymentMethodId: string;
  currentNotes: string | null;
  paymentMethods: PaymentOption[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(currentAmount));
  const [paymentMethodId, setPaymentMethodId] = useState(currentPaymentMethodId);
  const [notes, setNotes] = useState(currentNotes ?? "");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSaveEdit() {
    setBusy(true);
    const payload = {
      amount: Number(amount.replace(",", ".")),
      payment_method_id: paymentMethodId,
      notes: notes || null,
    };

    if (isAdmin) {
      const { error } = await supabase
        .from("sales")
        .update({ ...payload, updated_by: userId })
        .eq("id", saleId);
      setBusy(false);
      if (!error) {
        setEditing(false);
        router.refresh();
      }
      return;
    }

    const { error } = await supabase.from("change_requests").insert({
      organization_id: organizationId,
      table_name: "sales",
      record_id: saleId,
      action: "edit",
      payload,
      requested_by: userId,
    });
    setBusy(false);
    if (!error) {
      setEditing(false);
      setNotice("Solicitação enviada ao administrador.");
    }
  }

  async function handleCancelSale() {
    if (!confirm(isAdmin ? "Cancelar esta venda?" : "Solicitar o cancelamento desta venda?")) return;
    setBusy(true);

    if (isAdmin) {
      const { error } = await supabase
        .from("sales")
        .update({ status: "cancelada", updated_by: userId })
        .eq("id", saleId);
      setBusy(false);
      if (!error) router.refresh();
      return;
    }

    const { error } = await supabase.from("change_requests").insert({
      organization_id: organizationId,
      table_name: "sales",
      record_id: saleId,
      action: "delete",
      requested_by: userId,
    });
    setBusy(false);
    if (!error) setNotice("Solicitação de cancelamento enviada ao administrador.");
  }

  if (notice) {
    return <p className="text-xs text-gold-700">{notice}</p>;
  }

  if (editing) {
    return (
      <div className="flex flex-wrap items-center gap-1">
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-20 rounded border border-border px-1 py-0.5 text-xs"
        />
        <select
          value={paymentMethodId}
          onChange={(e) => setPaymentMethodId(e.target.value)}
          className="rounded border border-border px-1 py-0.5 text-xs"
        >
          {paymentMethods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          onClick={handleSaveEdit}
          disabled={busy}
          className="rounded bg-gold-500 px-2 py-0.5 text-xs text-white"
        >
          {isAdmin ? "Salvar" : "Enviar"}
        </button>
        <button onClick={() => setEditing(false)} className="text-xs text-muted-foreground underline">
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <button onClick={() => setEditing(true)} className="text-xs text-gold-700 underline underline-offset-2">
        {isAdmin ? "Editar" : "Solicitar alteração"}
      </button>
      <button onClick={handleCancelSale} disabled={busy} className="text-xs text-destructive underline underline-offset-2">
        {isAdmin ? "Cancelar" : "Solicitar cancelamento"}
      </button>
    </div>
  );
}
