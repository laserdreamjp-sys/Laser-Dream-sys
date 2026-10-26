import Link from "next/link";

// Tipos e partes visuais do cartão de lead, compartilhados pelo Quadro (funil-board) e pela Lista (funil-lista).

export type FunilStage = { id: string; name: string; position: number; is_won: boolean; is_lost: boolean };
export type FunilTag = { id: string; name: string; color: string };
export type FunilTask = {
  id: string;
  title: string;
  due_date: string | null;
  done: boolean;
  assigned_to: string | null;
  assigned_name?: string;
};
export type FunilLossReason = { id: string; name: string };
export type FunilOpportunity = {
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
  is_test?: boolean;
  data_avaliacao: string | null;
  clients: { name: string } | null;
  sellers: { name: string } | null;
};

export function formatCurrency(value: number | null) {
  if (value === null || value === undefined) return "-";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Conteúdo informativo do cartão (sem ações clicáveis). */
export function FunilCardInfo({
  opportunity: o,
  stage,
  notesCount,
  tags,
  tasks,
  lossReasons,
  hoje,
}: {
  opportunity: FunilOpportunity;
  stage: FunilStage;
  notesCount: number;
  tags: FunilTag[];
  tasks: FunilTask[];
  lossReasons: FunilLossReason[];
  hoje: string;
}) {
  const tarefasAbertas = tasks.filter((t) => !t.done);
  const tarefasAtrasadas = tarefasAbertas.filter((t) => t.due_date && t.due_date < hoje);

  return (
    <>
      {o.is_test && (
        <span className="mb-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          TESTE
        </span>
      )}
      <p className="break-words font-medium text-foreground">{o.clients?.name ?? "Cliente"}</p>
      <p className="break-words text-xs text-muted-foreground">
        {o.sellers?.name ?? "sem vendedora"} · {formatCurrency(o.estimated_value)}
      </p>

      {tags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {tags.map((t) => (
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

      {(notesCount > 0 || tarefasAbertas.length > 0) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
          {notesCount > 0 && <span>📝 {notesCount}</span>}
          {tarefasAbertas.length > 0 && (
            <span className={tarefasAtrasadas.length > 0 ? "font-medium text-destructive" : ""}>
              ☐ {tarefasAbertas.length}
              {tarefasAtrasadas.length > 0 ? " atrasada" : ""}
            </span>
          )}
        </div>
      )}

      {stage.is_won && o.sale_id && (
        <p className="mt-2 text-xs font-medium text-gold-700 dark:text-gold-400">✓ Venda registrada</p>
      )}
      {stage.is_lost && o.loss_reason_id && (
        <p className="mt-2 text-xs text-destructive">
          Motivo: {lossReasons.find((r) => r.id === o.loss_reason_id)?.name ?? "-"}
        </p>
      )}
    </>
  );
}

/** Atalho "Registrar venda" para lead em etapa ganha ainda sem venda. Não dispara arrastar nem abrir o detalhe. */
export function RegistrarVendaLink({ opportunity: o, className = "" }: { opportunity: FunilOpportunity; className?: string }) {
  return (
    <Link
      href={`/vendas/novo?opportunityId=${o.id}&clientId=${o.client_id}${o.seller_id ? `&sellerId=${o.seller_id}` : ""}`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className={`block rounded-md bg-gold-500 px-2 py-1 text-center text-xs font-medium text-white hover:bg-gold-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${className}`}
    >
      Registrar venda
    </Link>
  );
}
