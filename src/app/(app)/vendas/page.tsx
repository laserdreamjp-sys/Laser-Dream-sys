import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";
import { SaleRowActions } from "@/components/sale-row-actions";
import { MonthSwitcher } from "@/components/month-switcher";
import { ColumnFilter } from "@/components/column-filter";
import { Pagination } from "@/components/pagination";

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR");
}

function currentMonthStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthBounds(monthStr: string) {
  const [y, m] = monthStr.split("-").map(Number);
  const de = `${monthStr}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const ate = `${monthStr}-${String(lastDay).padStart(2, "0")}`;
  return { de, ate };
}

function listaOuVazio(valor?: string): string[] {
  return (valor ?? "").split(",").filter(Boolean);
}

type SearchParams = {
  mes?: string;
  procedimento?: string;
  vendedor?: string;
  segmento?: string;
  pagamento?: string;
  tipo?: string;
  status?: string;
  pagina?: string;
  porPagina?: string;
};

export default async function VendasPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = createClient();
  const { organizationId, userId, isAdmin } = await getCurrentProfile();

  const selectedMonth = searchParams.mes ?? currentMonthStr();
  const { de, ate } = monthBounds(selectedMonth);

  const proceduresRes = await supabase.from("procedures").select("id, name, segment").order("name");
  const sellersRes = await supabase.from("sellers").select("id, name").order("name");
  const paymentMethodsRes = await supabase.from("payment_methods").select("id, name").order("name");
  const areasRes = await supabase
    .from("procedure_areas")
    .select("id, name, group_label, procedure_id, segment")
    .eq("active", true)
    .order("name");

  const procedimentos = listaOuVazio(searchParams.procedimento);
  const vendedores = listaOuVazio(searchParams.vendedor);
  const segmentos = listaOuVazio(searchParams.segmento);
  const pagamentos = listaOuVazio(searchParams.pagamento);
  const tipos = listaOuVazio(searchParams.tipo);
  const statuses = listaOuVazio(searchParams.status);

  let query = supabase
    .from("sales")
    .select(
      "id, sale_date, amount, status, tipo_venda, payment_method_id, procedure_id, client_id, seller_id, notes, created_at, clients(name), sellers!sales_seller_id_fkey(name), procedures(id, name, segment), payment_methods(name), profiles!sales_created_by_fkey(full_name)"
    )
    .gte("sale_date", de)
    .lte("sale_date", ate)
    .order("sale_date", { ascending: false })
    .limit(1000);

  if (procedimentos.length > 0) query = query.in("procedure_id", procedimentos);
  if (vendedores.length > 0) query = query.in("seller_id", vendedores);
  if (pagamentos.length > 0) query = query.in("payment_method_id", pagamentos);
  if (tipos.length > 0) query = query.in("tipo_venda", tipos);
  if (statuses.length > 0) query = query.in("status", statuses);

  const { data: salesRaw, error: salesError } = await query;

  if (salesError) {
    return (
      <div className="rounded-lg border border-destructive bg-destructive/5 p-5">
        <p className="font-medium text-destructive">Não foi possível carregar as vendas.</p>
        <p className="mt-2 text-sm text-muted-foreground">{salesError.message}</p>
      </div>
    );
  }

  type SaleRow = {
    id: string;
    sale_date: string;
    amount: number;
    status: string;
    tipo_venda: string | null;
    payment_method_id: string;
    procedure_id: string | null;
    client_id: string;
    seller_id: string | null;
    notes: string | null;
    created_at: string;
    clients: { name: string } | null;
    sellers: { name: string } | null;
    procedures: { id: string; name: string; segment: string | null } | null;
    payment_methods: { name: string } | null;
    profiles: { full_name: string } | null;
  };

  let sales = (salesRaw ?? []) as unknown as SaleRow[];
  if (segmentos.length > 0) {
    sales = sales.filter((s) => s.procedures?.segment && segmentos.includes(s.procedures.segment));
  }

  const saleIds = sales.map((s) => s.id);
  const areasBySale = new Map<string, string[]>();
  const areaIdsBySale = new Map<string, string[]>();
  if (saleIds.length > 0) {
    const { data: saleAreasRaw, error: areasErr } = await supabase
      .from("sale_areas")
      .select("sale_id, area_id, procedure_areas(name)")
      .in("sale_id", saleIds);

    if (areasErr) throw new Error(`Falha ao carregar as áreas das vendas: ${areasErr.message}`);

    type SaleAreaRow = { sale_id: string; area_id: string; procedure_areas: { name: string } | null };
    for (const row of (saleAreasRaw ?? []) as unknown as SaleAreaRow[]) {
      const idList = areaIdsBySale.get(row.sale_id) ?? [];
      idList.push(row.area_id);
      areaIdsBySale.set(row.sale_id, idList);
      if (!row.procedure_areas) continue;
      const list = areasBySale.get(row.sale_id) ?? [];
      list.push(row.procedure_areas.name);
      areasBySale.set(row.sale_id, list);
    }
  }

  const paymentMethods = paymentMethodsRes.data ?? [];

  const totalMesAtivas = sales
    .filter((s) => s.status === "ativa")
    .reduce((acc, s) => acc + Number(s.amount), 0);
  const qtdMesAtivas = sales.filter((s) => s.status === "ativa").length;

  const pageSize = [25, 50, 100].includes(Number(searchParams.porPagina)) ? Number(searchParams.porPagina) : 50;
  const page = Math.max(1, Number(searchParams.pagina) || 1);
  const totalFiltrado = sales.length;
  const salesPagina = sales.slice((page - 1) * pageSize, page * pageSize);

  const otherParams = Object.fromEntries(
    Object.entries(searchParams).filter(([k, v]) => v && k !== "mes" && k !== "pagina" && k !== "porPagina")
  ) as Record<string, string>;
  const currentParams = Object.fromEntries(
    Object.entries(searchParams).filter(([, v]) => v)
  ) as Record<string, string>;

  const exportParams = new URLSearchParams({ ...otherParams, de, ate }).toString();

  return (
    <div>
      <div className="mb-4 rounded-lg border border-gold-300 bg-gold-50 p-4 shadow-soft dark:border-gold-700 dark:bg-gold-900/20">
        <p className="text-xs text-gold-700 dark:text-gold-300">Total vendido no mês (vendas ativas)</p>
        <p className="font-display text-3xl font-semibold text-gold-700 dark:text-gold-300">
          {formatCurrency(totalMesAtivas)}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{qtdMesAtivas} venda(s)</p>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-display font-semibold text-2xl text-foreground">Vendas</h2>
          <MonthSwitcher currentMonth={selectedMonth} basePath="/vendas" otherParams={otherParams} />
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <a
              href={`/api/relatorios/vendas?${exportParams}`}
              className="rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-muted"
            >
              Baixar CSV
            </a>
          )}
          <Link
            href="/vendas/novo"
            className="rounded-md bg-gold-500 px-4 py-2 text-sm font-medium text-white hover:bg-gold-600"
          >
            Nova venda
          </Link>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-3 lg:grid-cols-6">
        <ColumnFilter
          label="Procedimento"
          paramName="procedimento"
          options={(proceduresRes.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
          currentParams={{ ...currentParams, mes: selectedMonth }}
        />
        <ColumnFilter
          label="Vendedor(a)"
          paramName="vendedor"
          options={(sellersRes.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
          currentParams={{ ...currentParams, mes: selectedMonth }}
        />
        <ColumnFilter
          label="Segmento"
          paramName="segmento"
          options={[
            { value: "laser", label: "Laser" },
            { value: "estetica", label: "Estética" },
          ]}
          currentParams={{ ...currentParams, mes: selectedMonth }}
        />
        <ColumnFilter
          label="Pagamento"
          paramName="pagamento"
          options={paymentMethods.map((p) => ({ value: p.id, label: p.name }))}
          currentParams={{ ...currentParams, mes: selectedMonth }}
        />
        <ColumnFilter
          label="Tipo"
          paramName="tipo"
          options={[
            { value: "REVENDA", label: "Revenda" },
            { value: "VENDA NOVA", label: "Venda nova" },
          ]}
          currentParams={{ ...currentParams, mes: selectedMonth }}
        />
        <ColumnFilter
          label="Status"
          paramName="status"
          options={[
            { value: "ativa", label: "Ativa" },
            { value: "cancelada", label: "Cancelada" },
          ]}
          currentParams={{ ...currentParams, mes: selectedMonth }}
        />
        <div className="col-span-2 sm:col-span-3 lg:col-span-6">
          <Link href={`/vendas?mes=${selectedMonth}`} className="text-xs text-muted-foreground underline hover:text-foreground">
            Limpar todos os filtros
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Vendedor(a)</th>
              <th className="px-4 py-3">Segmento</th>
              <th className="px-4 py-3">Procedimento</th>
              <th className="px-4 py-3">Áreas</th>
              <th className="px-4 py-3">Pagamento</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3 text-right">Valor</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Registrado por</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {salesPagina.map((sale) => (
              <tr key={sale.id} className="border-t border-border align-top">
                <td className="px-4 py-3 whitespace-nowrap">{formatDate(sale.sale_date)}</td>
                <td className="px-4 py-3">{sale.clients?.name}</td>
                <td className="px-4 py-3">{sale.sellers?.name}</td>
                <td className="px-4 py-3">
                  {sale.procedures?.segment === "laser" ? "Laser" : sale.procedures?.segment === "estetica" ? "Estética" : "-"}
                </td>
                <td className="px-4 py-3">{sale.procedures?.name ?? "-"}</td>
                <td className="px-4 py-3 max-w-[200px]">
                  {(areasBySale.get(sale.id) ?? []).join(", ") || "-"}
                </td>
                <td className="px-4 py-3">{sale.payment_methods?.name ?? "-"}</td>
                <td className="px-4 py-3">{sale.tipo_venda ?? "-"}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">{formatCurrency(Number(sale.amount))}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      sale.status === "ativa" ? "bg-gold-100 text-gold-800" : "bg-muted text-muted-foreground"
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
                      currentSaleDate={sale.sale_date}
                      currentClientId={sale.client_id}
                      currentClientName={sale.clients?.name ?? ""}
                      currentSellerId={sale.seller_id}
                      currentProcedureId={sale.procedure_id}
                      currentTipoVenda={sale.tipo_venda}
                      currentAreaIds={areaIdsBySale.get(sale.id) ?? []}
                      sellers={sellersRes.data ?? []}
                      procedures={proceduresRes.data ?? []}
                      areas={areasRes.data ?? []}
                    />
                  )}
                </td>
              </tr>
            ))}

            {salesPagina.length === 0 && (
              <tr>
                <td colSpan={12} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhuma venda encontrada em {selectedMonth} para esses filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <Pagination page={page} pageSize={pageSize} total={totalFiltrado} otherParams={{ ...otherParams, mes: selectedMonth }} />
      </div>
    </div>
  );
}
