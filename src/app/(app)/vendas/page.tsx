import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";
import { SaleRowActions } from "@/components/sale-row-actions";

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR");
}

type SearchParams = {
  de?: string;
  ate?: string;
  procedimento?: string;
  vendedor?: string;
  segmento?: string;
  pagamento?: string;
  tipo?: string;
  status?: string;
};

export default async function VendasPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = createClient();
  const { organizationId, userId, isAdmin } = await getCurrentProfile();

  const proceduresRes = await supabase.from("procedures").select("id, name").order("name");
  const sellersRes = await supabase.from("sellers").select("id, name").order("name");
  const paymentMethodsRes = await supabase.from("payment_methods").select("id, name").order("name");

  let query = supabase
    .from("sales")
    .select(
      "id, sale_date, amount, status, tipo_venda, payment_method_id, notes, created_at, clients(name), sellers(name), procedures(id, name, segment), payment_methods(name), profiles!sales_created_by_fkey(full_name)"
    )
    .order("sale_date", { ascending: false })
    .limit(200);

  if (searchParams.de) query = query.gte("sale_date", searchParams.de);
  if (searchParams.ate) query = query.lte("sale_date", searchParams.ate);
  if (searchParams.procedimento) query = query.eq("procedure_id", searchParams.procedimento);
  if (searchParams.vendedor) query = query.eq("seller_id", searchParams.vendedor);
  if (searchParams.pagamento) query = query.eq("payment_method_id", searchParams.pagamento);
  if (searchParams.tipo) query = query.eq("tipo_venda", searchParams.tipo);
  if (searchParams.status) query = query.eq("status", searchParams.status);

  const { data: salesRaw } = await query;

  type SaleRow = {
    id: string;
    sale_date: string;
    amount: number;
    status: string;
    tipo_venda: string | null;
    payment_method_id: string;
    notes: string | null;
    created_at: string;
    clients: { name: string } | null;
    sellers: { name: string } | null;
    procedures: { id: string; name: string; segment: string | null } | null;
    payment_methods: { name: string } | null;
    profiles: { full_name: string } | null;
  };

  let sales = (salesRaw ?? []) as unknown as SaleRow[];
  if (searchParams.segmento) {
    sales = sales.filter((s) => s.procedures?.segment === searchParams.segmento);
  }

  const paymentMethods = paymentMethodsRes.data ?? [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-display font-semibold text-2xl text-foreground">Vendas</h2>
        <Link
          href="/vendas/novo"
          className="rounded-md bg-gold-500 px-4 py-2 text-sm font-medium text-white hover:bg-gold-600"
        >
          Nova venda
        </Link>
      </div>

      <form className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-4 lg:grid-cols-7">
        <input type="date" name="de" defaultValue={searchParams.de} className="rounded-md border border-border px-2 py-1 text-xs" />
        <input type="date" name="ate" defaultValue={searchParams.ate} className="rounded-md border border-border px-2 py-1 text-xs" />
        <select name="procedimento" defaultValue={searchParams.procedimento ?? ""} className="rounded-md border border-border px-2 py-1 text-xs">
          <option value="">Procedimento</option>
          {(proceduresRes.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select name="vendedor" defaultValue={searchParams.vendedor ?? ""} className="rounded-md border border-border px-2 py-1 text-xs">
          <option value="">Vendedor(a)</option>
          {(sellersRes.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select name="segmento" defaultValue={searchParams.segmento ?? ""} className="rounded-md border border-border px-2 py-1 text-xs">
          <option value="">Segmento</option>
          <option value="laser">Laser</option>
          <option value="estetica">Estética</option>
        </select>
        <select name="pagamento" defaultValue={searchParams.pagamento ?? ""} className="rounded-md border border-border px-2 py-1 text-xs">
          <option value="">Pagamento</option>
          {paymentMethods.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select name="tipo" defaultValue={searchParams.tipo ?? ""} className="rounded-md border border-border px-2 py-1 text-xs">
          <option value="">Tipo</option>
          <option value="REVENDA">Revenda</option>
          <option value="VENDA NOVA">Venda nova</option>
        </select>
        <select name="status" defaultValue={searchParams.status ?? ""} className="rounded-md border border-border px-2 py-1 text-xs">
          <option value="">Status</option>
          <option value="ativa">Ativa</option>
          <option value="cancelada">Cancelada</option>
        </select>
        <div className="col-span-2 flex gap-2 sm:col-span-4 lg:col-span-7">
          <button type="submit" className="rounded-md bg-gold-500 px-4 py-1.5 text-xs font-medium text-white hover:bg-gold-600">
            Filtrar
          </button>
          <Link href="/vendas" className="rounded-md border border-border px-4 py-1.5 text-xs text-foreground hover:bg-muted">
            Limpar
          </Link>
        </div>
      </form>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Vendedor(a)</th>
              <th className="px-4 py-3">Segmento</th>
              <th className="px-4 py-3">Procedimento</th>
              <th className="px-4 py-3">Pagamento</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3 text-right">Valor</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Registrado por</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((sale) => (
              <tr key={sale.id} className="border-t border-gold-50 align-top">
                <td className="px-4 py-3 whitespace-nowrap">{formatDate(sale.sale_date)}</td>
                <td className="px-4 py-3">{sale.clients?.name}</td>
                <td className="px-4 py-3">{sale.sellers?.name}</td>
                <td className="px-4 py-3">
                  {sale.procedures?.segment === "laser" ? "Laser" : sale.procedures?.segment === "estetica" ? "Estética" : "-"}
                </td>
                <td className="px-4 py-3">{sale.procedures?.name ?? "-"}</td>
                <td className="px-4 py-3">{sale.payment_methods?.name ?? "-"}</td>
                <td className="px-4 py-3">{sale.tipo_venda ?? "-"}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">{formatCurrency(Number(sale.amount))}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      sale.status === "ativa" ? "bg-gold-100 text-gold-800" : "bg-ink-100 text-muted-foreground"
                    }`}
                  >
                    {sale.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                  {sale.profiles?.full_name}
                  <br />
                  {formatDateTime(sale.created_at)}
                </td>
                <td className="px-4 py-3">
                  {sale.status === "ativa" && (
                    <SaleRowActions
                      saleId={sale.id}
                      organizationId={organizationId}
                      userId={userId}
                      isAdmin={isAdmin}
                      currentAmount={Number(sale.amount)}
                      currentPaymentMethodId={sale.payment_method_id}
                      currentNotes={sale.notes}
                      paymentMethods={paymentMethods}
                    />
                  )}
                </td>
              </tr>
            ))}

            {sales.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhuma venda encontrada para esses filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
