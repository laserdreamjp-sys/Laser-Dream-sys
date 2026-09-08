import { createClient } from "@/lib/supabase/server";
import { NewInviteForm } from "@/components/new-invite-form";

export default async function UsuariosPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profileRes = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user!.id)
    .single();

  const profile = profileRes.data as { organization_id: string } | null;

  const organizationId = profile!.organization_id;

  const rolesRes = await supabase.from("roles").select("id, name").order("name");
  const unitsRes = await supabase.from("units").select("id, name").eq("active", true).order("name");
  const profilesRes = await supabase
    .from("profiles")
    .select("id, full_name, active, roles(name), units:primary_unit_id(name)")
    .order("full_name");
  const invitesRes = await supabase
    .from("invites")
    .select("id, email, status, expires_at, roles(name)")
    .order("created_at", { ascending: false });

  type ProfileRow = {
    id: string;
    full_name: string;
    active: boolean;
    roles: { name: string } | null;
    units: { name: string } | null;
  };
  type InviteRow = {
    id: string;
    email: string;
    status: string;
    expires_at: string;
    roles: { name: string } | null;
  };

  const profiles = (profilesRes.data ?? []) as unknown as ProfileRow[];
  const invites = (invitesRes.data ?? []) as unknown as InviteRow[];  return (
    <div>
      <h2 className="mb-6 font-display font-semibold text-2xl text-foreground">Usuários</h2>

      <NewInviteForm organizationId={organizationId} roles={rolesRes.data ?? []} units={unitsRes.data ?? []} />

      <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">Equipe</h3>
      <div className="mb-8 overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Papel</th>
              <th className="px-4 py-3">Unidade</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-4 py-3">{p.full_name}</td>
                <td className="px-4 py-3">{p.roles?.name}</td>
                <td className="px-4 py-3">{p.units?.name ?? "-"}</td>
                <td className="px-4 py-3">{p.active ? "Ativo" : "Inativo"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
        Convites pendentes
      </h3>
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">E-mail</th>
              <th className="px-4 py-3">Papel</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Expira em</th>
            </tr>
          </thead>
          <tbody>
            {invites.map((i) => (
              <tr key={i.id} className="border-t border-border">
                <td className="px-4 py-3">{i.email}</td>
                <td className="px-4 py-3">{i.roles?.name}</td>
                <td className="px-4 py-3">{i.status}</td>
                <td className="px-4 py-3">
                  {new Date(i.expires_at).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                </td>
              </tr>
            ))}
            {invites.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhum convite gerado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
