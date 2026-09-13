"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Stage = { id: string; name: string; position: number; is_won: boolean; is_lost: boolean };
type Opportunity = {
  id: string;
  client_id: string;
  stage_id: string;
  seller_id: string | null;
  estimated_value: number | null;
  notes: string | null;
  sale_id: string | null;
  loss_reason_id: string | null;
  clients: { name: string } | null;
  sellers: { name: string } | null;
};
type LossReason = { id: string; name: string };

function formatCurrency(value: number | null) {
  if (value === null || value === undefined) return "-";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function FunilBoard({
  stages,
  opportunities,
  lossReasons,
}: {
  stages: Stage[];
  opportunities: Opportunity[];
  lossReasons: LossReason[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const [items, setItems] = useState(opportunities);
  const [lossModal, setLossModal] = useState<{ opportunityId: string; targetStageId: string } | null>(
    null
  );
  const [selectedReason, setSelectedReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const byStage = useMemo(() => {
    const map = new Map<string, Opportunity[]>();
    for (const stage of stages) map.set(stage.id, []);
    for (const o of items) {
      const list = map.get(o.stage_id) ?? [];
      list.push(o);
      map.set(o.stage_id, list);
    }
    return map;
  }, [items, stages]);

  async function moveStage(opportunityId: string, targetStageId: string, lossReasonId?: string) {
    setBusyId(opportunityId);
    const current = items.find((o) => o.id === opportunityId);

    const { error } = await supabase
      .from("opportunities")
      .update({
        stage_id: targetStageId,
        loss_reason_id: lossReasonId ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", opportunityId);

    if (!error) {
      await supabase.from("opportunity_events").insert({
        opportunity_id: opportunityId,
        from_stage_id: current?.stage_id ?? null,
        to_stage_id: targetStageId,
      });
      setItems((prev) =>
        prev.map((o) =>
          o.id === opportunityId
            ? { ...o, stage_id: targetStageId, loss_reason_id: lossReasonId ?? null }
            : o
        )
      );
    }
    setBusyId(null);
  }

  function handleMoveClick(opportunityId: string, stage: Stage) {
    if (stage.is_lost) {
      setLossModal({ opportunityId, targetStageId: stage.id });
      setSelectedReason("");
      return;
    }
    moveStage(opportunityId, stage.id);
  }

  function confirmLoss() {
    if (!lossModal || !selectedReason) return;
    moveStage(lossModal.opportunityId, lossModal.targetStageId, selectedReason);
    setLossModal(null);
  }

  return (
    <div className="relative">
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => {
          const stageOpps = byStage.get(stage.id) ?? [];
          const totalEstimado = stageOpps.reduce((acc, o) => acc + Number(o.estimated_value ?? 0), 0);
          const nextStages = stages.filter((s) => s.id !== stage.id);

          return (
            <div key={stage.id} className="w-72 shrink-0 rounded-lg border border-border bg-surface">
              <div className="border-b border-border p-3">
                <p className="text-sm font-medium text-foreground">{stage.name}</p>
                <p className="text-xs text-muted-foreground">
                  {stageOpps.length} · {formatCurrency(totalEstimado)}
                </p>
              </div>
              <div className="space-y-2 p-2">
                {stageOpps.map((o) => (
                  <div
                    key={o.id}
                    className="rounded-md border border-border bg-background p-3 text-sm shadow-soft"
                  >
                    <p className="font-medium text-foreground">{o.clients?.name ?? "Cliente"}</p>
                    <p className="text-xs text-muted-foreground">
                      {o.sellers?.name ?? "sem vendedora"} · {formatCurrency(o.estimated_value)}
                    </p>
                    {o.notes && <p className="mt-1 text-xs text-muted-foreground">{o.notes}</p>}

                    {stage.is_won && !o.sale_id && (
                      <Link
                        href={`/vendas/novo?opportunityId=${o.id}&clientId=${o.client_id}${
                          o.seller_id ? `&sellerId=${o.seller_id}` : ""
                        }`}
                        className="mt-2 block rounded-md bg-gold-500 px-2 py-1 text-center text-xs font-medium text-white hover:bg-gold-600"
                      >
                        Registrar venda
                      </Link>
                    )}
                    {stage.is_won && o.sale_id && (
                      <p className="mt-2 text-xs font-medium text-gold-700 dark:text-gold-400">
                        ✓ Venda registrada
                      </p>
                    )}

                    {!stage.is_lost && !o.sale_id && (
                      <select
                        disabled={busyId === o.id}
                        value=""
                        onChange={(e) => {
                          const target = nextStages.find((s) => s.id === e.target.value);
                          if (target) handleMoveClick(o.id, target);
                        }}
                        className="mt-2 w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
                      >
                        <option value="" disabled>
                          Mover para...
                        </option>
                        {nextStages.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    )}

                    {stage.is_lost && o.loss_reason_id && (
                      <p className="mt-2 text-xs text-destructive">
                        Motivo: {lossReasons.find((r) => r.id === o.loss_reason_id)?.name ?? "-"}
                      </p>
                    )}
                  </div>
                ))}
                {stageOpps.length === 0 && (
                  <p className="px-2 py-4 text-center text-xs text-muted-foreground">Vazio</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {lossModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-4 shadow-soft">
            <p className="mb-3 text-sm font-medium text-foreground">Por que essa oportunidade foi perdida?</p>
            <select
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">Selecione um motivo</option>
              {lossReasons.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setLossModal(null)}
                className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                onClick={confirmLoss}
                disabled={!selectedReason}
                className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
