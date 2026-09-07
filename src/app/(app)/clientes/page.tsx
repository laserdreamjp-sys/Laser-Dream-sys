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
    .select("id, name, phone, email, created_at")
    .order("name");

  return (
    <div>
      <h2 className="mb-6 font-serif text-2xl text-ink-900">Clientes</h2>

      <NewClientForm organizationId={profile!.organization_id} />

      <div className="overflow-x-auto rounded-lg border border-gold-100 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gold-50 text-left text-xs uppercase tracking-wide text-ink-500">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Telefone</th>
              <th className="px-4 py-3">E-mail</th>
            </tr>
          </thead>
          <tbody>
            {(clients ?? []).map((client) => (
              <tr key={client.id} className="border-t border-gold-50">
                <td className="px-4 py-3">{client.name}</td>
                <td className="px-4 py-3">{client.phone ?? "-"}</td>
                <td className="px-4 py-3">{client.email ?? "-"}</td>
              </tr>
            ))}
            {(clients ?? []).length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-ink-500">
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
