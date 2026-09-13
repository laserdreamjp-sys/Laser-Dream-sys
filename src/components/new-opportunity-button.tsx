"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Option = { id: string; name: string };
type SellerOption = { id: string; name: string; unit_id: string | null };

export function NewOpportunityButton({
  clients,
  sellers,
  units,
  firstStageId,
  organizationId,
}: {
  clients: Option[];
  sellers: SellerOption[];
  units: Option[];
  firstStageId: string;
  organizationId: string;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [clientId, setClientId] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [unitId, setUnitId] = useState(units[0]?.id ?? "");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [notes, setNotes] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId || !firstStageId) return;
    setSaving(true);
    setError(null);

    const { error: insertError } = await supabase.from("opportunities").insert({
      organization_id: organizationId,
      unit_id: unitId || null,
      client_id: clientId,
      stage_id: firstStageId,
      seller_id: sellerId || null,
      estimated_value: estimatedValue ? Number(estimatedValue) : null,
      notes: notes || null,
    });

    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setOpen(false);
    setClientId("");
    setSellerId("");
    setEstimatedValue("");
    setNotes("");
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-gold-500 px-4 py-2 text-sm font-medium text-white hover:bg-gold-600"
      >
        Nova oportunidade
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-md space-y-3 rounded-lg border border-border bg-surface p-5 shadow-soft"
          >
            <p className="text-sm font-medium text-foreground">Nova oportunidade</p>

            <label className="block text-xs">
              <span className="mb-1 block text-muted-foreground">Cliente</span>
              <select
                required
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="" disabled>
                  Selecione
                </option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs">
              <span className="mb-1 block text-muted-foreground">Unidade</span>
              <select
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs">
              <span className="mb-1 block text-muted-foreground">Vendedor(a)</span>
              <select
                value={sellerId}
                onChange={(e) => setSellerId(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">Sem definir ainda</option>
                {sellers
                  .filter((s) => !s.unit_id || s.unit_id === unitId)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </label>

            <label className="block text-xs">
              <span className="mb-1 block text-muted-foreground">Valor estimado (opcional)</span>
              <input
                type="number"
                value={estimatedValue}
                onChange={(e) => setEstimatedValue(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </label>

            <label className="block text-xs">
              <span className="mb-1 block text-muted-foreground">Observações</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </label>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-gold-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-gold-600 disabled:opacity-60"
              >
                {saving ? "Salvando..." : "Criar"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
