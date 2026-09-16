"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ClientAutocomplete } from "@/components/client-autocomplete";

type Option = { id: string; name: string };
type Seller = { id: string; name: string; unit_id: string | null };
type Procedure = { id: string; name: string; segment: "laser" | "estetica" };
type Area = { id: string; name: string; group_label: string | null; procedure_id: string | null; segment: string | null };
type PaymentMethod = { id: string; name: string };

type Item = {
  key: string;
  procedureId: string;
  areaIds: string[];
  amount: string;
};

function novoItem(): Item {
  return { key: crypto.randomUUID(), procedureId: "", areaIds: [], amount: "" };
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function NewBudgetForm({
  organizationId,
  sellers,
  procedures,
  areas,
  paymentMethods,
  opportunityId,
  initialClientId,
  initialSellerId,
}: {
  organizationId: string;
  sellers: Seller[];
  procedures: Procedure[];
  areas: Area[];
  paymentMethods: PaymentMethod[];
  opportunityId?: string;
  initialClientId?: string;
  initialSellerId?: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [clientId, setClientId] = useState(initialClientId ?? "");
  const [sellerId, setSellerId] = useState(initialSellerId ?? "");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [items, setItems] = useState<Item[]>([novoItem()]);
  const [tipoDesconto, setTipoDesconto] = useState<"nenhum" | "valor" | "percentual">("nenhum");
  const [descontoValor, setDescontoValor] = useState("");
  const [descontoPercentual, setDescontoPercentual] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function atualizarItem(key: string, patch: Partial<Item>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }

  function adicionarItem() {
    setItems((prev) => [...prev, novoItem()]);
  }

  function removerItem(key: string) {
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.key !== key) : prev));
  }

  function areasDoItem(item: Item) {
    const proc = procedures.find((p) => p.id === item.procedureId);
    if (!proc) return [];
    if (proc.segment === "laser") return areas.filter((a) => a.segment === "laser");
    return areas.filter((a) => a.procedure_id === item.procedureId);
  }

  const subtotal = useMemo(
    () => items.reduce((acc, it) => acc + (Number(it.amount.replace(",", ".")) || 0), 0),
    [items]
  );
  const descontoCalculado =
    tipoDesconto === "valor"
      ? Number(descontoValor.replace(",", ".")) || 0
      : tipoDesconto === "percentual"
      ? (subtotal * (Number(descontoPercentual.replace(",", ".")) || 0)) / 100
      : 0;
  const total = Math.max(0, subtotal - descontoCalculado);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId) {
      setError("Escolha o cliente.");
      return;
    }
    if (items.every((it) => !it.procedureId)) {
      setError("Adicione pelo menos um procedimento.");
      return;
    }
    setSaving(true);
    setError(null);

    const { data: budget, error: budgetError } = await supabase
      .from("budgets")
      .insert({
        organization_id: organizationId,
        client_id: clientId,
        opportunity_id: opportunityId || null,
        seller_id: sellerId || null,
        payment_method_id: paymentMethodId || null,
        desconto_valor: tipoDesconto === "valor" ? Number(descontoValor.replace(",", ".")) || 0 : null,
        desconto_percentual: tipoDesconto === "percentual" ? Number(descontoPercentual.replace(",", ".")) || 0 : null,
        notes: notes || null,
      })
      .select("id")
      .single();

    if (budgetError || !budget) {
      setSaving(false);
      setError(budgetError?.message ?? "Não foi possível salvar o orçamento.");
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.procedureId) continue;
      const { data: budgetItem, error: itemError } = await supabase
        .from("budget_items")
        .insert({
          budget_id: budget.id,
          procedure_id: it.procedureId,
          amount: Number(it.amount.replace(",", ".")) || 0,
          position: i,
        })
        .select("id")
        .single();

      if (itemError || !budgetItem) {
        setSaving(false);
        setError(`Orçamento salvo, mas um item falhou: ${itemError?.message}`);
        return;
      }

      if (it.areaIds.length > 0) {
        await supabase
          .from("budget_item_areas")
          .insert(it.areaIds.map((area_id) => ({ budget_item_id: budgetItem.id, area_id })));
      }
    }

    setSaving(false);
    router.push(`/orcamentos/${budget.id}`);
  }

  function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
      <label className="block">
        <span className="mb-1 block text-sm text-foreground">{label}</span>
        {children}
      </label>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
      <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
        <Field label="Cliente">
          <ClientAutocomplete organizationId={organizationId} value={clientId} onChange={setClientId} />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Vendedor(a)">
            <select
              value={sellerId}
              onChange={(e) => setSellerId(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-gold-500"
            >
              <option value="">Sem definir</option>
              {sellers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Forma de pagamento (se já combinada)">
            <select
              value={paymentMethodId}
              onChange={(e) => setPaymentMethodId(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-gold-500"
            >
              <option value="">Ainda não definida</option>
              {paymentMethods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-sm font-medium text-foreground">Procedimentos e áreas de interesse</p>
        {items.map((item, idx) => {
          const procsDoItem = procedures;
          const areasItem = areasDoItem(item);
          const groupedAreasItem = new Map<string, Area[]>();
          for (const a of areasItem) {
            const key = a.group_label ?? "Áreas";
            groupedAreasItem.set(key, [...(groupedAreasItem.get(key) ?? []), a]);
          }
          return (
            <div key={item.key} className="rounded-lg border border-border bg-surface p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Item {idx + 1}
                </p>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removerItem(item.key)}
                    className="text-xs text-destructive underline"
                  >
                    Remover
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                <select
                  value={item.procedureId}
                  onChange={(e) => atualizarItem(item.key, { procedureId: e.target.value, areaIds: [] })}
                  className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-gold-500"
                >
                  <option value="">Selecione o procedimento</option>
                  {procsDoItem.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.segment === "laser" ? "· Laser" : "· Estética"}
                    </option>
                  ))}
                </select>
                <input
                  inputMode="decimal"
                  placeholder="Valor (R$)"
                  value={item.amount}
                  onChange={(e) => atualizarItem(item.key, { amount: e.target.value })}
                  className="w-32 rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-gold-500"
                />
              </div>

              {areasItem.length > 0 && (
                <div className="space-y-2">
                  {Array.from(groupedAreasItem.entries()).map(([group, groupAreas]) => (
                    <div key={group}>
                      <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {group}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {groupAreas.map((a) => (
                          <label
                            key={a.id}
                            className={`cursor-pointer rounded-full border px-2 py-0.5 text-xs ${
                              item.areaIds.includes(a.id)
                                ? "border-gold-500 bg-gold-100 text-gold-800"
                                : "border-border text-foreground"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="hidden"
                              checked={item.areaIds.includes(a.id)}
                              onChange={() =>
                                atualizarItem(item.key, {
                                  areaIds: item.areaIds.includes(a.id)
                                    ? item.areaIds.filter((id) => id !== a.id)
                                    : [...item.areaIds, a.id],
                                })
                              }
                            />
                            {a.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <button
          type="button"
          onClick={adicionarItem}
          className="rounded-md border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
        >
          + Adicionar outro procedimento
        </button>
      </div>

      <div className="rounded-lg border border-border bg-surface p-5 space-y-3">
        <p className="text-sm font-medium text-foreground">Desconto</p>
        <div className="flex gap-2">
          {(["nenhum", "valor", "percentual"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipoDesconto(t)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                tipoDesconto === t ? "bg-gold-500 text-white" : "border border-border text-foreground"
              }`}
            >
              {t === "nenhum" ? "Sem desconto" : t === "valor" ? "Em R$" : "Em %"}
            </button>
          ))}
        </div>
        {tipoDesconto === "valor" && (
          <input
            inputMode="decimal"
            placeholder="Desconto em R$"
            value={descontoValor}
            onChange={(e) => setDescontoValor(e.target.value)}
            className="w-40 rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-gold-500"
          />
        )}
        {tipoDesconto === "percentual" && (
          <input
            inputMode="decimal"
            placeholder="Desconto em %"
            value={descontoPercentual}
            onChange={(e) => setDescontoPercentual(e.target.value)}
            className="w-40 rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-gold-500"
          />
        )}

        <div className="border-t border-border pt-3 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          {descontoCalculado > 0 && (
            <div className="flex justify-between text-destructive">
              <span>Desconto</span>
              <span>- {formatCurrency(descontoCalculado)}</span>
            </div>
          )}
          <div className="mt-1 flex justify-between text-base font-semibold text-foreground">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-5">
        <Field label="Observações">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-gold-500"
          />
        </Field>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-gold-500 px-6 py-2 text-sm font-medium text-white hover:bg-gold-600 disabled:opacity-60"
      >
        {saving ? "Salvando..." : "Salvar orçamento"}
      </button>
    </form>
  );
}
