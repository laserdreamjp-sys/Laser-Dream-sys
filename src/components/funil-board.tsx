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

type Stage = { id: string; name: string; position: number; is_won: boolean; is_lost: boolean };
type Note = { id: string; content: string; created_at: string; author_id: string | null; author_name?: string };
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

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function DraggableCard({ opportunity, children }: { opportunity: Opportunity; children: React.ReactNode }) {
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
  currentUserId,
}: {
  stages: Stage[];
  opportunities: Opportunity[];
  lossReasons: LossReason[];
  notesByOpportunity: Record<string, Note[]>;
  currentUserId: string;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [items, setItems] = useState(opportunities);
  const [notes, setNotes] = useState(notesByOpportunity);
  const [lossModal, setLossModal] = useState<{ opportunityId: string; targetStageId: string } | null>(
    null
  );
  const [selectedReason, setSelectedReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newNote, setNewNote] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

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
          o.id === opportunityId
            ? { ...o, stage_id: targetStageId, loss_reason_id: lossReasonId ?? null }
            : o
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
    if (!over) return;
    const opportunityId = String(active.id);
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

  async function addNote(opportunityId: string) {
    const content = newNote.trim();
    if (!content) return;
    const { data, error } = await supabase
      .from("opportunity_notes")
      .insert({ opportunity_id: opportunityId, author_id: currentUserId, content })
      .select("id, content, created_at, author_id")
      .single();
    if (!error && data) {
      setNotes((prev) => ({
        ...prev,
        [opportunityId]: [...(prev[opportunityId] ?? []), data as Note],
      }));
      setNewNote("");
      router.refresh();
    }
  }

  const activeOpportunity = activeId ? items.find((o) => o.id === activeId) : null;

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
                    const opportunityNotes = notes[o.id] ?? [];
                    const isExpanded = expandedId === o.id;
                    return (
                      <DraggableCard key={o.id} opportunity={o}>
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
                            onPointerDown={(e) => e.stopPropagation()}
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

                        <button
                          type="button"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={() => setExpandedId(isExpanded ? null : o.id)}
                          className="mt-2 text-xs text-gold-700 underline dark:text-gold-400"
                        >
                          {isExpanded ? "Fechar anotações" : `Anotações (${opportunityNotes.length})`}
                        </button>

                        {isExpanded && (
                          <div
                            onPointerDown={(e) => e.stopPropagation()}
                            className="mt-2 space-y-2 border-t border-border pt-2"
                          >
                            <div className="max-h-32 space-y-1.5 overflow-y-auto">
                              {opportunityNotes.length === 0 && (
                                <p className="text-xs text-muted-foreground">Sem anotações ainda.</p>
                              )}
                              {opportunityNotes.map((n) => (
                                <div key={n.id} className="rounded bg-muted p-1.5 text-xs">
                                  <p className="text-foreground">{n.content}</p>
                                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                                    {n.author_name ?? "alguém"} · {formatDateTime(n.created_at)}
                                  </p>
                                </div>
                              ))}
                            </div>
                            <div className="flex gap-1.5">
                              <input
                                value={expandedId === o.id ? newNote : ""}
                                onChange={(e) => setNewNote(e.target.value)}
                                placeholder="Nova anotação..."
                                className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    addNote(o.id);
                                  }
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => addNote(o.id)}
                                className="shrink-0 rounded-md bg-gold-500 px-2 py-1 text-xs font-medium text-white hover:bg-gold-600"
                              >
                                Salvar
                              </button>
                            </div>
                          </div>
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
    </DndContext>
  );
}
