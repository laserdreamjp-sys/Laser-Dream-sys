"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ClientAutocomplete } from "@/components/client-autocomplete";

type Option = { id: string; name: string };
type Seller = { id: string; name: string; unit_id: string | null };
type Procedure = { id: string; name: string; segment: "laser" | "estetica" };
type Area = { id: string; name: string; group_label: string | null; procedure_id: string | null; segment: string | null };
type CatalogItem = { id: string; name: string; code: string };

export function NewSaleForm({
  organizationId,
  userId,
  units,
  clients,
  sellers,
  procedures,
  areas,
  paymentMethods,
  leadOrigins,
}: {
  organizationId: string;
  userId: string;
  units: Option[];
  clients: Option[];
  sellers: Seller[];
  procedures: Procedure[];
  areas: Area[];
  paymentMethods: CatalogItem[];
  leadOrigins: CatalogItem[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [saleDate, setSaleDate] = useState(new Date().toISOString().slice(0, 10));
  const [unitId, setUnitId] = useState(units[0]?.id ?? "");
  const [clientId, setClientId] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [leadOriginId, setLeadOriginId] = useState(leadOrigins[0]?.id ?? "");

  const [segment, setSegment] = useState<"laser" | "estetica">("laser");
  const [procedureId, setProcedureId] = useState("");
  const [selectedAreaIds, setSelectedAreaIds] = useState<string[]>([]);

  const [amount, setAmount] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState(paymentMethods[0]?.id ?? "");
  const [installments, setInstallments] = useState(1);
  const [transactionCode, setTransactionCode] = useState("");
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sellersForUnit = useMemo(
    () => sellers.filter((s) => !s.unit_id || s.unit_id === unitId),
    [sellers, unitId]
  );

  const proceduresForSegment = useMemo(
    () => procedures.filter((p) => p.segment === segment),
    [procedures, segment]
  );

  const areasForSelection = useMemo(() => {
    if (segment === "laser") return areas.filter((a) => a.segment === "laser");
    return areas.filter((a) => a.procedure_id === procedureId);
  }, [areas, segment, procedureId]);

  const groupedAreas = useMemo(() => {
    const groups = new Map<string, Area[]>();
    for (const a of areasForSelection) {
      const key = a.group_label ?? "Geral";
      groups.set(key, [...(groups.get(key) ?? []), a]);
    }
    return Array.from(groups.entries());
  }, [areasForSelection]);

  const selectedPaymentMethod = paymentMethods.find((p) => p.id === paymentMethodId);
  const needsInstallments =
    selectedPaymentMethod?.code === "credito" || selectedPaymentMethod?.code === "link_pagamento";

  function handleSegmentChange(next: "laser" | "estetica") {
    setSegment(next);
    setProcedureId("");
    setSelectedAreaIds([]);
  }

  function toggleArea(areaId: string) {
    setSelectedAreaIds((prev) =>
      prev.includes(areaId) ? prev.filter((id) => id !== areaId) : [...prev, areaId]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .insert({
        organization_id: organizationId,
        unit_id: unitId,
        sale_date: saleDate,
        client_id: clientId,
        procedure_id: procedureId || null,
        amount: Number(amount.replace(",", ".")),
        installments: needsInstallments ? installments : 1,
        payment_method_id: paymentMethodId,
        lead_origin_id: leadOriginId,
        seller_id: sellerId,
        transaction_code: transactionCode || null,
        notes: notes || null,
        created_by: userId,
      })
      .select("id")
      .single();

    if (saleError || !sale) {
      setSaving(false);
      setError(saleError?.message ?? "Não foi possível salvar a venda.");
      return;
    }

    if (selectedAreaIds.length > 0) {
      const { error: areasError } = await supabase
        .from("sale_areas")
        .insert(selectedAreaIds.map((areaId) => ({ sale_id: sale.id, area_id: areaId })));

      if (areasError) {
        setSaving(false);
        setError(`Venda salva, mas houve um erro ao gravar as áreas: ${areasError.message}`);
        return;
      }
    }

    setSaving(false);
    router.push("/vendas");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-8">
      <Section title="Identificação do cliente e venda">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              onChange={(e) => {
                setUnitId(e.target.value);
                setSellerId("");
              }}
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

        <Field label="Nome completo do cliente">
          <ClientAutocomplete
            clients={clients}
            organizationId={organizationId}
            value={clientId}
            onChange={setClientId}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Vendedor(a) responsável">
            <select
              required
              value={sellerId}
              onChange={(e) => setSellerId(e.target.value)}
              className="w-full rounded-md border border-gold-200 px-3 py-2 text-sm outline-none focus:border-gold-500"
            >
              <option value="" disabled>
                Selecione
              </option>
              {sellersForUnit.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {sellersForUnit.length === 0 && (
              <p className="mt-1 text-xs text-ink-500">
                Nenhuma vendedora cadastrada nesta unidade ainda. Cadastre em Configurações.
              </p>
            )}
          </Field>

          <Field label="Origem do lead">
            <select
              value={leadOriginId}
              onChange={(e) => setLeadOriginId(e.target.value)}
              className="w-full rounded-md border border-gold-200 px-3 py-2 text-sm outline-none focus:border-gold-500"
            >
              {leadOrigins.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Section>

      <Section title="Segmento e procedimento">
        <Field label="Segmento">
          <div className="flex gap-2">
            {(["laser", "estetica"] as const).map((seg) => (
              <button
                key={seg}
                type="button"
                onClick={() => handleSegmentChange(seg)}
                className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                  segment === seg
                    ? "bg-gold-500 text-white"
                    : "border border-gold-200 text-ink-700 hover:bg-gold-50"
                }`}
              >
                {seg === "laser" ? "Depilação a Laser" : "Estética"}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Procedimento">
          <select
            required
            value={procedureId}
            onChange={(e) => {
              setProcedureId(e.target.value);
              setSelectedAreaIds([]);
            }}
            className="w-full rounded-md border border-gold-200 px-3 py-2 text-sm outline-none focus:border-gold-500"
          >
            <option value="" disabled>
              Selecione
            </option>
            {proceduresForSegment.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>

        {segment === "laser" ? (
          <div>
            <p className="mb-2 text-sm text-ink-700">Área / região de aplicação</p>
            <div className="space-y-3 rounded-md border border-gold-100 bg-white p-4">
              {groupedAreas.map(([group, groupAreas]) => (
                <div key={group}>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-500">
                    {group}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {groupAreas.map((a) => (
                      <label
                        key={a.id}
                        className={`cursor-pointer rounded-full border px-3 py-1 text-xs ${
                          selectedAreaIds.includes(a.id)
                            ? "border-gold-500 bg-gold-100 text-gold-800"
                            : "border-gold-200 text-ink-700"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={selectedAreaIds.includes(a.id)}
                          onChange={() => toggleArea(a.id)}
                        />
                        {a.name}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          areasForSelection.length > 0 && (
            <Field label="Área / região de aplicação">
              <select
                value={selectedAreaIds[0] ?? ""}
                onChange={(e) => setSelectedAreaIds(e.target.value ? [e.target.value] : [])}
                className="w-full rounded-md border border-gold-200 px-3 py-2 text-sm outline-none focus:border-gold-500"
              >
                <option value="">Nenhuma</option>
                {groupedAreas.map(([group, groupAreas]) => (
                  <optgroup key={group} label={group}>
                    {groupAreas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Field>
          )
        )}
      </Section>

      <Section title="Financeiro">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Valor total (R$)">
            <input
              required
              inputMode="decimal"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-md border border-gold-200 px-3 py-2 text-sm outline-none focus:border-gold-500"
            />
          </Field>

          <Field label="Forma de pagamento">
            <select
              value={paymentMethodId}
              onChange={(e) => setPaymentMethodId(e.target.value)}
              className="w-full rounded-md border border-gold-200 px-3 py-2 text-sm outline-none focus:border-gold-500"
            >
              {paymentMethods.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {needsInstallments && (
          <Field label="Parcelamento">
            <select
              value={installments}
              onChange={(e) => setInstallments(Number(e.target.value))}
              className="w-full rounded-md border border-gold-200 px-3 py-2 text-sm outline-none focus:border-gold-500"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}x
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Código / comprovante (opcional)">
          <input
            value={transactionCode}
            onChange={(e) => setTransactionCode(e.target.value)}
            className="w-full rounded-md border border-gold-200 px-3 py-2 text-sm outline-none focus:border-gold-500"
          />
        </Field>

        <Field label="Observações">
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-md border border-gold-200 px-3 py-2 text-sm outline-none focus:border-gold-500"
          />
        </Field>
      </Section>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-gold-500 px-6 py-2 text-sm font-medium text-white hover:bg-gold-600 disabled:opacity-60"
      >
        {saving ? "Salvando..." : "Registrar venda"}
      </button>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-lg border border-gold-100 bg-white p-6">
      <h3 className="text-sm font-medium uppercase tracking-wide text-ink-500">{title}</h3>
      {children}
    </section>
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
