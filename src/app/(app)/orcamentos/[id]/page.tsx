import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/print-button";

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR");
}

export default async function OrcamentoPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const budgetRes = await supabase
    .from("budgets")
    .select(
      "id, created_at, desconto_valor, desconto_percentual, notes, status, clients(name, phone), sellers(name), payment_methods(name)"
    )
    .eq("id", params.id)
    .single();

  const budget = budgetRes.data as unknown as {
    id: string;
    created_at: string;
    desconto_valor: number | null;
    desconto_percentual: number | null;
    notes: string | null;
    status: string;
    clients: { name: string; phone: string | null } | null;
    sellers: { name: string } | null;
    payment_methods: { name: string } | null;
  } | null;

  if (!budget) {
    return <p className="p-8 text-center text-muted-foreground">Orçamento não encontrado.</p>;
  }

  const itemsRes = await supabase
    .from("budget_items")
    .select("id, amount, position, procedures(name), budget_item_areas(procedure_areas(name))")
    .eq("budget_id", params.id)
    .order("position");

  type ItemRow = {
    id: string;
    amount: number;
    procedures: { name: string } | null;
    budget_item_areas: { procedure_areas: { name: string } | null }[];
  };
  const items = (itemsRes.data ?? []) as unknown as ItemRow[];

  const subtotal = items.reduce((acc, it) => acc + Number(it.amount), 0);
  const desconto = budget.desconto_valor
    ? Number(budget.desconto_valor)
    : budget.desconto_percentual
    ? (subtotal * Number(budget.desconto_percentual)) / 100
    : 0;
  const total = Math.max(0, subtotal - desconto);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <p className="text-sm text-muted-foreground">Orçamento gerado em {formatDate(budget.created_at)}</p>
        <PrintButton />
      </div>

      <div className="rounded-lg border border-border bg-surface p-8 print:border-none print:p-0">
        <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
          <div>
            <p className="font-display text-xl font-semibold text-foreground">Laser Dream</p>
            <p className="text-xs text-muted-foreground">Orçamento</p>
          </div>
          <p className="text-xs text-muted-foreground">{formatDate(budget.created_at)}</p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Cliente</p>
            <p className="font-medium text-foreground">{budget.clients?.name}</p>
          </div>
          {budget.sellers?.name && (
            <div>
              <p className="text-xs text-muted-foreground">Atendimento</p>
              <p className="font-medium text-foreground">{budget.sellers.name}</p>
            </div>
          )}
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
              <th className="pb-2">Procedimento / área</th>
              <th className="pb-2 text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-b border-border/50">
                <td className="py-2">
                  <p className="text-foreground">{it.procedures?.name ?? "-"}</p>
                  {it.budget_item_areas.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {it.budget_item_areas.map((a) => a.procedure_areas?.name).filter(Boolean).join(", ")}
                    </p>
                  )}
                </td>
                <td className="py-2 text-right text-foreground">{formatCurrency(Number(it.amount))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 space-y-1 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          {desconto > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>
                Desconto {budget.desconto_percentual ? `(${budget.desconto_percentual}%)` : ""}
              </span>
              <span>- {formatCurrency(desconto)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-border pt-1 text-base font-semibold text-foreground">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>

        {budget.payment_methods?.name && (
          <p className="mt-4 text-xs text-muted-foreground">Forma de pagamento: {budget.payment_methods.name}</p>
        )}
        {budget.notes && <p className="mt-2 text-xs text-muted-foreground">Observações: {budget.notes}</p>}

        <p className="mt-6 text-center text-[10px] text-muted-foreground">
          Orçamento sem validade de venda até confirmação — sujeito a alteração.
        </p>
      </div>
    </div>
  );
}
