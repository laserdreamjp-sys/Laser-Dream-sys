import { createClient } from "@/lib/supabase/server";

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function DashboardPage() {
  const supabase = createClient();

  const firstDayOfMonth = new Date();
  firstDayOfMonth.setDate(1);
  const isoFirstDay = firstDayOfMonth.toISOString().slice(0, 10);

  const [{ data: sales }, { data: cashIn }, { data: cashOut }] = await Promise.all([
    supabase
      .from("sales")
      .select("amount")
      .eq("status", "ativa")
      .gte("sale_date", isoFirstDay),
    supabase.from("cash_transactions").select("amount").eq("type", "entrada"),
    supabase.from("cash_transactions").select("amount").eq("type", "saida"),
  ]);

  const faturamento = (sales ?? []).reduce((acc, s) => acc + Number(s.amount), 0);
  const numeroVendas = sales?.length ?? 0;
  const ticketMedio = numeroVendas > 0 ? faturamento / numeroVendas : 0;

  const totalEntradas = (cashIn ?? []).reduce((acc, c) => acc + Number(c.amount), 0);
  const totalSaidas = (cashOut ?? []).reduce((acc, c) => acc + Number(c.amount), 0);
  const saldoCaixa = totalEntradas - totalSaidas;

  const cards = [
    { label: "Faturamento do mês", value: formatCurrency(faturamento) },
    { label: "Ticket médio", value: formatCurrency(ticketMedio) },
    { label: "Número de vendas", value: String(numeroVendas) },
    { label: "Saldo em caixa", value: formatCurrency(saldoCaixa) },
  ];

  return (
    <div>
      <h2 className="mb-6 font-serif text-2xl text-ink-900">Dashboard</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-gold-100 bg-white p-5 shadow-sm"
          >
            <p className="mb-1 text-xs text-ink-500">{card.label}</p>
            <p className="text-2xl font-medium text-gold-800">{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
