import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export default async function VendasPage() {
  const supabase = createClient();

  const { data: salesRaw } = await supabase
    .from("sales")
    .select("id, sale_date, amount, payment_method, status, clients(name), profiles!sales_seller_id_fkey(full_name)")
    .order("sale_date", { ascending: false })
    .limit(50);

  type SaleRow = {
    id: string;
    sale_date: string;
    amount: number;
    payment_method: string;
    status: string;
    clients: { name: string } | null;
    profiles: { full_name: string } | null;
  };

  const sales = (salesRaw ?? []) as unknown as SaleRow[];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-serif text-2xl text-ink-900">Vendas</h2>
        <Link
          href="/vendas/novo"
          className="rounded-md bg-gold-500 px-4 py-2 text-sm font-medium text-white hover:bg-gold-600"
        >
          Nova venda
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-gold-100 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gold-50 text-left text-xs uppercase tracking-wide text-ink-500">
            <tr>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Vendedor</th>
              <th className="px-4 py-3">Pagamento</th>
              <th className="px-4 py-3 text-right">Valor</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((sale) => (
              <tr key={sale.id} className="border-t border-gold-50">
                <td className="px-4 py-3">{formatDate(sale.sale_date)}</td>
                <td className="px-4 py-3">{sale.clients?.name}</td>
                <td className="px-4 py-3">{sale.profiles?.full_name}</td>
                <td className="px-4 py-3">{sale.payment_method}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(Number(sale.amount))}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      sale.status === "ativa"
                        ? "bg-gold-100 text-gold-800"
                        : "bg-ink-100 text-ink-500"
                    }`}
                  >
                    {sale.status}
                  </span>
                </td>
              </tr>
            ))}

            {sales.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink-500">
                  Nenhuma venda registrada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
