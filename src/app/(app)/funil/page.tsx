import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";
import { FunilBoard } from "@/components/funil-board";
import { NewOpportunityButton } from "@/components/new-opportunity-button";
import { FunilUserFilter } from "@/components/funil-user-filter";

export default async function FunilPage({
  searchParams,
}: {
  searchParams: { funil?: string; usuario?: string };
}) {
  const supabase = createClient();
  const { organizationId, userId, isAdmin, isManager } = await getCurrentProfile();
  const podeVerTodos = isAdmin || isManager;

  const funnelsRes = await supabase.from("funnels").select("id, name, position").eq("active", true).order("position");
  const funnels = funnelsRes.data ?? [];
  const selectedFunnelId = searchParams.funil ?? funnels[0]?.id ?? "";

  const [stagesRes, unitsRes, sellersRes, lossReasonsRes, usuariosRes] = await Promise.all([
    supabase.from("pipeline_stages").select("*").eq("funnel_id", selectedFunnelId).order("position"),
    supabase.from("units").select("id, name").eq("active", true).order("name"),
    supabase.from("sellers").select("id, name, unit_id").eq("active", true).order("name"),
    supabase.from("loss_reasons").select("id, name").eq("active", true).order("name"),
    podeVerTodos
      ? supabase.from("profiles").select("id, full_name").eq("active", true).order("full_name")
      : Promise.resolve({ data: [] }),
  ]);

  const stages = stagesRes.data ?? [];
  const stageIds = stages.map((s) => s.id);

  let opportunitiesQuery = supabase
    .from("opportunities")
    .select(
      "id, client_id, stage_id, seller_id, estimated_value, notes, sale_id, loss_reason_id, unit_id, created_by, created_at, clients(name), sellers(name)"
    )
    .in("stage_id", stageIds.length > 0 ? stageIds : ["00000000-0000-0000-0000-000000000000"])
    .order("created_at", { ascending: false });

  if (podeVerTodos && searchParams.usuario) {
    opportunitiesQuery = opportunitiesQuery.eq("created_by", searchParams.usuario);
  }

  const opportunitiesRes = await opportunitiesQuery;
  const opportunities = (opportunitiesRes.data ?? []) as never as {
    id: string;
    client_id: string;
    stage_id: string;
    seller_id: string | null;
    estimated_value: number | null;
    notes: string | null;
    sale_id: string | null;
    loss_reason_id: string | null;
    clients: { name: string } | null;
    sellers: { name: string } | null;
  }[];

  const opportunityIds = opportunities.map((o) => o.id);
  const notesByOpportunity: Record<string, { id: string; content: string; created_at: string; author_id: string | null; author_name?: string }[]> = {};
  if (opportunityIds.length > 0) {
    const { data: notesRaw } = await supabase
      .from("opportunity_notes")
      .select("id, opportunity_id, content, created_at, author_id, profiles(full_name)")
      .in("opportunity_id", opportunityIds)
      .order("created_at", { ascending: true });

    for (const n of (notesRaw ?? []) as unknown as {
      id: string;
      opportunity_id: string;
      content: string;
      created_at: string;
      author_id: string | null;
      profiles: { full_name: string } | null;
    }[]) {
      const list = notesByOpportunity[n.opportunity_id] ?? [];
      list.push({
        id: n.id,
        content: n.content,
        created_at: n.created_at,
        author_id: n.author_id,
        author_name: n.profiles?.full_name,
      });
      notesByOpportunity[n.opportunity_id] = list;
    }
  }

  const currentFunilParams = new URLSearchParams();
  if (searchParams.usuario) currentFunilParams.set("usuario", searchParams.usuario);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-semibold text-2xl text-foreground">Funil</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Arraste o card para outra coluna, ou use o campo de anotações pra registrar o histórico do lead.
          </p>
        </div>
        <NewOpportunityButton
          sellers={sellersRes.data ?? []}
          units={unitsRes.data ?? []}
          firstStageId={stages[0]?.id ?? ""}
          organizationId={organizationId}
          currentUserId={userId}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {funnels.map((f) => {
            const params = new URLSearchParams(currentFunilParams);
            params.set("funil", f.id);
            return (
              <Link
                key={f.id}
                href={`/funil?${params.toString()}`}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                  f.id === selectedFunnelId
                    ? "bg-gold-500 text-white"
                    : "border border-border text-foreground hover:bg-muted"
                }`}
              >
                {f.name}
              </Link>
            );
          })}
          <Link
            href="/configuracoes"
            className="rounded-full border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
          >
            + Editar funis
          </Link>
        </div>

        {podeVerTodos && (
          <FunilUserFilter
            funnelId={selectedFunnelId}
            currentUsuario={searchParams.usuario ?? ""}
            usuarios={usuariosRes.data ?? []}
          />
        )}
      </div>

      {stages.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Esse funil ainda não tem etapas configuradas.
        </p>
      ) : (
        <FunilBoard
          stages={stages}
          opportunities={opportunities}
          lossReasons={lossReasonsRes.data ?? []}
          notesByOpportunity={notesByOpportunity}
          currentUserId={userId}
        />
      )}
    </div>
  );
}
