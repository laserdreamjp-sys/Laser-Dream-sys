"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Option = { id: string; name: string };

export function NewCashOutForm({
  organizationId,
  userId,
  units,
  categories,
}: {
  organizationId: string;
  userId: string;
  units: Option[];
  categories: Option[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [unitId, setUnitId] = useState(units[0]?.id ?? "");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const { error } = await supabase.from("cash_transactions").insert({
      organization_id: organizationId,
      unit_id: unitId,
      type: "saida",
      transaction_date: transactionDate,
      description,
      category_id: categoryId || null,
      amount: Number(amount.replace(",", ".")),
      responsible_id: userId,
      created_by: userId,
    });

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setDescription("");
    setAmount("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 grid grid-cols-1 gap-3 rounded-lg border border-gold-100 bg-white p-4 sm:grid-cols-6">
      <select
        value={unitId}
        onChange={(e) => setUnitId(e.target.value)}
        className="rounded-md border border-gold-200 px-3 py-2 text-sm outline-none focus:border-gold-500"
      >
        {units.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>

      <input
        type="date"
        required
        value={transactionDate}
        onChange={(e) => setTransactionDate(e.target.value)}
        className="rounded-md border border-gold-200 px-3 py-2 text-sm outline-none focus:border-gold-500"
      />

      <input
        required
        placeholder="Descrição"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="rounded-md border border-gold-200 px-3 py-2 text-sm outline-none focus:border-gold-500 sm:col-span-2"
      />

      <select
        value={categoryId}
        onChange={(e) => setCategoryId(e.target.value)}
        className="rounded-md border border-gold-200 px-3 py-2 text-sm outline-none focus:border-gold-500"
      >
        <option value="">Categoria</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <input
        required
        inputMode="decimal"
        placeholder="Valor (R$)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="rounded-md border border-gold-200 px-3 py-2 text-sm outline-none focus:border-gold-500"
      />

      {error && <p className="text-sm text-destructive sm:col-span-6">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-gold-500 px-4 py-2 text-sm font-medium text-white hover:bg-gold-600 disabled:opacity-60 sm:col-span-6 sm:w-fit"
      >
        {saving ? "Salvando..." : "Lançar saída"}
      </button>
    </form>
  );
}
