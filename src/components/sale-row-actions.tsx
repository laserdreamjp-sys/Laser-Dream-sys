"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatCpf } from "@/lib/cpf";

type PaymentOption = { id: string; name: string };
type SellerOption = { id: string; name: string };
type ProcedureOption = { id: string; name: string; segment: string | null };
type AreaOption = { id: string; name: string; group_label: string | null; procedure_id: string | null; segment: string | null };
type ClientMatch = { id: string; name: string; cpf: string | null; phone: string | null };

export function SaleRowActions({
  saleId,
  organizationId,
  userId,
  isAdmin,
  currentAmount,
  currentPaymentMethodId,
  currentNotes,
  paymentMethods,
  currentSaleDate,
  currentClientId,
  currentClientName,
  currentSellerId,
  currentProcedureId,
  currentTipoVenda,
  currentAreaIds,
  sellers,
  procedures,
  areas,
}: {
  saleId: string;
  organizationId: string;
  userId: string;
  isAdmin: boolean;
  currentAmount: number;
  currentPaymentMethodId: string;
  currentNotes: string | null;
  paymentMethods: PaymentOption[];
  currentSaleDate: string;
  currentClientId: string;
  currentClientName: string;
  currentSellerId: string | null;
  currentProcedureId: string | null;
  currentTipoVenda: string | null;
  currentAreaIds: string[];
  sellers: SellerOption[];
  procedures: ProcedureOption[];
  areas: AreaOption[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [editing, setEditing] = useState(false);
  const [fullEditing, setFullEditing] = useState(false);
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
      if (!error) {
        await supabase.from("opportunities").update({ sale_id: null }).eq("sale_id", saleId);
      }
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

  if (fullEditing) {
    return (
      <FullEditModal
        saleId={saleId}
        userId={userId}
        currentSaleDate={currentSaleDate}
        currentClientId={currentClientId}
        currentClientName={currentClientName}
        currentSellerId={currentSellerId}
        currentProcedureId={currentProcedureId}
        currentPaymentMethodId={currentPaymentMethodId}
        currentTipoVenda={currentTipoVenda}
        currentAmount={currentAmount}
        currentAreaIds={currentAreaIds}
        sellers={sellers}
        procedures={procedures}
        areas={areas}
        paymentMethods={paymentMethods}
        onClose={() => setFullEditing(false)}
        onSaved={() => {
          setFullEditing(false);
          router.refresh();
        }}
      />
    );
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
    <div className="flex flex-wrap gap-2">
      {isAdmin ? (
        <button onClick={() => setFullEditing(true)} className="text-xs text-gold-700 underline underline-offset-2">
          Editar tudo
        </button>
      ) : (
        <button onClick={() => setEditing(true)} className="text-xs text-gold-700 underline underline-offset-2">
          Solicitar alteração
        </button>
      )}
      <button onClick={handleCancelSale} disabled={busy} className="text-xs text-destructive underline underline-offset-2">
        {isAdmin ? "Cancelar" : "Solicitar cancelamento"}
      </button>
    </div>
  );
}

function FullEditModal({
  saleId,
  userId,
  currentSaleDate,
  currentClientId,
  currentClientName,
  currentSellerId,
  currentProcedureId,
  currentPaymentMethodId,
  currentTipoVenda,
  currentAmount,
  currentAreaIds,
  sellers,
  procedures,
  areas,
  paymentMethods,
  onClose,
  onSaved,
}: {
  saleId: string;
  userId: string;
  currentSaleDate: string;
  currentClientId: string;
  currentClientName: string;
  currentSellerId: string | null;
  currentProcedureId: string | null;
  currentPaymentMethodId: string;
  currentTipoVenda: string | null;
  currentAmount: number;
  currentAreaIds: string[];
  sellers: SellerOption[];
  procedures: ProcedureOption[];
  areas: AreaOption[];
  paymentMethods: PaymentOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const wrapRef = useRef<HTMLDivElement>(null);

  const [saleDate, setSaleDate] = useState(currentSaleDate);
  const [clientId, setClientId] = useState(currentClientId);
  const [clientBusca, setClientBusca] = useState(currentClientName);
  const [clientResultados, setClientResultados] = useState<ClientMatch[]>([]);
  const [mostrarResultados, setMostrarResultados] = useState(false);
  const [sellerId, setSellerId] = useState(currentSellerId ?? "");
  const [procedureId, setProcedureId] = useState(currentProcedureId ?? "");
  const [paymentMethodId, setPaymentMethodId] = useState(currentPaymentMethodId);
  const [tipoVenda, setTipoVenda] = useState(currentTipoVenda ?? "");
  const [amount, setAmount] = useState(String(currentAmount));
  const [areaIds, setAreaIds] = useState<string[]>(currentAreaIds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onClickFora(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setMostrarResultados(false);
    }
    document.addEventListener("mousedown", onClickFora);
    return () => document.removeEventListener("mousedown", onClickFora);
  }, []);

  useEffect(() => {
    const termo = clientBusca.trim();
    if (termo.length < 2 || termo === currentClientName) {
      setClientResultados([]);
      return;
    }
    const timeout = setTimeout(async () => {
      const soDigitos = termo.replace(/\D/g, "");
      const filtro =
        soDigitos.length >= 3
          ? `name.ilike.%${termo}%,cpf.ilike.%${soDigitos}%,phone.ilike.%${soDigitos}%`
          : `name.ilike.%${termo}%`;
      const { data } = await supabase.from("clients").select("id, name, cpf, phone").or(filtro).order("name").limit(6);
      setClientResultados((data as ClientMatch[]) ?? []);
    }, 250);
    return () => clearTimeout(timeout);
  }, [clientBusca, currentClientName, supabase]);

  const selectedProcedure = procedures.find((p) => p.id === procedureId);
  const segment = selectedProcedure?.segment ?? null;

  const areasForSelection = useMemo(() => {
    if (!segment) return [];
    if (segment === "laser") return areas.filter((a) => a.segment === "laser");
    return areas.filter((a) => a.procedure_id === procedureId);
  }, [areas, segment, procedureId]);

  const groupedAreas = useMemo(() => {
    const groups = new Map<string, AreaOption[]>();
    for (const a of areasForSelection) {
      const key = a.group_label ?? "Áreas";
      groups.set(key, [...(groups.get(key) ?? []), a]);
    }
    return Array.from(groups.entries());
  }, [areasForSelection]);

  function toggleArea(id: string) {
    setAreaIds((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]));
  }

  async function handleSave() {
    if (!clientId) {
      setError("Escolha um cliente cadastrado (busca acima).");
      return;
    }
    if (!procedureId) {
      setError("Escolha um procedimento.");
      return;
    }
    setSaving(true);
    setError(null);

    const { error: updateError } = await supabase
      .from("sales")
      .update({
        sale_date: saleDate,
        client_id: clientId,
        seller_id: sellerId || null,
        procedure_id: procedureId,
        payment_method_id: paymentMethodId,
        tipo_venda: tipoVenda || null,
        amount: Number(amount.replace(",", ".")),
        updated_by: userId,
      })
      .eq("id", saleId);

    if (updateError) {
      setSaving(false);
      setError(updateError.message);
      return;
    }

    // areas: apaga as antigas e grava as novas selecionadas
    await supabase.from("sale_areas").delete().eq("sale_id", saleId);
    if (areaIds.length > 0) {
      const { error: areasError } = await supabase
        .from("sale_areas")
        .insert(areaIds.map((area_id) => ({ sale_id: saleId, area_id })));
      if (areasError) {
        setSaving(false);
        setError(`Venda salva, mas as áreas falharam: ${areasError.message}`);
        return;
      }
    }

    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto space-y-3 rounded-lg border border-border bg-surface p-5 shadow-soft">
        <p className="text-sm font-medium text-foreground">Editar venda (administrador)</p>

        <label className="block text-xs">
          <span className="mb-1 block text-muted-foreground">Data</span>
          <input
            type="date"
            value={saleDate}
            onChange={(e) => setSaleDate(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>

        <div ref={wrapRef} className="relative">
          <label className="mb-1 block text-xs text-muted-foreground">Cliente</label>
          <input
            value={clientBusca}
            onChange={(e) => {
              setClientBusca(e.target.value);
              setClientId("");
              setMostrarResultados(true);
            }}
            onFocus={() => setMostrarResultados(true)}
            placeholder="Nome, CPF ou telefone..."
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          {mostrarResultados && clientResultados.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-md border border-border bg-surface shadow-soft">
              {clientResultados.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setClientId(c.id);
                    setClientBusca(c.name);
                    setMostrarResultados(false);
                  }}
                  className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  <span className="font-medium text-foreground">{c.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {c.cpf ? formatCpf(c.cpf) : "sem CPF"} {c.phone ? `· ${c.phone}` : ""}
                  </span>
                </button>
              ))}
            </div>
          )}
          {clientId && clientId === currentClientId && clientBusca === currentClientName && (
            <p className="mt-1 text-xs text-muted-foreground">Cliente atual mantido.</p>
          )}
        </div>

        <label className="block text-xs">
          <span className="mb-1 block text-muted-foreground">Vendedor(a)</span>
          <select
            value={sellerId}
            onChange={(e) => setSellerId(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Sem definir</option>
            {sellers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs">
          <span className="mb-1 block text-muted-foreground">Procedimento (define o segmento)</span>
          <select
            value={procedureId}
            onChange={(e) => {
              setProcedureId(e.target.value);
              setAreaIds([]);
            }}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="" disabled>
              Selecione
            </option>
            {procedures.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.segment === "laser" ? "· Laser" : p.segment === "estetica" ? "· Estética" : ""}
              </option>
            ))}
          </select>
        </label>

        {areasForSelection.length > 0 && (
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Áreas (pode escolher mais de uma)</p>
            <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border border-border bg-background p-3">
              {groupedAreas.map(([group, groupAreas]) => (
                <div key={group}>
                  <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {group}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {groupAreas.map((a) => (
                      <label
                        key={a.id}
                        className={`cursor-pointer rounded-full border px-2 py-0.5 text-xs ${
                          areaIds.includes(a.id)
                            ? "border-gold-500 bg-gold-100 text-gold-800"
                            : "border-border text-foreground"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={areaIds.includes(a.id)}
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
        )}

        <label className="block text-xs">
          <span className="mb-1 block text-muted-foreground">Pagamento</span>
          <select
            value={paymentMethodId}
            onChange={(e) => setPaymentMethodId(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            {paymentMethods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs">
          <span className="mb-1 block text-muted-foreground">Tipo</span>
          <select
            value={tipoVenda}
            onChange={(e) => setTipoVenda(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Sem definir</option>
            <option value="REVENDA">Revenda</option>
            <option value="VENDA NOVA">Venda nova</option>
          </select>
        </label>

        <label className="block text-xs">
          <span className="mb-1 block text-muted-foreground">Valor (R$)</span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-gold-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-gold-600 disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
