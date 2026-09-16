"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { createClient } from "@/lib/supabase/client";
import { LeadDetailModal } from "@/components/lead-detail-modal";

type Stage = { id: string; name: string; position: number; is_won: boolean; is_lost: boolean };
type Note = { id: string; content: string; created_at: string; author_id: string | null; author_name?: string };
type Tag = { id: string; name: string; color: string };
type Task = {
  id: string;
  title: string;
  due_date: string | null;
  done: boolean;
  assigned_to: string | null;
  assigned_name?: string;
};
type Origin = { id: string; name: string };
type Procedure = { id: string; name: string; segment: string | null };
type Area = { id: string; name: string; group_label: string | null; procedure_id: string | null; segment: string | null };
type Seller = { id: string; name: string };
type Opportunity = {
  id: string;
  client_id: string;
  stage_id: string;
  seller_id: string | null;
  estimated_value: number | null;
  notes: string | null;
  sale_id: string | null;
  loss_reason_id: string | null;
  lead_origin_id: string | null;
  referred_by_name: string | null;
  interesse_procedure_id: string | null;
  data_avaliacao: string | null;
  clients: { name: string } | null;
  sellers: { name: string } | null;
};
type LossReason = { id: string; name: string };

function formatCurrency(value: number | null) {
  if (value === null || value === undefined) return "-";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function DraggableCard({
  opportunity,
  children,
  onOpen,
  justDragged,
}: {
  opportunity: Opportunity;
  children: React.ReactNode;
  onOpen: () => void;
  justDragged: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: opportunity.id,
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => {
        if (!isDragging && !justDragged) onOpen();
      }}
      className={`touch-none rounded-md border border-border bg-background p-3 text-sm shadow-soft ${
        isDragging ? "opacity-50" : "cursor-grab active:cursor-grabbing"
      }`}
    >
      {children}
    </div>
  );
}

function DroppableColumn({ stage, children }: { stage: Stage; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  return (
    <div
      ref={setNodeRef}
      className={`w-72 shrink-0 rounded-lg border bg-surface transition-colors ${
        isOver ? "border-gold-500 bg-gold-50 dark:bg-gold-900/10" : "border-border"
      }`}
    >
      {children}
    </div>
  );
}

export function FunilBoard({
  stages,
  opportunities,
  lossReasons,
  notesByOpportunity,
  tagsByOpportunity,
  tasksByOpportunity,
  interestAreasByOpportunity,
  currentUserId,
  organizationId,
  allTags,
  origins,
  procedures,
  areas,
  sellers,
}: {
  stages: Stage[];
  opportunities: Opportunity[];
  lossReasons: LossReason[];
  notesByOpportunity: Record<string, Note[]>;
  tagsByOpportunity: Record<string, Tag[]>;
  tasksByOpportunity: Record<string, Task[]>;
  interestAreasByOpportunity: Record<string, string[]>;
  currentUserId: string;
  organizationId: string;
  allTags: Tag[];
  origins: Origin[];
  procedures: Procedure[];
  areas: Area[];
  sellers: Seller[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const [items, setItems] = useState(opportunities);
  const [lossModal, setLossModal] = useState<{ opportunityId: string; targetStageId: string } | null>(null);
  const [selectedReason, setSelectedReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [justDraggedId, setJustDraggedId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  );

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
    if (current?.stage_id === targetStageId) {
      setBusyId(null);
      return;
    }

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
          o.id === opportunityId ? { ...o, stage_id: targetStageId, loss_reason_id: lossReasonId ?? null } : o
        )
      );
    }
    setBusyId(null);
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    const opportunityId = String(active.id);
    setJustDraggedId(opportunityId);
    setTimeout(() => setJustDraggedId((cur) => (cur === opportunityId ? null : cur)), 300);
    if (!over) return;
    const targetStageId = String(over.id);
    const stage = stages.find((s) => s.id === targetStageId);
    if (!stage) return;
    if (stage.is_lost) {
      setLossModal({ opportunityId, targetStageId });
      setSelectedReason("");
      return;
    }
    moveStage(opportunityId, targetStageId);
  }

  function confirmLoss() {
    if (!lossModal || !selectedReason) return;
    moveStage(lossModal.opportunityId, lossModal.targetStageId, selectedReason);
    setLossModal(null);
  }

  const activeOpportunity = activeId ? items.find((o) => o.id === activeId) : null;
  const openOpportunity = openId ? items.find((o) => o.id === openId) : null;
  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="relative">
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => {
            const stageOpps = byStage.get(stage.id) ?? [];
            const totalEstimado = stageOpps.reduce((acc, o) => acc + Number(o.estimated_value ?? 0), 0);

            return (
              <DroppableColumn key={stage.id} stage={stage}>
                <div className="border-b border-border p-3">
                  <p className="text-sm font-medium text-foreground">{stage.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {stageOpps.length} · {formatCurrency(totalEstimado)}
                  </p>
                </div>
                <div className="space-y-2 p-2">
                  {stageOpps.map((o) => {
                    const opportunityNotes = notesByOpportunity[o.id] ?? [];
                    const opportunityTags = tagsByOpportunity[o.id] ?? [];
                    const opportunityTasks = tasksByOpportunity[o.id] ?? [];
                    const tarefasAtrasadas = opportunityTasks.filter((t) => !t.done && t.due_date && t.due_date < hoje);
                    const tarefasAbertas = opportunityTasks.filter((t) => !t.done);

                    return (
                      <DraggableCard
                        key={o.id}
                        opportunity={o}
                        onOpen={() => setOpenId(o.id)}
                        justDragged={justDraggedId === o.id}
                      >
                        <p className="font-medium text-foreground">{o.clients?.name ?? "Cliente"}</p>
                        <p className="text-xs text-muted-foreground">
                          {o.sellers?.name ?? "sem vendedora"} · {formatCurrency(o.estimated_value)}
                        </p>

                        {opportunityTags.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {opportunityTags.map((t) => (
                              <span
                                key={t.id}
                                className="rounded-full px-1.5 py-0.5 text-[10px] text-white"
                                style={{ backgroundColor: t.color }}
                              >
                                {t.name}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                          {opportunityNotes.length > 0 && <span>📝 {opportunityNotes.length}</span>}
                          {tarefasAbertas.length > 0 && (
                            <span className={tarefasAtrasadas.length > 0 ? "font-medium text-destructive" : ""}>
                              ☐ {tarefasAbertas.length}
                              {tarefasAtrasadas.length > 0 ? " atrasada" : ""}
                            </span>
                          )}
                        </div>

                        {stage.is_won && !o.sale_id && (
                          <Link
                            href={`/vendas/novo?opportunityId=${o.id}&clientId=${o.client_id}${
                              o.seller_id ? `&sellerId=${o.seller_id}` : ""
                            }`}
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
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
                        {stage.is_lost && o.loss_reason_id && (
                          <p className="mt-2 text-xs text-destructive">
                            Motivo: {lossReasons.find((r) => r.id === o.loss_reason_id)?.name ?? "-"}
                          </p>
                        )}
                      </DraggableCard>
                    );
                  })}
                  {stageOpps.length === 0 && (
                    <p className="px-2 py-4 text-center text-xs text-muted-foreground">Solte aqui</p>
                  )}
                </div>
              </DroppableColumn>
            );
          })}
        </div>

        <DragOverlay>
          {activeOpportunity ? (
            <div className="w-64 rounded-md border border-gold-500 bg-background p-3 text-sm shadow-soft">
              <p className="font-medium text-foreground">{activeOpportunity.clients?.name ?? "Cliente"}</p>
              <p className="text-xs text-muted-foreground">{formatCurrency(activeOpportunity.estimated_value)}</p>
            </div>
          ) : null}
        </DragOverlay>

        {busyId && <p className="mt-2 text-xs text-muted-foreground">Movendo...</p>}
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

      {openOpportunity && (
        <LeadDetailModal
          opportunityId={openOpportunity.id}
          clientId={openOpportunity.client_id}
          clientName={openOpportunity.clients?.name ?? "Cliente"}
          leadOriginId={openOpportunity.lead_origin_id}
          referredByName={openOpportunity.referred_by_name}
          interesseProcedureId={openOpportunity.interesse_procedure_id}
          dataAvaliacao={openOpportunity.data_avaliacao}
          notes={notesByOpportunity[openOpportunity.id] ?? []}
          tags={tagsByOpportunity[openOpportunity.id] ?? []}
          tasks={tasksByOpportunity[openOpportunity.id] ?? []}
          interestAreaIds={interestAreasByOpportunity[openOpportunity.id] ?? []}
          allTags={allTags}
          origins={origins}
          procedures={procedures}
          areas={areas}
          sellers={sellers}
          organizationId={organizationId}
          currentUserId={currentUserId}
          onClose={() => setOpenId(null)}
        />
      )}
    </DndContext>
  );
}
