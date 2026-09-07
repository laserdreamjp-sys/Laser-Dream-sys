import { createClient } from "@/lib/supabase/server";
import { ManageableList } from "@/components/manageable-list";

export default async function ConfiguracoesPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profileRaw } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user!.id)
    .single();

  const profile = profileRaw as { organization_id: string } | null;
  const organizationId = profile!.organization_id;

  const proceduresRes = await supabase
    .from("procedures")
    .select("id, name, segment, active")
    .order("name");
  const sellersRes = await supabase
    .from("sellers")
    .select("id, name, unit_id, active")
    .order("name");
  const unitsRes = await supabase.from("units").select("id, name").eq("active", true).order("name");
  const paymentMethodsRes = await supabase
    .from("payment_methods")
    .select("id, name, code, active")
    .order("name");
  const leadOriginsRes = await supabase
    .from("lead_origins")
    .select("id, name, code, active")
    .order("name");
  const categoriesRes = await supabase
    .from("cash_categories")
    .select("id, name, type, active")
    .order("name");

  const units = unitsRes.data ?? [];
  const unitOptions = [{ value: "", label: "Sem unidade fixa" }, ...units.map((u) => ({ value: u.id, label: u.name }))];

  return (
    <div className="space-y-10">
      <h2 className="font-serif text-2xl text-ink-900">Configurações</h2>

      <section>
        <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-ink-500">Procedimentos</h3>
        <ManageableList
          table="procedures"
          organizationId={organizationId}
          items={proceduresRes.data ?? []}
          fields={[
            { key: "name", label: "Nome", type: "text" },
            {
              key: "segment",
              label: "Segmento",
              type: "select",
              options: [
                { value: "laser", label: "Depilação a Laser" },
                { value: "estetica", label: "Estética" },
              ],
            },
          ]}
        />
      </section>

      <section>
        <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-ink-500">Vendedoras</h3>
        <ManageableList
          table="sellers"
          organizationId={organizationId}
          items={sellersRes.data ?? []}
          fields={[
            { key: "name", label: "Nome", type: "text" },
            { key: "unit_id", label: "Unidade", type: "select", options: unitOptions },
          ]}
        />
      </section>

      <section>
        <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-ink-500">
          Formas de pagamento
        </h3>
        <ManageableList
          table="payment_methods"
          organizationId={organizationId}
          items={paymentMethodsRes.data ?? []}
          fields={[{ key: "name", label: "Nome", type: "text" }]}
        />
        <p className="mt-1 text-xs text-ink-500">
          O item com código de Dinheiro gera entrada automática no caixa; o de Boleto/Recorrente
          entra na classificação Recorrente. Renomear o texto é seguro, o comportamento não muda.
        </p>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-ink-500">
          Origem do lead
        </h3>
        <ManageableList
          table="lead_origins"
          organizationId={organizationId}
          items={leadOriginsRes.data ?? []}
          fields={[{ key: "name", label: "Nome", type: "text" }]}
        />
      </section>

      <section>
        <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-ink-500">
          Categorias de caixa
        </h3>
        <ManageableList
          table="cash_categories"
          organizationId={organizationId}
          items={categoriesRes.data ?? []}
          fields={[
            { key: "name", label: "Nome", type: "text" },
            {
              key: "type",
              label: "Tipo",
              type: "select",
              options: [
                { value: "entrada", label: "Entrada" },
                { value: "saida", label: "Saída" },
              ],
            },
          ]}
        />
      </section>
    </div>
  );
}
