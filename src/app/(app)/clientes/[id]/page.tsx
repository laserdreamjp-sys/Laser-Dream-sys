import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatCpf } from "@/lib/cpf";

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(value: string) {
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

const TIER_STYLE: Record<string, string> = {
  Diamante: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  Ouro: "bg-gold-100 text-gold-800 dark:bg-gold-900/40 dark:text-gold-300",
  Prata: "bg-muted text-foreground",
  Bronze: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
};

type SaleRow = {
  id: string;
  sale_date: string;
  amount: number;
  status: string;
  procedures: { name: string; segment: string | null } | null;
  payment_methods: { name: string } | null;
  sellers: { name: string } | null;
  co_seller: { name: string } | null;
  sale_areas: { procedure_areas: { name: string } | null }[];
};

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("id, name, cpf, phone, email, birth_date, cep, logradouro, numero, complemento, bairro, cidade, uf")
    .eq("id", params.id)
    .single();

  if (!client) notFound();

  const { data: intelRows } = await supabase
    .from("client_intelligence")
    .select("unit_id, valor_total, total_compras, dias_desde_ultima, tier")
    .eq("client_id", params.id);

  const rows = intelRows ?? [];
  const valorTotal = rows.reduce((acc, r) => acc + Number(r.valor_total ?? 0), 0);
  const totalCompras = rows.reduce((acc, r) => acc + Number(r.total_compras ?? 0), 0);
  const diasDesdeUltima = rows
    .map((r) => r.dias_desde_ultima)
    .filter((d): d is number => d !== null && d !== undefined)
    .reduce<number | null>((min, d) => (min === null || d < min ? d : min), null);
  const ticketMedio = totalCompras > 0 ? valorTotal / totalCompras : 0;

  const TIER_ORDER = ["Bronze", "Prata", "Ouro", "Diamante"];
  const tier =
    rows
      .map((r) => r.tier as string)
      .sort((a, b) => TIER_ORDER.indexOf(b) - TIER_ORDER.indexOf(a))[0] ?? "Bronze";

  const intel = {
    valor_total: valorTotal,
    total_compras: totalCompras,
    dias_desde_ultima: diasDesdeUltima,
    ticket_medio: ticketMedio,
    tier,
  };

  const { data: salesData } = await supabase
    .from("sales")
    .select(
      "id, sale_date, amount, status, procedures(name, segment), payment_methods(name), sellers(name), co_seller:sellers!sales_co_seller_id_fkey(name), sale_areas(procedure_areas(name))"
    )
    .eq("client_id", params.id)
    .order("sale_date", { ascending: false });

  const sales = (salesData ?? []) as unknown as SaleRow[];

  const { data: allAreas } = await supabase
    .from("procedure_areas")
    .select("name, group_label")
    .eq("segment", "laser")
    .neq("group_label", "Combos")
    .order("group_label")
    .order("name");

  const { data: allProcedures } = await supabase
    .from("procedures")
    .select("name")
    .eq("segment", "estetica")
    .order("name");

  const areasFeitas = new Set<string>();
  const procedimentosFeitos = new Set<string>();
  for (const s of sales) {
    if (s.status !== "ativa") continue;
    for (const sa of s.sale_areas) {
      if (sa.procedure_areas?.name) areasFeitas.add(sa.procedure_areas.name);
    }
    if (s.procedures?.segment === "estetica" && s.procedures.name) {
      procedimentosFeitos.add(s.procedures.name);
    }
  }

  const areasPorGrupo = new Map<string, { name: string; feito: boolean }[]>();
  for (const a of allAreas ?? []) {
    const list = areasPorGrupo.get(a.group_label) ?? [];
    list.push({ name: a.name, feito: areasFeitas.has(a.name) });
    areasPorGrupo.set(a.group_label, list);
  }

  const procedimentosComStatus = (allProcedures ?? []).map((p) => ({
    name: p.name,
    feito: procedimentosFeitos.has(p.name),
  }));


  return (
    <div className="space-y-6">
      <Link href="/clientes" className="text-sm text-muted-foreground hover:underline">
        ← Voltar para clientes
      </Link>

      <div className="rounded-lg border border-border bg-surface p-5 shadow-soft">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-2xl font-semibold text-foreground">{client.name}</h2>
          {tier && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TIER_STYLE[tier] ?? "bg-muted"}`}>
              {tier}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {client.cpf ? `CPF ${formatCpf(client.cpf)} · ` : ""}
          {client.phone ?? "sem telefone"} {client.email ? `· ${client.email}` : ""}
        </p>
        {(client.logradouro || client.cidade) && (
          <p className="mt-1 text-sm text-muted-foreground">
            {[
              client.logradouro && `${client.logradouro}${client.numero ? `, ${client.numero}` : ""}`,
              client.complemento,
              client.bairro,
              client.cidade && `${client.cidade}${client.uf ? `/${client.uf}` : ""}`,
              client.cep,
            ].filter(Boolean).join(" · ")}
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Total gasto</p>
            <p className="text-lg font-medium text-gold-700 dark:text-gold-400">
              {formatCurrency(Number(intel?.valor_total ?? 0))}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Compras</p>
            <p className="text-lg font-medium text-foreground">{intel?.total_compras ?? 0}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Ticket médio</p>
            <p className="text-lg font-medium text-foreground">
              {formatCurrency(Number(intel?.ticket_medio ?? 0))}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Última compra</p>
            <p className="text-lg font-medium text-foreground">
              {intel?.dias_desde_ultima !== null && intel?.dias_desde_ultima !== undefined
                ? `há ${intel.dias_desde_ultima} dias`
                : "nunca comprou"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="mb-3 text-sm font-medium text-foreground">Áreas de laser: feitas x em aberto</p>
          <div className="space-y-3">
            {Array.from(areasPorGrupo.entries()).map(([grupo, areas]) => (
              <div key={grupo}>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{grupo}</p>
                <div className="flex flex-wrap gap-1.5">
                  {areas.map((a) => (
                    <span
                      key={a.name}
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        a.feito
                          ? "bg-gold-100 text-gold-800 dark:bg-gold-900/30 dark:text-gold-300"
                          : "border border-dashed border-border text-muted-foreground"
                      }`}
                    >
                      {a.feito ? "✓ " : ""}
                      {a.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="mb-3 text-sm font-medium text-foreground">Estética: feita x em aberto</p>
          <div className="flex flex-wrap gap-1.5">
            {procedimentosComStatus.map((p) => (
              <span
                key={p.name}
                className={`rounded-full px-2 py-0.5 text-xs ${
                  p.feito
                    ? "bg-gold-100 text-gold-800 dark:bg-gold-900/30 dark:text-gold-300"
                    : "border border-dashed border-border text-muted-foreground"
                }`}
              >
                {p.feito ? "✓ " : ""}
                {p.name}
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Marcados são os que a cliente já fez. Os pontilhados são oportunidade de venda cruzada.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <p className="border-b border-border px-4 py-3 text-sm font-medium text-foreground">Histórico de compras</p>
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Data</th>
              <th className="px-4 py-2">Procedimento</th>
              <th className="px-4 py-2">Áreas</th>
              <th className="px-4 py-2 text-right">Valor</th>
              <th className="px-4 py-2">Pagamento</th>
              <th className="px-4 py-2">Vendedora</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id} className="border-t border-border">
                <td className="px-4 py-2 whitespace-nowrap">{formatDate(s.sale_date)}</td>
                <td className="px-4 py-2">{s.procedures?.name ?? "-"}</td>
                <td className="px-4 py-2 text-xs text-muted-foreground">
                  {s.sale_areas.map((sa) => sa.procedure_areas?.name).filter(Boolean).join(", ") || "-"}
                </td>
                <td className="px-4 py-2 text-right">{formatCurrency(Number(s.amount))}</td>
                <td className="px-4 py-2">{s.payment_methods?.name ?? "-"}</td>
                <td className="px-4 py-2">
                  {s.sellers?.name ?? "-"}
                  {s.co_seller?.name ? ` + ${s.co_seller.name}` : ""}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      s.status === "ativa"
                        ? "bg-gold-100 text-gold-800 dark:bg-gold-900/30 dark:text-gold-300"
                        : "bg-muted text-muted-foreground line-through"
                    }`}
                  >
                    {s.status === "ativa" ? "ativa" : "cancelada"}
                  </span>
                </td>
              </tr>
            ))}
            {sales.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhuma compra registrada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
