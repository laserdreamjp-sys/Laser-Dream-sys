import { createClient } from "@/lib/supabase/server";
import { NewBudgetForm } from "@/components/new-budget-form";

export default async function NovoOrcamentoPage({
  searchParams,
}: {
  searchParams: { opportunityId?: string; clientId?: string; sellerId?: string };
}) {
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

  const clientsRes = await supabase.from("clients").select("id, name").order("name");
  const sellersRes = await supabase.from("sellers").select("id, name, unit_id").eq("active", true).order("name");
  const proceduresRes = await supabase
    .from("procedures")
    .select("id, name, segment")
    .eq("active", true)
    .not("segment", "is", null)
    .order("name");
  const areasRes = await supabase
    .from("procedure_areas")
    .select("id, name, group_label, procedure_id, segment")
    .eq("active", true)
    .order("name");
  const paymentMethodsRes = await supabase
    .from("payment_methods")
    .select("id, name")
    .eq("active", true)
    .order("name");

  return (
    <div>
      <h2 className="mb-2 font-display font-semibold text-2xl text-foreground">Novo orçamento</h2>
      <p className="mb-6 text-sm text-muted-foreground">
        Não é uma venda — fica registrado no cadastro do cliente e no lead do funil (se vier de um), até virar venda de verdade.
      </p>
      <NewBudgetForm
        organizationId={profile!.organization_id}
        clients={clientsRes.data ?? []}
        sellers={sellersRes.data ?? []}
        procedures={(proceduresRes.data ?? []) as never}
        areas={areasRes.data ?? []}
        paymentMethods={paymentMethodsRes.data ?? []}
        opportunityId={searchParams.opportunityId}
        initialClientId={searchParams.clientId}
        initialSellerId={searchParams.sellerId}
      />
    </div>
  );
}
