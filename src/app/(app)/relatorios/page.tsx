import { createClient } from "@/lib/supabase/server";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: { cliente?: string };
}) {
  const supabase = createClient();

  const clientsRes = await supabase.from("clients").select("id, name").order("name");
  const clients = clientsRes.data ?? [];
  const selectedClientId = searchParams.cliente ?? "";

  type HistoryRow = {
    id: string;
    sale_date: string;
    amount: number;
    procedures: { id: string; name: string; segment: string | null } | null;
  };

  let history: HistoryRow[] = [];
  let doneProcedureIds = new Set<string>();
  let doneAreaIds = new Set<string>();

  if (selectedClientId) {
    const { data } = await supabase
      .from("sales")
      .select("id, sale_date, amount, procedures(id, name, segment)")
      .eq("client_id", selectedClientId)
      .eq("status", "ativa")
      .order("sale_date", { ascending: false });

    history = (data ?? []) as unknown as HistoryRow[];
    doneProcedureIds = new Set(history.map((h) => h.procedures?.id).filter(Boolean) as string[]);

    const saleIds = history.map((h) => h.id);
    if (saleIds.length > 0) {
      const { data: areasData } = await supabase
        .from("sale_areas")
        .select("area_id")
        .in("sale_id", saleIds);
      doneAreaIds = new Set((areasData ?? []).map((a) => a.area_id));
    }
  }

  const laserAreasRes = await supabase
    .from("procedure_areas")
    .select("id, name, group_label")
    .eq("segment", "laser")
    .eq("active", true)
    .order("name");

  const esteticaProceduresRes = await supabase
    .from("procedures")
    .select("id, name")
    .eq("segment", "estetica")
    .eq("active", true)
    .order("name");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display font-semibold text-2xl text-foreground">Relatórios</h2>
        <a
          href="/api/relatorios/clientes-procedimentos"
          className="rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-muted"
        >
          Exportar clientes x procedimentos (CSV)
        </a>
      </div>

      <section className="rounded-lg border border-border bg-surface p-4">
        <p className="mb-3 text-sm font-medium text-foreground">
          Histórico e oportunidades por cliente
        </p>
        <form method="get" className="flex gap-2">
          <select
            name="cliente"
            defaultValue={selectedClientId}
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Selecione um cliente</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-md bg-gold-500 px-4 py-2 text-sm font-medium text-white hover:bg-gold-600">
            Ver
          </button>
        </form>
      </section>

      {selectedClientId && (
        <>
          <section>
            <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Já fez
            </h3>
            <ul className="divide-y divide-border rounded-lg border border-border bg-surface text-sm">
              {history.map((h) => (
                <li key={h.id} className="flex items-center justify-between px-4 py-2">
                  <span>
                    {formatDate(h.sale_date)} · {h.procedures?.name ?? "-"}
                  </span>
                  <span className="text-muted-foreground">{formatCurrency(Number(h.amount))}</span>
                </li>
              ))}
              {history.length === 0 && (
                <li className="px-4 py-6 text-center text-muted-foreground">
                  Este cliente ainda não tem vendas registradas.
                </li>
              )}
            </ul>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Depilação a laser: áreas em aberto
            </h3>
            <div className="flex flex-wrap gap-2 rounded-lg border border-border bg-surface p-4">
              {(laserAreasRes.data ?? []).map((a) => {
                const done = doneAreaIds.has(a.id);
                return (
                  <span
                    key={a.id}
                    className={`rounded-full px-3 py-1 text-xs ${
                      done
                        ? "bg-gold-100 text-gold-800 line-through"
                        : "border border-border text-foreground"
                    }`}
                  >
                    {a.name}
                  </span>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Estética: procedimentos em aberto
            </h3>
            <div className="flex flex-wrap gap-2 rounded-lg border border-border bg-surface p-4">
              {(esteticaProceduresRes.data ?? []).map((p) => {
                const done = doneProcedureIds.has(p.id);
                return (
                  <span
                    key={p.id}
                    className={`rounded-full px-3 py-1 text-xs ${
                      done
                        ? "bg-gold-100 text-gold-800 line-through"
                        : "border border-border text-foreground"
                    }`}
                  >
                    {p.name}
                  </span>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Riscado é o que o cliente já fez; sem risco é oportunidade de oferecer.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
