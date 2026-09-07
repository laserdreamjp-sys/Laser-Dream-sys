import { createClient } from "@/lib/supabase/server";
import { SegmentChart, PaymentMethodChart, RecorrenteAlert } from "@/components/dashboard-charts";

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function DashboardPage() {
  const supabase = createClient();

  const firstDayOfMonth = new Date();
  firstDayOfMonth.setDate(1);
  const isoFirstDay = firstDayOfMonth.toISOString().slice(0, 10);

  const salesRes = await supabase
    .from("sales")
    .select("amount, tipo_venda, procedures(segment), payment_methods(name, code), sellers(name)")
    .eq("status", "ativa")
    .gte("sale_date", isoFirstDay);
  const cashInRes = await supabase.from("cash_transactions").select("amount").eq("type", "entrada");
  const cashOutRes = await supabase.from("cash_transactions").select("amount").eq("type", "saida");

  type SaleAgg = {
    amount: number;
    tipo_venda: string | null;
    procedures: { segment: string | null } | null;
    payment_methods: { name: string; code: string } | null;
    sellers: { name: string } | null;
  };

  const sales = (salesRes.data ?? []) as unknown as SaleAgg[];
  const cashIn: { amount: number }[] = cashInRes.data ?? [];
  const cashOut: { amount: number }[] = cashOutRes.data ?? [];

  const faturamento = sales.reduce((acc, s) => acc + Number(s.amount), 0);
  const numeroVendas = sales.length;
  const ticketMedio = numeroVendas > 0 ? faturamento / numeroVendas : 0;

  const totalEntradas = cashIn.reduce((acc, c) => acc + Number(c.amount), 0);
  const totalSaidas = cashOut.reduce((acc, c) => acc + Number(c.amount), 0);
  const saldoCaixa = totalEntradas - totalSaidas;

  const cards = [
    { label: "Faturamento do mês", value: formatCurrency(faturamento) },
    { label: "Ticket médio", value: formatCurrency(ticketMedio) },
    { label: "Número de vendas", value: String(numeroVendas) },
    { label: "Saldo em caixa", value: formatCurrency(saldoCaixa) },
  ];

  const segmentTotals = new Map<string, number>();
  for (const s of sales) {
    const key = s.procedures?.segment === "laser" ? "Laser" : s.procedures?.segment === "estetica" ? "Estética" : "Outros";
    segmentTotals.set(key, (segmentTotals.get(key) ?? 0) + Number(s.amount));
  }
  const segmentData = Array.from(segmentTotals.entries()).map(([name, total]) => ({ name, total }));

  const paymentTotals = new Map<string, number>();
  for (const s of sales) {
    const key = s.payment_methods?.name ?? "-";
    paymentTotals.set(key, (paymentTotals.get(key) ?? 0) + Number(s.amount));
  }
  const paymentData = Array.from(paymentTotals.entries()).map(([name, total]) => ({ name, total }));

  const recorrenteTotal = sales
    .filter((s) => s.payment_methods?.code === "boleto_recorrente")
    .reduce((acc, s) => acc + Number(s.amount), 0);
  const recorrentePct = faturamento > 0 ? (recorrenteTotal / faturamento) * 100 : 0;

  const revendaTotal = sales.filter((s) => s.tipo_venda === "REVENDA").reduce((acc, s) => acc + Number(s.amount), 0);
  const novaTotal = sales.filter((s) => s.tipo_venda === "VENDA NOVA").reduce((acc, s) => acc + Number(s.amount), 0);

  const sellerAgg = new Map<string, { total: number; count: number }>();
  for (const s of sales) {
    const key = s.sellers?.name ?? "-";
    const cur = sellerAgg.get(key) ?? { total: 0, count: 0 };
    cur.total += Number(s.amount);
    cur.count += 1;
    sellerAgg.set(key, cur);
  }
  const sellerRanking = Array.from(sellerAgg.entries())
    .map(([name, { total, count }]) => ({ name, total, count, ticket: count > 0 ? total / count : 0 }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-6">
      <h2 className="font-serif text-2xl text-ink-900">Dashboard</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border border-gold-100 bg-white p-5 shadow-sm">
            <p className="mb-1 text-xs text-ink-500">{card.label}</p>
            <p className="text-2xl font-medium text-gold-800">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SegmentChart data={segmentData} />
        <PaymentMethodChart data={paymentData} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RecorrenteAlert pct={recorrentePct} />

        <div className="rounded-lg border border-gold-100 bg-white p-4">
          <p className="mb-2 text-sm font-medium text-ink-700">Revenda x Venda nova</p>
          <div className="flex items-end gap-6">
            <div>
              <p className="text-xs text-ink-500">Revenda</p>
              <p className="text-xl font-medium text-gold-800">{formatCurrency(revendaTotal)}</p>
            </div>
            <div>
              <p className="text-xs text-ink-500">Venda nova</p>
              <p className="text-xl font-medium text-gold-800">{formatCurrency(novaTotal)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gold-100 bg-white">
        <p className="border-b border-gold-100 px-4 py-3 text-sm font-medium text-ink-700">
          Desempenho por vendedora
        </p>
        <table className="w-full text-sm">
          <thead className="bg-gold-50 text-left text-xs uppercase tracking-wide text-ink-500">
            <tr>
              <th className="px-4 py-2">Vendedora</th>
              <th className="px-4 py-2 text-right">Total vendido</th>
              <th className="px-4 py-2 text-right">Nº vendas</th>
              <th className="px-4 py-2 text-right">Ticket médio</th>
              <th className="px-4 py-2">Farol</th>
            </tr>
          </thead>
          <tbody>
            {sellerRanking.map((s) => {
              const farol = s.ticket >= 850 ? "Meta batida" : s.ticket >= 650 ? "Atenção" : "Abaixo do ideal";
              const color =
                s.ticket >= 850 ? "bg-gold-100 text-gold-800" : s.ticket >= 650 ? "bg-gold-50 text-gold-700" : "bg-ink-100 text-ink-500";
              return (
                <tr key={s.name} className="border-t border-gold-50">
                  <td className="px-4 py-2">{s.name}</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(s.total)}</td>
                  <td className="px-4 py-2 text-right">{s.count}</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(s.ticket)}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${color}`}>{farol}</span>
                  </td>
                </tr>
              );
            })}
            {sellerRanking.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-ink-500">
                  Sem vendas no período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
