import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR");
}

const STATUS_LABEL: Record<string, string> = {
  aberto: "Aberto",
  convertido: "Convertido",
  perdido: "Perdido",
  expirado: "Expirado",
};

export default async function OrcamentosPage() {
  const supabase = createClient();

  const budgetsRes = await supabase
    .from("budgets")
    .select("id, created_at, status, desconto_valor, desconto_percentual, clients(name), sellers(name)")
    .order("created_at", { ascending: false })
    .limit(200);

  type BudgetRow = {
    id: string;
    created_at: string;
    status: string;
    desconto_valor: number | null;
    desconto_percentual: number | null;
    clients: { name: string } | null;
    sellers: { name: string } | null;
  };
  const budgets = (budgetsRes.data ?? []) as unknown as BudgetRow[];
  const ids = budgets.map((b) => b.id);

  const itemsRes =
    ids.length > 0
      ? await supabase.from("budget_items").select("budget_id, amount").in("budget_id", ids)
      : { data: [] as { budget_id: string; amount: number }[] };
  const subtotalPorOrcamento = new Map<string, number>();
  for (const it of (itemsRes.data ?? []) as { budget_id: string; amount: number }[]) {
    subtotalPorOrcamento.set(it.budget_id, (subtotalPorOrcamento.get(it.budget_id) ?? 0) + Number(it.amount));
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display font-semibold text-2xl text-foreground">Orçamentos</h2>
        <Link
          href="/orcamentos/novo"
          className="rounded-md bg-gold-500 px-4 py-2 text-sm font-medium text-white hover:bg-gold-600"
        >
          Novo orçamento
        </Link>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Data</th>
              <th className="px-4 py-2">Cliente</th>
              <th className="px-4 py-2">Vendedor(a)</th>
              <th className="px-4 py-2 text-right">Total</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {budgets.map((b) => {
              const subtotal = subtotalPorOrcamento.get(b.id) ?? 0;
              const desconto = b.desconto_valor
                ? Number(b.desconto_valor)
                : b.desconto_percentual
                ? (subtotal * Number(b.desconto_percentual)) / 100
                : 0;
              const total = Math.max(0, subtotal - desconto);
              return (
                <tr key={b.id} className="border-t border-border">
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(b.created_at)}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{b.clients?.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{b.sellers?.name ?? "-"}</td>
                  <td className="px-4 py-3 text-right text-foreground">{formatCurrency(total)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        b.status === "convertido"
                          ? "bg-gold-100 text-gold-800"
                          : b.status === "perdido"
                          ? "bg-destructive/10 text-destructive"
                          : "border border-border text-muted-foreground"
                      }`}
                    >
                      {STATUS_LABEL[b.status] ?? b.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/orcamentos/${b.id}`} className="text-xs text-gold-700 underline dark:text-gold-400">
                      Ver / PDF
                    </Link>
                  </td>
                </tr>
              );
            })}
            {budgets.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhum orçamento ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
