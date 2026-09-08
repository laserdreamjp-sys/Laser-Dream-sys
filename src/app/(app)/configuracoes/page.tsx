import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";
import { ManageableList } from "@/components/manageable-list";

export default async function ConfiguracoesPage() {
  const supabase = createClient();
  const { organizationId, userId, isAdmin } = await getCurrentProfile();

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
      <div>
        <h2 className="font-display font-semibold text-2xl text-foreground">Configurações</h2>
        {!isAdmin && (
          <p className="mt-1 text-sm text-muted-foreground">
            Edições e exclusões aqui viram solicitação para o administrador aprovar.
          </p>
        )}
      </div>

      <section>
        <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">Procedimentos</h3>
        <ManageableList
          table="procedures"
          organizationId={organizationId}
          userId={userId}
          canWrite={isAdmin}
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
        <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">Vendedoras</h3>
        <ManageableList
          table="sellers"
          organizationId={organizationId}
          userId={userId}
          canWrite={isAdmin}
          items={sellersRes.data ?? []}
          fields={[
            { key: "name", label: "Nome", type: "text" },
            { key: "unit_id", label: "Unidade", type: "select", options: unitOptions },
          ]}
        />
      </section>

      <section>
        <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Formas de pagamento
        </h3>
        <ManageableList
          table="payment_methods"
          organizationId={organizationId}
          userId={userId}
          canWrite={isAdmin}
          items={paymentMethodsRes.data ?? []}
          fields={[{ key: "name", label: "Nome", type: "text" }]}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          O item com código de Dinheiro gera entrada automática no caixa; o de Boleto/Recorrente
          entra na classificação Recorrente. Renomear o texto é seguro, o comportamento não muda.
        </p>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Origem do lead
        </h3>
        <ManageableList
          table="lead_origins"
          organizationId={organizationId}
          userId={userId}
          canWrite={isAdmin}
          items={leadOriginsRes.data ?? []}
          fields={[{ key: "name", label: "Nome", type: "text" }]}
        />
      </section>

      <section>
        <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Categorias de caixa
        </h3>
        <ManageableList
          table="cash_categories"
          organizationId={organizationId}
          userId={userId}
          canWrite={isAdmin}
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
