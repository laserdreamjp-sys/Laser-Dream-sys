import { createClient } from "@/lib/supabase/server";
import { NewCashOutForm } from "@/components/new-cash-out-form";

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export default async function CaixaPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profileRes = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user!.id)
    .single();

  const profile = profileRes.data as { organization_id: string } | null;

  const unitsRes = await supabase.from("units").select("id, name").eq("active", true).order("name");
  const categoriesRes = await supabase
    .from("cash_categories")
    .select("id, name")
    .eq("type", "saida")
    .order("name");
  const transactionsRes = await supabase
    .from("cash_transactions")
    .select("id, transaction_date, type, description, amount, units(name)")
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  type TransactionRow = {
    id: string;
    transaction_date: string;
    type: string;
    description: string;
    amount: number;
    units: { name: string } | null;
  };

  const transactions = (transactionsRes.data ?? []) as unknown as TransactionRow[];

  const saldo = transactions.reduce(
    (acc, t) => acc + (t.type === "entrada" ? Number(t.amount) : -Number(t.amount)),
    0
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-serif text-2xl text-ink-900">Caixa</h2>
        <div className="rounded-lg border border-gold-100 bg-white px-4 py-2 text-right">
          <p className="text-xs text-ink-500">Saldo atual</p>
          <p className="text-xl font-medium text-gold-800">{formatCurrency(saldo)}</p>
        </div>
      </div>

      <NewCashOutForm
        organizationId={profile!.organization_id}
        userId={user!.id}
        units={unitsRes.data ?? []}
        categories={categoriesRes.data ?? []}
      />

      <div className="overflow-hidden rounded-lg border border-gold-100 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gold-50 text-left text-xs uppercase tracking-wide text-ink-500">
            <tr>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Unidade</th>
              <th className="px-4 py-3">Descrição</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3 text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id} className="border-t border-gold-50">
                <td className="px-4 py-3">{formatDate(t.transaction_date)}</td>
                <td className="px-4 py-3">{t.units?.name}</td>
                <td className="px-4 py-3">{t.description}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      t.type === "entrada" ? "bg-gold-100 text-gold-800" : "bg-ink-100 text-ink-500"
                    }`}
                  >
                    {t.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {t.type === "saida" ? "-" : ""}
                  {formatCurrency(Number(t.amount))}
                </td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink-500">
                  Nenhuma movimentação registrada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
