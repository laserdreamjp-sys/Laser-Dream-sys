import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

const ORGANIZATION_ID = "00000000-0000-0000-0000-000000000001";

type Opp = {
  id: string;
  created_at: string;
  data_avaliacao: string | null;
  stage_id: string;
};
type Stage = { id: string; is_won: boolean; is_lost: boolean };
type Note = { opportunity_id: string; created_at: string };
type Task = { opportunity_id: string; auto_rule: string | null; done: boolean };

function diffDias(de: string, ate: Date) {
  return (ate.getTime() - new Date(de).getTime()) / (1000 * 60 * 60 * 24);
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const supabase = createServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY não configurada." }, { status: 500 });
  }

  const agora = new Date();
  const criadas: { opportunity_id: string; regra: string }[] = [];

  // ===== dados base =====
  const stagesRes = await supabase.from("pipeline_stages").select("id, is_won, is_lost").eq("organization_id", ORGANIZATION_ID);
  const stages = (stagesRes.data ?? []) as Stage[];
  const stageAberta = new Map(stages.map((s) => [s.id, !s.is_won && !s.is_lost]));
  const stageInfo = new Map(stages.map((s) => [s.id, s]));

  const oppsRes = await supabase
    .from("opportunities")
    .select("id, created_at, data_avaliacao, stage_id")
    .eq("organization_id", ORGANIZATION_ID);
  const allOpps = (oppsRes.data ?? []) as Opp[];
  const oppsAbertas = allOpps.filter((o) => stageAberta.get(o.stage_id));
  const oppIds = allOpps.map((o) => o.id);

  const notesRes =
    oppIds.length > 0
      ? await supabase.from("opportunity_notes").select("opportunity_id, created_at").in("opportunity_id", oppIds)
      : { data: [] as Note[] };
  const notes = (notesRes.data ?? []) as Note[];
  const ultimaNotaPorOpp = new Map<string, string>();
  for (const n of notes) {
    const atual = ultimaNotaPorOpp.get(n.opportunity_id);
    if (!atual || n.created_at > atual) ultimaNotaPorOpp.set(n.opportunity_id, n.created_at);
  }

  const tasksAbertasRes =
    oppIds.length > 0
      ? await supabase.from("opportunity_tasks").select("opportunity_id, auto_rule, done").in("opportunity_id", oppIds).eq("done", false)
      : { data: [] as Task[] };
  const tasksAbertas = (tasksAbertasRes.data ?? []) as Task[];
  function temTarefaAberta(oppId: string, regra: string) {
    return tasksAbertas.some((t) => t.opportunity_id === oppId && t.auto_rule === regra);
  }

  async function criarTarefa(opportunityId: string, title: string, dueDate: string, regra: string) {
    await supabase!.from("opportunity_tasks").insert({
      organization_id: ORGANIZATION_ID,
      opportunity_id: opportunityId,
      title,
      due_date: dueDate,
      auto_rule: regra,
    });
    criadas.push({ opportunity_id: opportunityId, regra });
  }

  // ===== regra 2: confirmacao de avaliacao marcada para amanha =====
  const amanha = new Date(agora);
  amanha.setDate(amanha.getDate() + 1);
  const amanhaStr = amanha.toISOString().slice(0, 10);
  for (const o of oppsAbertas) {
    if (!o.data_avaliacao) continue;
    const dataAval = o.data_avaliacao.slice(0, 10);
    if (dataAval !== amanhaStr) continue;
    if (temTarefaAberta(o.id, "confirmar_avaliacao")) continue;
    await criarTarefa(o.id, "Confirmar avaliação marcada para amanhã", agora.toISOString().slice(0, 10), "confirmar_avaliacao");
  }

  // ===== sequencia de follow-up: comeca 1 dia depois de ENTRAR na etapa "Em contato"
  // (nao de quando o lead foi criado), e dali o gatilho do banco cuida do resto
  // (2 em 2 dias, so avanca quando o usuario confirma; no 5 sem resposta, move para Nutricao) =====
  // busco os nomes das etapas numa consulta separada (a consulta principal so trouxe id/is_won/is_lost)
  const stageNamesRes = await supabase.from("pipeline_stages").select("id, name").eq("organization_id", ORGANIZATION_ID);
  const nomePorStage = new Map(((stageNamesRes.data ?? []) as { id: string; name: string }[]).map((s) => [s.id, s.name]));

  const eventsRes =
    oppIds.length > 0
      ? await supabase
          .from("opportunity_events")
          .select("opportunity_id, to_stage_id, created_at")
          .in("opportunity_id", oppIds)
          .order("created_at", { ascending: false })
      : { data: [] as { opportunity_id: string; to_stage_id: string; created_at: string }[] };
  const entradaNaEtapaAtual = new Map<string, string>();
  for (const e of (eventsRes.data ?? []) as { opportunity_id: string; to_stage_id: string; created_at: string }[]) {
    if (!entradaNaEtapaAtual.has(e.opportunity_id)) entradaNaEtapaAtual.set(e.opportunity_id, e.created_at);
  }

  const followupTagsRes = await supabase
    .from("tags")
    .select("id, name")
    .eq("organization_id", ORGANIZATION_ID)
    .like("name", "Follow-up %");
  const followupTagIds = new Set(((followupTagsRes.data ?? []) as { id: string; name: string }[]).map((t) => t.id));

  const oppTagsRes =
    oppIds.length > 0
      ? await supabase.from("opportunity_tags").select("opportunity_id, tag_id").in("opportunity_id", oppIds)
      : { data: [] as { opportunity_id: string; tag_id: string }[] };
  const oppsComFollowupTag = new Set(
    ((oppTagsRes.data ?? []) as { opportunity_id: string; tag_id: string }[])
      .filter((t) => followupTagIds.has(t.tag_id))
      .map((t) => t.opportunity_id)
  );

  for (const o of oppsAbertas) {
    if (nomePorStage.get(o.stage_id) !== "Em contato") continue;
    if (oppsComFollowupTag.has(o.id)) continue; // sequencia ja comecou, o gatilho cuida do resto
    const entrou = entradaNaEtapaAtual.get(o.id) ?? o.created_at;
    if (diffDias(entrou, agora) < 1) continue;
    if (temTarefaAberta(o.id, "followup_confirmar_1")) continue;
    await criarTarefa(
      o.id,
      "Confirmar follow-up 1 — você entrou em contato de novo?",
      agora.toISOString().slice(0, 10),
      "followup_confirmar_1"
    );
  }

  // ===== bonus: reativacao 30 dias apos perder por "Sumiu" =====
  const perdidosRes = await supabase
    .from("opportunities")
    .select("id, updated_at, stage_id, loss_reasons(name)")
    .eq("organization_id", ORGANIZATION_ID)
    .not("loss_reason_id", "is", null);
  const perdidos = (perdidosRes.data ?? []) as unknown as {
    id: string;
    updated_at: string;
    stage_id: string;
    loss_reasons: { name: string } | null;
  }[];
  for (const o of perdidos) {
    const stage = stageInfo.get(o.stage_id);
    if (!stage?.is_lost) continue;
    if (o.loss_reasons?.name !== "Sumiu") continue;
    if (diffDias(o.updated_at, agora) < 30) continue;
    if (temTarefaAberta(o.id, "reativacao_sumiu")) continue;
    await criarTarefa(o.id, "Tentar reativar — sumiu há 30 dias, vale uma nova tentativa", agora.toISOString().slice(0, 10), "reativacao_sumiu");
  }

  // ===== bonus: lead esfriando (7+ dias sem nenhuma atividade) ganha a etiqueta "Aguardando decisão" =====
  const tagRes = await supabase.from("tags").select("id").eq("organization_id", ORGANIZATION_ID).eq("name", "Aguardando decisão").maybeSingle();
  const tagEsfriandoId = tagRes.data?.id as string | undefined;
  let etiquetados = 0;
  if (tagEsfriandoId) {
    const tagsAtuaisRes =
      oppIds.length > 0
        ? await supabase.from("opportunity_tags").select("opportunity_id").eq("tag_id", tagEsfriandoId).in("opportunity_id", oppIds)
        : { data: [] as { opportunity_id: string }[] };
    const jaTemTag = new Set((tagsAtuaisRes.data ?? []).map((r) => r.opportunity_id));
    for (const o of oppsAbertas) {
      if (jaTemTag.has(o.id)) continue;
      const ultimaAtividade = ultimaNotaPorOpp.get(o.id) ?? o.created_at;
      if (diffDias(ultimaAtividade, agora) < 7) continue;
      await supabase.from("opportunity_tags").insert({ opportunity_id: o.id, tag_id: tagEsfriandoId });
      etiquetados++;
    }
  }

  return NextResponse.json({
    ok: true,
    tarefas_criadas: criadas.length,
    detalhe: criadas,
    leads_etiquetados_esfriando: etiquetados,
  });
}
