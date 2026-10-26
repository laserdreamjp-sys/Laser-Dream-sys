"use client";

import { useEffect, useMemo, useState } from "react";
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
import { hojeLocal } from "@/lib/datas";
import { LeadDetailModal } from "@/components/lead-detail-modal";
import {
  FunilCardInfo,
  RegistrarVendaLink,
  formatCurrency,
  type FunilLossReason as LossReason,
  type FunilOpportunity as Opportunity,
  type FunilStage as Stage,
  type FunilTag as Tag,
  type FunilTask as Task,
} from "@/components/funil-card";
import { FunilLista } from "@/components/funil-lista";

type Note = { id: string; content: string; created_at: string; author_id: string | null; author_name?: string };
type Origin = { id: string; name: string };
type Procedure = { id: string; name: string; segment: string | null };
type Area = { id: string; name: string; group_label: string | null; procedure_id: string | null; segment: string | null };
type Seller = { id: string; name: string };

type Visao = "lista" | "quadro";
const CHAVE_VISAO = "laser_dream_funil_visao";
// abaixo de 768px (breakpoint `md` do Tailwind) a visão padrão é Lista
const CONSULTA_TELA_ESTREITA = "(max-width: 767px)";

function lerVisaoSalva(): Visao | null {
  try {
    const v = window.localStorage.getItem(CHAVE_VISAO);
    return v === "lista" || v === "quadro" ? v : null;
  } catch {
    return null;
  }
}

function salvarVisao(v: Visao) {
  try {
    window.localStorage.setItem(CHAVE_VISAO, v);
  } catch {
    // sem armazenamento (aba anônima, bloqueio): a escolha vale só nesta visita
  }
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
  const [items, setItems] = useState(opportunities);
  const [lossModal, setLossModal] = useState<{ opportunityId: string; targetStageId: string } | null>(null);
  const [selectedReason, setSelectedReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [erroMover, setErroMover] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [justDraggedId, setJustDraggedId] = useState<string | null>(null);
  // null até o primeiro efeito no navegador decidir (o servidor não sabe a largura da tela nem o localStorage)
  const [visao, setVisao] = useState<Visao | null>(null);

  useEffect(() => {
    const salva = lerVisaoSalva();
    if (salva) {
      setVisao(salva);
      return;
    }
    let estreita = false;
    try {
      estreita = window.matchMedia(CONSULTA_TELA_ESTREITA).matches;
    } catch {
      estreita = window.innerWidth < 768;
    }
    setVisao(estreita ? "lista" : "quadro");
  }, []);

  function escolherVisao(v: Visao) {
    setVisao(v);
    salvarVisao(v);
  }

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

    setErroMover(null);
    if (error) {
      setErroMover(`Não foi possível mover o lead: ${error.message}`);
    } else {
      const { error: erroEvento } = await supabase.from("opportunity_events").insert({
        opportunity_id: opportunityId,
        from_stage_id: current?.stage_id ?? null,
        to_stage_id: targetStageId,
      });
      if (erroEvento) {
        setErroMover(`O lead foi movido, mas o histórico da mudança não foi gravado: ${erroEvento.message}`);
      }
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

  /**
   * Caminho único para trocar de etapa, usado pelo arrastar (Quadro) e pelo "Mover ▾" (Lista):
   * etapa de perda abre o modal que exige o motivo; as demais gravam direto em `moveStage`.
   */
  function solicitarMovimento(opportunityId: string, targetStageId: string) {
    const stage = stages.find((s) => s.id === targetStageId);
    if (!stage) return;
    const current = items.find((o) => o.id === opportunityId);
    if (!current || current.stage_id === targetStageId) return;
    if (stage.is_lost) {
      setLossModal({ opportunityId, targetStageId });
      setSelectedReason("");
      return;
    }
    moveStage(opportunityId, targetStageId);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    const opportunityId = String(active.id);
    setJustDraggedId(opportunityId);
    setTimeout(() => setJustDraggedId((cur) => (cur === opportunityId ? null : cur)), 300);
    if (!over) return;
    solicitarMovimento(opportunityId, String(over.id));
  }

  function confirmLoss() {
    if (!lossModal || !selectedReason) return;
    moveStage(lossModal.opportunityId, lossModal.targetStageId, selectedReason);
    setLossModal(null);
  }

  const activeOpportunity = activeId ? items.find((o) => o.id === activeId) : null;
  const openOpportunity = openId ? items.find((o) => o.id === openId) : null;
  const hoje = hojeLocal();

  const notesCountByOpportunity = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [id, list] of Object.entries(notesByOpportunity)) out[id] = list.length;
    return out;
  }, [notesByOpportunity]);

  // Enquanto `visao` é null (servidor e primeira pintura), as duas visões saem no HTML e o CSS mostra
  // Lista abaixo de 768px e Quadro acima, que é o mesmo padrão do efeito: assim a tela não pisca.
  const mostrarLista = visao === null || visao === "lista";
  const mostrarQuadro = visao === null || visao === "quadro";

  const botaoVisao = (v: Visao, rotulo: string) => {
    const ativo = "bg-gold-500 text-white";
    const inativo = "text-foreground hover:bg-muted";
    // sem escolha ainda: o destaque segue a largura da tela, como o conteúdo
    const classes =
      visao === null
        ? v === "lista"
          ? "bg-gold-500 text-white md:bg-transparent md:text-foreground md:hover:bg-muted"
          : "text-foreground hover:bg-muted md:bg-gold-500 md:text-white md:hover:bg-gold-500"
        : visao === v
          ? ativo
          : inativo;
    return (
      <button
        type="button"
        aria-pressed={visao === null ? undefined : visao === v}
        onClick={() => escolherVisao(v)}
        className={`rounded px-3 py-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${classes}`}
      >
        {rotulo}
      </button>
    );
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="relative min-w-0 space-y-3">
        {erroMover && (
          <div role="alert" className="flex items-start justify-between gap-3 rounded-md border border-destructive bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <p>{erroMover}</p>
            <button type="button" onClick={() => setErroMover(null)} className="shrink-0 underline underline-offset-2">
              Fechar
            </button>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div
            role="group"
            aria-label="Visão do funil"
            className="inline-flex gap-1 rounded-md border border-border bg-surface p-1"
          >
            {botaoVisao("lista", "Lista")}
            {botaoVisao("quadro", "Quadro")}
          </div>
          <p className="text-xs text-muted-foreground">
            {visao === "lista"
              ? "Toque no cartão para ver o lead ou use Mover para trocar de etapa."
              : visao === "quadro"
                ? "Arraste o cartão para outra coluna ou clique para ver o lead."
                : null}
          </p>
        </div>

        {mostrarLista && (
          <div className={visao === null ? "md:hidden" : undefined}>
            <FunilLista
              stages={stages}
              byStage={byStage}
              notesCountByOpportunity={notesCountByOpportunity}
              tagsByOpportunity={tagsByOpportunity}
              tasksByOpportunity={tasksByOpportunity}
              lossReasons={lossReasons}
              hoje={hoje}
              busyId={busyId}
              onOpen={(id) => setOpenId(id)}
              onMover={solicitarMovimento}
            />
          </div>
        )}

        {mostrarQuadro && (
          <div className={visao === null ? "hidden md:block" : undefined}>
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
                      {stageOpps.map((o) => (
                        <DraggableCard
                          key={o.id}
                          opportunity={o}
                          onOpen={() => setOpenId(o.id)}
                          justDragged={justDraggedId === o.id}
                        >
                          <FunilCardInfo
                            opportunity={o}
                            stage={stage}
                            notesCount={notesCountByOpportunity[o.id] ?? 0}
                            tags={tagsByOpportunity[o.id] ?? []}
                            tasks={tasksByOpportunity[o.id] ?? []}
                            lossReasons={lossReasons}
                            hoje={hoje}
                          />
                          {stage.is_won && !o.sale_id && <RegistrarVendaLink opportunity={o} className="mt-2" />}
                        </DraggableCard>
                      ))}
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
        )}
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
