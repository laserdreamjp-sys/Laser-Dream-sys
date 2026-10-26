"use client";

import { useEffect, useRef, useState } from "react";
import {
  FunilCardInfo,
  RegistrarVendaLink,
  formatCurrency,
  type FunilLossReason,
  type FunilOpportunity,
  type FunilStage,
  type FunilTag,
  type FunilTask,
} from "@/components/funil-card";
import { FunilMoverMenu } from "@/components/funil-mover-menu";

/**
 * Visão Lista do funil: abas de etapa no topo (uma etapa por vez) e cartões empilhados.
 * Não grava nada: abrir o detalhe e mover de etapa sobem para o FunilBoard (`onOpen` e `onMover`).
 */
export function FunilLista({
  stages,
  byStage,
  notesCountByOpportunity,
  tagsByOpportunity,
  tasksByOpportunity,
  lossReasons,
  hoje,
  busyId,
  onOpen,
  onMover,
}: {
  stages: FunilStage[];
  byStage: Map<string, FunilOpportunity[]>;
  notesCountByOpportunity: Record<string, number>;
  tagsByOpportunity: Record<string, FunilTag[]>;
  tasksByOpportunity: Record<string, FunilTask[]>;
  lossReasons: FunilLossReason[];
  hoje: string;
  busyId: string | null;
  onOpen: (opportunityId: string) => void;
  onMover: (opportunityId: string, targetStageId: string) => void;
}) {
  const [abaId, setAbaId] = useState<string>(stages[0]?.id ?? "");
  const abasRef = useRef<HTMLDivElement>(null);

  // se o funil mudar e a aba escolhida deixar de existir, volta para a primeira etapa
  const etapaAtual = stages.find((s) => s.id === abaId) ?? stages[0];

  // mantém a aba ativa visível dentro da faixa que rola
  useEffect(() => {
    if (!etapaAtual) return;
    const faixa = abasRef.current;
    const el = faixa?.querySelector<HTMLElement>(`[data-aba="${etapaAtual.id}"]`);
    if (!faixa || !el) return;
    // rola só a faixa de abas (nunca a página)
    const inicio = el.offsetLeft; // a faixa é `relative`, então offsetLeft é medido dentro dela
    const fim = inicio + el.offsetWidth;
    if (inicio < faixa.scrollLeft) faixa.scrollLeft = inicio - 8;
    else if (fim > faixa.scrollLeft + faixa.clientWidth) faixa.scrollLeft = fim - faixa.clientWidth + 8;
  }, [etapaAtual]);

  if (!etapaAtual) return null;

  const oportunidades = byStage.get(etapaAtual.id) ?? [];
  const totalEstimado = oportunidades.reduce((acc, o) => acc + Number(o.estimated_value ?? 0), 0);
  const tabId = (id: string) => `funil-aba-${id}`;
  const painelId = "funil-aba-painel";

  function teclasNasAbas(e: React.KeyboardEvent<HTMLDivElement>) {
    const idx = stages.findIndex((s) => s.id === etapaAtual.id);
    let novo = -1;
    if (e.key === "ArrowRight") novo = (idx + 1) % stages.length;
    else if (e.key === "ArrowLeft") novo = (idx - 1 + stages.length) % stages.length;
    else if (e.key === "Home") novo = 0;
    else if (e.key === "End") novo = stages.length - 1;
    if (novo < 0) return;
    e.preventDefault();
    const destino = stages[novo];
    setAbaId(destino.id);
    abasRef.current?.querySelector<HTMLElement>(`[data-aba="${destino.id}"]`)?.focus();
  }

  return (
    <div className="min-w-0">
      <div
        ref={abasRef}
        role="tablist"
        aria-label="Etapas do funil"
        onKeyDown={teclasNasAbas}
        className="relative flex gap-1 overflow-x-auto p-1 pb-2 [scrollbar-width:thin]"
      >
        {stages.map((s) => {
          const ativa = s.id === etapaAtual.id;
          const qtd = byStage.get(s.id)?.length ?? 0;
          return (
            <button
              key={s.id}
              id={tabId(s.id)}
              data-aba={s.id}
              type="button"
              role="tab"
              aria-selected={ativa}
              aria-controls={painelId}
              tabIndex={ativa ? 0 : -1}
              onClick={() => setAbaId(s.id)}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                ativa ? "bg-gold-500 text-white" : "border border-border text-foreground hover:bg-muted"
              }`}
            >
              {s.name}
              <span
                className={`rounded-full px-1.5 text-[11px] ${
                  ativa ? "bg-white/25 text-white" : "bg-muted text-muted-foreground"
                }`}
              >
                {qtd}
              </span>
            </button>
          );
        })}
      </div>

      <div id={painelId} role="tabpanel" aria-labelledby={tabId(etapaAtual.id)} className="mt-2">
        <p className="mb-2 text-xs text-muted-foreground">
          {oportunidades.length} {oportunidades.length === 1 ? "lead" : "leads"} · {formatCurrency(totalEstimado)}
        </p>

        <div className="space-y-2">
          {oportunidades.map((o) => (
            <div
              key={o.id}
              className="rounded-md border border-border bg-background p-3 text-sm shadow-soft"
            >
              <button
                type="button"
                onClick={() => onOpen(o.id)}
                className="block w-full min-w-0 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <FunilCardInfo
                  opportunity={o}
                  stage={etapaAtual}
                  notesCount={notesCountByOpportunity[o.id] ?? 0}
                  tags={tagsByOpportunity[o.id] ?? []}
                  tasks={tasksByOpportunity[o.id] ?? []}
                  lossReasons={lossReasons}
                  hoje={hoje}
                />
              </button>

              <div className="mt-2 flex items-center justify-end gap-2">
                {etapaAtual.is_won && !o.sale_id && <RegistrarVendaLink opportunity={o} className="flex-1" />}
                {busyId === o.id && <span className="text-xs text-muted-foreground">Movendo...</span>}
                <FunilMoverMenu
                  stages={stages}
                  currentStageId={o.stage_id}
                  disabled={busyId !== null}
                  onEscolher={(stageId) => onMover(o.id, stageId)}
                />
              </div>
            </div>
          ))}

          {oportunidades.length === 0 && (
            <p className="rounded-md border border-dashed border-border px-2 py-6 text-center text-xs text-muted-foreground">
              Nenhum lead nesta etapa.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
