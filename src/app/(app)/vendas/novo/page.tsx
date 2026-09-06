import { createClient } from "@/lib/supabase/server";
import { NewSaleForm } from "@/components/new-sale-form";

export default async function NovaVendaPage() {
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

  const unitsRes = await supabase.from("units").select("id, name").eq("active", true).order("name");
  const clientsRes = await supabase.from("clients").select("id, name").order("name");
  const proceduresRes = await supabase
    .from("procedures")
    .select("id, name")
    .eq("active", true)
    .order("name");
  const packagesRes = await supabase
    .from("packages")
    .select("id, name")
    .eq("active", true)
    .order("name");

  return (
    <div>
      <h2 className="mb-6 font-serif text-2xl text-ink-900">Nova venda</h2>
      <NewSaleForm
        organizationId={profile!.organization_id}
        userId={user!.id}
        units={unitsRes.data ?? []}
        clients={clientsRes.data ?? []}
        procedures={proceduresRes.data ?? []}
        packages={packagesRes.data ?? []}
      />
    </div>
  );
}
