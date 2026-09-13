import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";
import { FunilBoard } from "@/components/funil-board";
import { NewOpportunityButton } from "@/components/new-opportunity-button";

export default async function FunilPage() {
  const supabase = createClient();
  const { organizationId } = await getCurrentProfile();

  const [stagesRes, opportunitiesRes, clientsRes, sellersRes, lossReasonsRes, unitsRes] =
    await Promise.all([
      supabase.from("pipeline_stages").select("*").order("position"),
      supabase
        .from("opportunities")
        .select(
          "id, client_id, stage_id, seller_id, estimated_value, notes, sale_id, loss_reason_id, unit_id, created_at, clients(name), sellers(name)"
        )
        .order("created_at", { ascending: false }),
      supabase.from("clients").select("id, name").order("name"),
      supabase.from("sellers").select("id, name, unit_id").eq("active", true).order("name"),
      supabase.from("loss_reasons").select("id, name").eq("active", true).order("name"),
      supabase.from("units").select("id, name").eq("active", true).order("name"),
    ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-semibold text-2xl text-foreground">Funil de vendas</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Da oportunidade até a venda fechada. Ganhar aqui não lança receita sozinho: você
            registra a venda de verdade a partir do card.
          </p>
        </div>
        <NewOpportunityButton
          clients={clientsRes.data ?? []}
          sellers={sellersRes.data ?? []}
          units={unitsRes.data ?? []}
          firstStageId={stagesRes.data?.[0]?.id ?? ""}
          organizationId={organizationId}
        />
      </div>

      <FunilBoard
        stages={stagesRes.data ?? []}
        opportunities={(opportunitiesRes.data ?? []) as never}
        lossReasons={lossReasonsRes.data ?? []}
      />
    </div>
  );
}
