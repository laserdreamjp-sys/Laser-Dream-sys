import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";
import { NewCashOutForm } from "@/components/new-cash-out-form";
import { NewCashInForm } from "@/components/new-cash-in-form";
import { CloseRegisterForm, type ExistingClosure } from "@/components/close-register-form";

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export default async function CaixaPage() {
  const supabase = createClient();
  const profile = await getCurrentProfile();
  const today = new Date().toISOString().slice(0, 10);

  const unitsRes = await supabase.from("units").select("id, name").eq("active", true).order("name");
  const units = unitsRes.data ?? [];

  const categoriesOutRes = await supabase
    .from("cash_categories")
    .select("id, name")
    .eq("type", "saida")
    .order("name");
  const categoriesInRes = await supabase
    .from("cash_categories")
    .select("id, name")
    .eq("type", "entrada")
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

  // Fechamento de caixa: só carrega para quem pode ver (admin/gerente); RLS
  // também protege isso no banco.
  const canManageClosures = profile.isAdmin || profile.isManager;

  let closureCards: {
    unitId: string;
    unitName: string;
    openingBalance: number;
    totalIn: number;
    totalOut: number;
    existingClosure: ExistingClosure | null;
  }[] = [];

  let closureHistory: {
    id: string;
    closure_date: string;
    closing_balance: number;
    unit_name: string;
    closed_by_name: string | null;
  }[] = [];

  if (canManageClosures && units.length > 0) {
    const [todayTxRes, todayClosuresRes, previousClosuresRes, historyRes] = await Promise.all([
      supabase
        .from("cash_transactions")
        .select("unit_id, type, amount")
        .eq("transaction_date", today),
      supabase
        .from("cash_closures")
        .select("id, unit_id, opening_balance, total_in, total_out, closing_balance, closed_at, reopened, profiles:closed_by(full_name)")
        .eq("closure_date", today),
      supabase
        .from("cash_closures")
        .select("unit_id, closure_date, closing_balance")
        .lt("closure_date", today)
        .order("closure_date", { ascending: false }),
      supabase
        .from("cash_closures")
        .select("id, closure_date, closing_balance, units(name), profiles:closed_by(full_name)")
        .order("closure_date", { ascending: false })
        .limit(10),
    ]);

    const todayTx = (todayTxRes.data ?? []) as { unit_id: string; type: string; amount: number }[];
    const todayClosures = (todayClosuresRes.data ?? []) as unknown as {
      id: string;
      unit_id: string;
      opening_balance: number;
      total_in: number;
      total_out: number;
      closing_balance: number;
      closed_at: string;
      reopened: boolean;
      profiles: { full_name: string } | null;
    }[];
    const previousClosures = (previousClosuresRes.data ?? []) as { unit_id: string; closure_date: string; closing_balance: number }[];

    const lastClosingByUnit = new Map<string, number>();
    for (const c of previousClosures) {
      if (!lastClosingByUnit.has(c.unit_id)) lastClosingByUnit.set(c.unit_id, Number(c.closing_balance));
    }

    closureCards = units.map((u) => {
      const txToday = todayTx.filter((t) => t.unit_id === u.id);
      const totalIn = txToday.filter((t) => t.type === "entrada").reduce((acc, t) => acc + Number(t.amount), 0);
      const totalOut = txToday.filter((t) => t.type === "saida").reduce((acc, t) => acc + Number(t.amount), 0);
      const existing = todayClosures.find((c) => c.unit_id === u.id);

      return {
        unitId: u.id,
        unitName: u.name,
        openingBalance: lastClosingByUnit.get(u.id) ?? 0,
        totalIn,
        totalOut,
        existingClosure: existing
          ? {
              id: existing.id,
              opening_balance: Number(existing.opening_balance),
              total_in: Number(existing.total_in),
              total_out: Number(existing.total_out),
              closing_balance: Number(existing.closing_balance),
              closed_by_name: existing.profiles?.full_name ?? null,
              closed_at: existing.closed_at,
              reopened: existing.reopened,
            }
          : null,
      };
    });

    closureHistory = ((historyRes.data ?? []) as unknown as {
      id: string;
      closure_date: string;
      closing_balance: number;
      units: { name: string } | null;
      profiles: { full_name: string } | null;
    }[]).map((c) => ({
      id: c.id,
      closure_date: c.closure_date,
      closing_balance: Number(c.closing_balance),
      unit_name: c.units?.name ?? "",
      closed_by_name: c.profiles?.full_name ?? null,
    }));
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-display font-semibold text-2xl text-foreground">Caixa</h2>
        <div className="rounded-lg border border-border bg-surface px-4 py-2 text-right">
          <p className="text-xs text-muted-foreground">Saldo atual</p>
          <p className="text-xl font-medium text-gold-800">{formatCurrency(saldo)}</p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <NewCashInForm
          organizationId={profile.organizationId}
          userId={profile.userId}
          units={units}
          categories={categoriesInRes.data ?? []}
        />
        <NewCashOutForm
          organizationId={profile.organizationId}
          userId={profile.userId}
          units={units}
          categories={categoriesOutRes.data ?? []}
        />
      </div>

      {canManageClosures && closureCards.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 font-display font-semibold text-lg text-foreground">Fechamento de caixa (hoje)</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {closureCards.map((c) => (
              <CloseRegisterForm
                key={c.unitId}
                organizationId={profile.organizationId}
                userId={profile.userId}
                unitId={c.unitId}
                unitName={c.unitName}
                closureDate={today}
                openingBalance={c.openingBalance}
                totalIn={c.totalIn}
                totalOut={c.totalOut}
                existingClosure={c.existingClosure}
                isAdmin={profile.isAdmin}
              />
            ))}
          </div>
        </div>
      )}

      {canManageClosures && closureHistory.length > 0 && (
        <div className="mb-6 overflow-x-auto rounded-lg border border-border bg-surface">
          <h3 className="px-4 pt-3 font-display font-semibold text-lg text-foreground">Histórico de fechamentos</h3>
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Unidade</th>
                <th className="px-4 py-3">Fechado por</th>
                <th className="px-4 py-3 text-right">Saldo de fechamento</th>
              </tr>
            </thead>
            <tbody>
              {closureHistory.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-4 py-3">{formatDate(c.closure_date)}</td>
                  <td className="px-4 py-3">{c.unit_name}</td>
                  <td className="px-4 py-3">{c.closed_by_name}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(c.closing_balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
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
              <tr key={t.id} className="border-t border-border">
                <td className="px-4 py-3">{formatDate(t.transaction_date)}</td>
                <td className="px-4 py-3">{t.units?.name}</td>
                <td className="px-4 py-3">{t.description}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      t.type === "entrada" ? "bg-gold-100 text-gold-800" : "bg-ink-100 text-muted-foreground"
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
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
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
