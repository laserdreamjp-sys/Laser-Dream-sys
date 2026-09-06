import { createClient } from "@/lib/supabase/server";
import { SimpleRegistrationForm } from "@/components/simple-registration-form";

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
    .select("id, name, category, active")
    .order("name");
  const packagesRes = await supabase
    .from("packages")
    .select("id, name, description, active")
    .order("name");
  const categoriesRes = await supabase
    .from("cash_categories")
    .select("id, name, type, active")
    .order("name");

  const procedures = proceduresRes.data ?? [];
  const packages = packagesRes.data ?? [];
  const categories = categoriesRes.data ?? [];

  return (
    <div className="space-y-10">
      <h2 className="font-serif text-2xl text-ink-900">Configurações</h2>

      <section>
        <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-ink-500">Procedimentos</h3>
        <SimpleRegistrationForm table="procedures" organizationId={organizationId} />
        <SimpleList items={procedures.map((p) => p.name)} empty="Nenhum procedimento cadastrado." />
      </section>

      <section>
        <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-ink-500">Pacotes</h3>
        <SimpleRegistrationForm table="packages" organizationId={organizationId} />
        <SimpleList items={packages.map((p) => p.name)} empty="Nenhum pacote cadastrado." />
      </section>

      <section>
        <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-ink-500">
          Categorias de caixa
        </h3>
        <SimpleRegistrationForm
          table="cash_categories"
          organizationId={organizationId}
          extraFields={[
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
        <SimpleList
          items={categories.map((c) => `${c.name} (${c.type})`)}
          empty="Nenhuma categoria cadastrada."
        />
      </section>
    </div>
  );
}

function SimpleList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-ink-500">{empty}</p>;
  }

  return (
    <ul className="divide-y divide-gold-50 rounded-lg border border-gold-100 bg-white text-sm">
      {items.map((item, i) => (
        <li key={i} className="px-4 py-2">
          {item}
        </li>
      ))}
    </ul>
  );
}
