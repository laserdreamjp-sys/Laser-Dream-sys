"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Option = { id: string; name: string };

const PAYMENT_METHODS = ["Dinheiro", "PIX", "Debito", "Credito", "Boleto", "Transferencia"];
const LEAD_ORIGINS = ["Instagram", "Indicacao", "Google", "WhatsApp", "Passante", "Outros"];

export function NewSaleForm({
  organizationId,
  userId,
  units,
  clients,
  procedures,
  packages,
}: {
  organizationId: string;
  userId: string;
  units: Option[];
  clients: Option[];
  procedures: Option[];
  packages: Option[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [saleDate, setSaleDate] = useState(new Date().toISOString().slice(0, 10));
  const [unitId, setUnitId] = useState(units[0]?.id ?? "");
  const [clientId, setClientId] = useState("");
  const [procedureId, setProcedureId] = useState("");
  const [packageId, setPackageId] = useState("");
  const [amount, setAmount] = useState("");
  const [installments, setInstallments] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]);
  const [leadOrigin, setLeadOrigin] = useState(LEAD_ORIGINS[0]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const { error } = await supabase.from("sales").insert({
      organization_id: organizationId,
      unit_id: unitId,
      sale_date: saleDate,
      client_id: clientId,
      procedure_id: procedureId || null,
      package_id: packageId || null,
      amount: Number(amount.replace(",", ".")),
      installments,
      payment_method: paymentMethod as never,
      lead_origin: leadOrigin as never,
      seller_id: userId,
      notes: notes || null,
      created_by: userId,
    });

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push("/vendas");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-4 rounded-lg border border-gold-100 bg-white p-6">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Data da venda">
          <input
            type="date"
            required
            value={saleDate}
            onChange={(e) => setSaleDate(e.target.value)}
            className="w-full rounded-md border border-gold-200 px-3 py-2 text-sm outline-none focus:border-gold-500"
          />
        </Field>

        <Field label="Unidade">
          <select
            required
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            className="w-full rounded-md border border-gold-200 px-3 py-2 text-sm outline-none focus:border-gold-500"
          >
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Cliente">
        <select
          required
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="w-full rounded-md border border-gold-200 px-3 py-2 text-sm outline-none focus:border-gold-500"
        >
          <option value="" disabled>
            Selecione o cliente
          </option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {clients.length === 0 && (
          <p className="mt-1 text-xs text-ink-500">
            Nenhum cliente cadastrado ainda. Cadastre em Clientes antes de lançar a venda.
          </p>
        )}
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Procedimento">
          <select
            value={procedureId}
            onChange={(e) => setProcedureId(e.target.value)}
            className="w-full rounded-md border border-gold-200 px-3 py-2 text-sm outline-none focus:border-gold-500"
          >
            <option value="">Nenhum</option>
            {procedures.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Pacote">
          <select
            value={packageId}
            onChange={(e) => setPackageId(e.target.value)}
            className="w-full rounded-md border border-gold-200 px-3 py-2 text-sm outline-none focus:border-gold-500"
          >
            <option value="">Nenhum</option>
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Valor (R$)">
          <input
            required
            inputMode="decimal"
            placeholder="0,00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-md border border-gold-200 px-3 py-2 text-sm outline-none focus:border-gold-500"
          />
        </Field>

        <Field label="Parcelas">
          <input
            type="number"
            min={1}
            max={18}
            required
            value={installments}
            onChange={(e) => setInstallments(Number(e.target.value))}
            className="w-full rounded-md border border-gold-200 px-3 py-2 text-sm outline-none focus:border-gold-500"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Forma de pagamento">
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full rounded-md border border-gold-200 px-3 py-2 text-sm outline-none focus:border-gold-500"
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Origem do lead">
          <select
            value={leadOrigin}
            onChange={(e) => setLeadOrigin(e.target.value)}
            className="w-full rounded-md border border-gold-200 px-3 py-2 text-sm outline-none focus:border-gold-500"
          >
            {LEAD_ORIGINS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Observação">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-gold-200 px-3 py-2 text-sm outline-none focus:border-gold-500"
        />
      </Field>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <button
        type="submit"
        disabled={saving || clients.length === 0}
        className="rounded-md bg-gold-500 px-6 py-2 text-sm font-medium text-white hover:bg-gold-600 disabled:opacity-60"
      >
        {saving ? "Salvando..." : "Registrar venda"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm text-ink-700">
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}
