import { createClient } from "@/lib/supabase/server";
import { NewClientForm } from "@/components/new-client-form";

export default async function ClientesPage() {
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

  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, phone, email, birth_date, created_at")
    .order("name");

  function formatBirthDate(value: string | null) {
    if (!value) return "-";
    const [, month, day] = value.split("-");
    return `${day}/${month}`;
  }

  return (
    <div>
      <h2 className="mb-6 font-display font-semibold text-2xl text-foreground">Clientes</h2>

      <NewClientForm organizationId={profile!.organization_id} />

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Telefone</th>
              <th className="px-4 py-3">E-mail</th>
              <th className="px-4 py-3">Aniversário</th>
            </tr>
          </thead>
          <tbody>
            {(clients ?? []).map((client) => (
              <tr key={client.id} className="border-t border-border">
                <td className="px-4 py-3">{client.name}</td>
                <td className="px-4 py-3">{client.phone ?? "-"}</td>
                <td className="px-4 py-3">{client.email ?? "-"}</td>
                <td className="px-4 py-3">{formatBirthDate(client.birth_date)}</td>
              </tr>
            ))}
            {(clients ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhum cliente cadastrado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
