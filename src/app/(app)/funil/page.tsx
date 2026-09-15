import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";
import { FunilBoard } from "@/components/funil-board";
import { NewOpportunityButton } from "@/components/new-opportunity-button";
import { FunilUserFilter } from "@/components/funil-user-filter";
import { ColumnFilter } from "@/components/column-filter";

export default async function FunilPage({
  searchParams,
}: {
  searchParams: {
    funil?: string;
    usuario?: string;
    etiqueta?: string;
    origem?: string;
    vendedor?: string;
    atrasadas?: string;
  };
}) {
  const supabase = createClient();
  const { organizationId, userId, isAdmin, isManager } = await getCurrentProfile();
  const podeVerTodos = isAdmin || isManager;

  const funnelsRes = await supabase.from("funnels").select("id, name, position").eq("active", true).order("position");
  const funnels = funnelsRes.data ?? [];
  const selectedFunnelId = searchParams.funil ?? funnels[0]?.id ?? "";

  const [stagesRes, unitsRes, sellersRes, lossReasonsRes, usuariosRes, tagsRes, originsRes, proceduresRes, areasRes] =
    await Promise.all([
      supabase.from("pipeline_stages").select("*").eq("funnel_id", selectedFunnelId).order("position"),
      supabase.from("units").select("id, name").eq("active", true).order("name"),
      supabase.from("sellers").select("id, name, unit_id").eq("active", true).order("name"),
      supabase.from("loss_reasons").select("id, name").eq("active", true).order("name"),
      podeVerTodos
        ? supabase.from("profiles").select("id, full_name").eq("active", true).order("full_name")
        : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
      supabase.from("tags").select("id, name, color").order("name"),
      supabase.from("lead_origins").select("id, name").order("name"),
      supabase.from("procedures").select("id, name, segment").order("name"),
      supabase.from("procedure_areas").select("id, name, group_label, procedure_id, segment").eq("active", true).order("name"),
    ]);

  const stages = stagesRes.data ?? [];
  const stageIds = stages.map((s) => s.id);

  // filtros que exigem resolver ids de oportunidade antes (etiqueta e tarefa atrasada)
  const etiquetasFiltro = (searchParams.etiqueta ?? "").split(",").filter(Boolean);
  const origensFiltro = (searchParams.origem ?? "").split(",").filter(Boolean);
  const vendedoresFiltro = (searchParams.vendedor ?? "").split(",").filter(Boolean);
  const soAtrasadas = searchParams.atrasadas === "1";

  let idsPermitidosRaw: unknown = null;

  if (etiquetasFiltro.length > 0) {
    const { data } = await supabase.from("opportunity_tags").select("opportunity_id").in("tag_id", etiquetasFiltro);
    const ids: string[] = Array.from(new Set(((data ?? []) as { opportunity_id: string }[]).map((r) => r.opportunity_id)));
    const base = idsPermitidosRaw as string[] | null;
    idsPermitidosRaw = base === null ? ids : base.filter((id) => ids.includes(id));
  }

  if (soAtrasadas) {
    const hojeStr = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from("opportunity_tasks")
      .select("opportunity_id")
      .eq("done", false)
      .lt("due_date", hojeStr);
    const ids: string[] = Array.from(new Set(((data ?? []) as { opportunity_id: string }[]).map((r) => r.opportunity_id)));
    const base = idsPermitidosRaw as string[] | null;
    idsPermitidosRaw = base === null ? ids : base.filter((id) => ids.includes(id));
  }

  const idsPermitidosFinal = idsPermitidosRaw as string[] | null;

  let opportunitiesQuery = supabase
    .from("opportunities")
    .select(
      "id, client_id, stage_id, seller_id, estimated_value, notes, sale_id, loss_reason_id, unit_id, created_by, created_at, lead_origin_id, referred_by_name, interesse_procedure_id, clients(name), sellers(name)"
    )
    .in("stage_id", stageIds.length > 0 ? stageIds : ["00000000-0000-0000-0000-000000000000"])
    .order("created_at", { ascending: false });

  if (podeVerTodos && searchParams.usuario) {
    opportunitiesQuery = opportunitiesQuery.eq("created_by", searchParams.usuario);
  }
  if (origensFiltro.length > 0) opportunitiesQuery = opportunitiesQuery.in("lead_origin_id", origensFiltro);
  if (vendedoresFiltro.length > 0) opportunitiesQuery = opportunitiesQuery.in("seller_id", vendedoresFiltro);
  if (idsPermitidosFinal !== null) {
    opportunitiesQuery = opportunitiesQuery.in(
      "id",
      idsPermitidosFinal.length > 0 ? idsPermitidosFinal : ["00000000-0000-0000-0000-000000000000"]
    );
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
    lead_origin_id: string | null;
    referred_by_name: string | null;
    interesse_procedure_id: string | null;
    clients: { name: string } | null;
    sellers: { name: string } | null;
  }[];

  const opportunityIds = opportunities.map((o) => o.id);

  const notesByOpportunity: Record<
    string,
    { id: string; content: string; created_at: string; author_id: string | null; author_name?: string }[]
  > = {};
  const tagsByOpportunity: Record<string, { id: string; name: string; color: string }[]> = {};
  const tasksByOpportunity: Record<
    string,
    { id: string; title: string; due_date: string | null; done: boolean; assigned_to: string | null; assigned_name?: string }[]
  > = {};
  const interestAreasByOpportunity: Record<string, string[]> = {};

  if (opportunityIds.length > 0) {
    const [notesRaw, tagsRaw, tasksRaw, interestAreasRaw] = await Promise.all([
      supabase
        .from("opportunity_notes")
        .select("id, opportunity_id, content, created_at, author_id, profiles(full_name)")
        .in("opportunity_id", opportunityIds)
        .order("created_at", { ascending: true }),
      supabase
        .from("opportunity_tags")
        .select("opportunity_id, tags(id, name, color)")
        .in("opportunity_id", opportunityIds),
      supabase
        .from("opportunity_tasks")
        .select("id, opportunity_id, title, due_date, done, assigned_to, profiles(full_name)")
        .in("opportunity_id", opportunityIds)
        .order("due_date", { ascending: true, nullsFirst: false }),
      supabase.from("opportunity_interest_areas").select("opportunity_id, area_id").in("opportunity_id", opportunityIds),
    ]);

    for (const n of (notesRaw.data ?? []) as unknown as {
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

    for (const t of (tagsRaw.data ?? []) as unknown as {
      opportunity_id: string;
      tags: { id: string; name: string; color: string } | null;
    }[]) {
      if (!t.tags) continue;
      const list = tagsByOpportunity[t.opportunity_id] ?? [];
      list.push(t.tags);
      tagsByOpportunity[t.opportunity_id] = list;
    }

    for (const tk of (tasksRaw.data ?? []) as unknown as {
      id: string;
      opportunity_id: string;
      title: string;
      due_date: string | null;
      done: boolean;
      assigned_to: string | null;
      profiles: { full_name: string } | null;
    }[]) {
      const list = tasksByOpportunity[tk.opportunity_id] ?? [];
      list.push({
        id: tk.id,
        title: tk.title,
        due_date: tk.due_date,
        done: tk.done,
        assigned_to: tk.assigned_to,
        assigned_name: tk.profiles?.full_name,
      });
      tasksByOpportunity[tk.opportunity_id] = list;
    }

    for (const ia of (interestAreasRaw.data ?? []) as { opportunity_id: string; area_id: string }[]) {
      const list = interestAreasByOpportunity[ia.opportunity_id] ?? [];
      list.push(ia.area_id);
      interestAreasByOpportunity[ia.opportunity_id] = list;
    }
  }

  const currentParams = Object.fromEntries(Object.entries(searchParams).filter(([, v]) => v)) as Record<string, string>;
  const baseParams = { ...currentParams };
  delete baseParams.etiqueta;
  delete baseParams.origem;
  delete baseParams.vendedor;
  delete baseParams.atrasadas;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-semibold text-2xl text-foreground">Funil</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Arraste o card para outra coluna, ou clique nele para ver o histórico completo do lead.
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
            const params = new URLSearchParams(baseParams);
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

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface p-3">
        <span className="text-xs font-medium text-muted-foreground">Filtrar:</span>
        <div className="w-40">
          <ColumnFilter
            label="Etiqueta"
            paramName="etiqueta"
            options={(tagsRes.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
            currentParams={{ ...currentParams, funil: selectedFunnelId }}
          />
        </div>
        <div className="w-40">
          <ColumnFilter
            label="Origem"
            paramName="origem"
            options={(originsRes.data ?? []).map((o) => ({ value: o.id, label: o.name }))}
            currentParams={{ ...currentParams, funil: selectedFunnelId }}
          />
        </div>
        <div className="w-40">
          <ColumnFilter
            label="Vendedor(a)"
            paramName="vendedor"
            options={(sellersRes.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
            currentParams={{ ...currentParams, funil: selectedFunnelId }}
          />
        </div>
        <Link
          href={`/funil?${new URLSearchParams({ ...baseParams, funil: selectedFunnelId, atrasadas: soAtrasadas ? "" : "1" }).toString()}`}
          className={`rounded-md border px-2 py-1.5 text-xs ${
            soAtrasadas
              ? "border-destructive bg-destructive/10 text-destructive"
              : "border-border text-foreground hover:bg-muted"
          }`}
        >
          Com tarefa atrasada
        </Link>
        {(etiquetasFiltro.length > 0 || origensFiltro.length > 0 || vendedoresFiltro.length > 0 || soAtrasadas) && (
          <Link
            href={`/funil?${new URLSearchParams({ ...baseParams, funil: selectedFunnelId }).toString()}`}
            className="text-xs text-muted-foreground underline"
          >
            Limpar filtros
          </Link>
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
          tagsByOpportunity={tagsByOpportunity}
          tasksByOpportunity={tasksByOpportunity}
          interestAreasByOpportunity={interestAreasByOpportunity}
          currentUserId={userId}
          organizationId={organizationId}
          allTags={tagsRes.data ?? []}
          origins={originsRes.data ?? []}
          procedures={proceduresRes.data ?? []}
          areas={areasRes.data ?? []}
          sellers={sellersRes.data ?? []}
        />
      )}
    </div>
  );
}
