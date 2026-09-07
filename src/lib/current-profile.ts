import { createClient } from "@/lib/supabase/server";

export async function getCurrentProfile() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profileRaw } = await supabase
    .from("profiles")
    .select("organization_id, full_name, roles(name)")
    .eq("id", user!.id)
    .single();

  const profile = profileRaw as {
    organization_id: string;
    full_name: string;
    roles: { name: string } | null;
  } | null;

  const roleName = profile?.roles?.name ?? "";

  return {
    userId: user!.id,
    organizationId: profile!.organization_id,
    fullName: profile?.full_name ?? "",
    roleName,
    isAdmin: roleName === "Administrador",
  };
}
