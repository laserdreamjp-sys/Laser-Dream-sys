import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

function pct(n: number, total: number) {
  return total === 0 ? "0%" : `${Math.round((n / total) * 100)}%`;
}

export default async function RelatoriosFunilPage() {
  const supabase = createClient();

  const [opportunitiesRes, originsRes, lossReasonsRes, stagesRes, eventsRes, sellersRes, tagsRes, oppTagsRes] =
    await Promise.all([
      supabase
        .from("opportunities")
        .select("id, stage_id, seller_id, sale_id, lead_origin_id, loss_reason_id, created_at, sellers(name)"),
      supabase.from("lead_origins").select("id, name"),
      supabase.from("loss_reasons").select("id, name"),
      supabase.from("pipeline_stages").select("id, name, is_won, is_lost, funnel_id, funnels(name)"),
      supabase.from("opportunity_events").select("opportunity_id, to_stage_id, created_at").order("created_at"),
      supabase.from("sellers").select("id, name").eq("active", true),
      supabase.from("tags").select("id, name").like("name", "Follow-up %"),
      supabase.from("opportunity_tags").select("opportunity_id, tag_id"),
    ]);

  type Opp = {
    id: string;
    stage_id: string;
    seller_id: string | null;
    sale_id: string | null;
    lead_origin_id: string | null;
    loss_reason_id: string | null;
    created_at: string;
    sellers: { name: string } | null;
  };
  const opportunities = (opportunitiesRes.data ?? []) as unknown as Opp[];
  const origins = (originsRes.data ?? []) as { id: string; name: string }[];
  const lossReasons = (lossReasonsRes.data ?? []) as { id: string; name: string }[];
  const stages = (stagesRes.data ?? []) as unknown as {
    id: string;
    name: string;
    is_won: boolean;
    is_lost: boolean;
    funnel_id: string;
    funnels: { name: string } | null;
  }[];
  const stageById = new Map(stages.map((s) => [s.id, s]));

  // ===== 1. funil por origem: entrada x conversao =====
  const porOrigem = origins.map((o) => {
    const leads = opportunities.filter((op) => op.lead_origin_id === o.id);
    const convertidos = leads.filter((op) => op.sale_id);
    return { nome: o.name, leads: leads.length, convertidos: convertidos.length };
  });
  const semOrigem = opportunities.filter((op) => !op.lead_origin_id);
  if (semOrigem.length > 0) {
    porOrigem.push({
      nome: "Sem origem definida",
      leads: semOrigem.length,
      convertidos: semOrigem.filter((op) => op.sale_id).length,
    });
  }
  porOrigem.sort((a, b) => b.leads - a.leads);

  // ===== 2. motivos de perda =====
  const perdidos = opportunities.filter((op) => stageById.get(op.stage_id)?.is_lost);
  const porMotivo = lossReasons
    .map((r) => ({ nome: r.name, qtd: perdidos.filter((op) => op.loss_reason_id === r.id).length }))
    .filter((r) => r.qtd > 0)
    .sort((a, b) => b.qtd - a.qtd);
  const perdidosSemMotivo = perdidos.filter((op) => !op.loss_reason_id).length;

  // ===== 3. tempo medio em cada etapa (baseado em opportunity_events) =====
  type Ev = { opportunity_id: string; to_stage_id: string; created_at: string };
  const events = (eventsRes.data ?? []) as Ev[];
  const eventosPorOpp = new Map<string, Ev[]>();
  for (const e of events) {
    const list = eventosPorOpp.get(e.opportunity_id) ?? [];
    list.push(e);
    eventosPorOpp.set(e.opportunity_id, list);
  }
  const temposPorEtapa = new Map<string, number[]>();
  for (const [, evs] of eventosPorOpp) {
    for (let i = 0; i < evs.length; i++) {
      const inicio = new Date(evs[i].created_at).getTime();
      const fim = i + 1 < evs.length ? new Date(evs[i + 1].created_at).getTime() : Date.now();
      const dias = (fim - inicio) / (1000 * 60 * 60 * 24);
      const lista = temposPorEtapa.get(evs[i].to_stage_id) ?? [];
      lista.push(dias);
      temposPorEtapa.set(evs[i].to_stage_id, lista);
    }
  }
  const tempoMedioPorEtapa = Array.from(temposPorEtapa.entries())
    .map(([stageId, tempos]) => ({
      etapa: stageById.get(stageId)?.name ?? "?",
      funil: stageById.get(stageId)?.funnels?.name ?? "?",
      mediaDias: tempos.reduce((a, b) => a + b, 0) / tempos.length,
      qtd: tempos.length,
    }))
    .sort((a, b) => b.mediaDias - a.mediaDias);

  // ===== 4. eficacia do follow-up: quantos confirmaram cada etapa vs quantos "morreram" sem responder =====
  const followupTags = (tagsRes.data ?? []) as { id: string; name: string }[];
  const oppTags = (oppTagsRes.data ?? []) as { opportunity_id: string; tag_id: string }[];
  const porFollowup = followupTags
    .map((t) => ({
      nome: t.name,
      qtd: new Set(oppTags.filter((ot) => ot.tag_id === t.id).map((ot) => ot.opportunity_id)).size,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
  const emNutricao = stages.filter((s) => s.name === "Nutrição");
  const totalNutricao = opportunities.filter((op) => emNutricao.some((s) => s.id === op.stage_id)).length;

  // ===== 5. conversao por vendedora =====
  const porVendedora = (sellersRes.data ?? [])
    .map((s: { id: string; name: string }) => {
      const leads = opportunities.filter((op) => op.seller_id === s.id);
      const convertidos = leads.filter((op) => op.sale_id);
      return { nome: s.name, leads: leads.length, convertidos: convertidos.length };
    })
    .filter((v) => v.leads > 0)
    .sort((a, b) => b.convertidos / (b.leads || 1) - a.convertidos / (a.leads || 1));

  return (
    <div className="space-y-8">
      <div>
        <Link href="/relatorios" className="text-sm text-muted-foreground hover:underline">
          ← Relatórios
        </Link>
        <h2 className="mt-1 font-display font-semibold text-2xl text-foreground">Relatórios do funil</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Onde os leads entram, onde travam, e o que faz eles virar venda ou sumir.
        </p>
      </div>

      <section className="rounded-lg border border-border bg-surface p-5">
        <p className="mb-3 text-sm font-medium text-foreground">1 · Origem: quem traz mais lead x quem converte mais</p>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="pb-2">Origem</th>
              <th className="pb-2 text-right">Leads</th>
              <th className="pb-2 text-right">Convertidos</th>
              <th className="pb-2 text-right">Taxa</th>
            </tr>
          </thead>
          <tbody>
            {porOrigem.map((o) => (
              <tr key={o.nome} className="border-t border-border">
                <td className="py-2 text-foreground">{o.nome}</td>
                <td className="py-2 text-right">{o.leads}</td>
                <td className="py-2 text-right">{o.convertidos}</td>
                <td className="py-2 text-right font-medium text-gold-700">{pct(o.convertidos, o.leads)}</td>
              </tr>
            ))}
            {porOrigem.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-muted-foreground">Sem dados ainda.</td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-muted-foreground">
          A origem que mais traz volume nem sempre é a que mais converte — vale olhar as duas colunas juntas antes de decidir onde investir.
        </p>
      </section>

      <section className="rounded-lg border border-border bg-surface p-5">
        <p className="mb-3 text-sm font-medium text-foreground">2 · Por que estamos perdendo lead</p>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="pb-2">Motivo</th>
              <th className="pb-2 text-right">Quantidade</th>
              <th className="pb-2 text-right">% dos perdidos</th>
            </tr>
          </thead>
          <tbody>
            {porMotivo.map((m) => (
              <tr key={m.nome} className="border-t border-border">
                <td className="py-2 text-foreground">{m.nome}</td>
                <td className="py-2 text-right">{m.qtd}</td>
                <td className="py-2 text-right">{pct(m.qtd, perdidos.length)}</td>
              </tr>
            ))}
            {perdidosSemMotivo > 0 && (
              <tr className="border-t border-border">
                <td className="py-2 text-muted-foreground">Sem motivo registrado</td>
                <td className="py-2 text-right">{perdidosSemMotivo}</td>
                <td className="py-2 text-right">{pct(perdidosSemMotivo, perdidos.length)}</td>
              </tr>
            )}
            {perdidos.length === 0 && (
              <tr>
                <td colSpan={3} className="py-6 text-center text-muted-foreground">Nenhum lead perdido ainda.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="rounded-lg border border-border bg-surface p-5">
        <p className="mb-3 text-sm font-medium text-foreground">3 · Onde o lead trava (tempo médio parado em cada etapa)</p>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="pb-2">Etapa</th>
              <th className="pb-2">Funil</th>
              <th className="pb-2 text-right">Tempo médio</th>
              <th className="pb-2 text-right">Passagens</th>
            </tr>
          </thead>
          <tbody>
            {tempoMedioPorEtapa.map((t) => (
              <tr key={t.etapa + t.funil} className="border-t border-border">
                <td className="py-2 text-foreground">{t.etapa}</td>
                <td className="py-2 text-muted-foreground">{t.funil}</td>
                <td className="py-2 text-right font-medium text-foreground">
                  {t.mediaDias < 1 ? "< 1 dia" : `${t.mediaDias.toFixed(1)} dias`}
                </td>
                <td className="py-2 text-right text-muted-foreground">{t.qtd}</td>
              </tr>
            ))}
            {tempoMedioPorEtapa.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-muted-foreground">
                  Ainda sem histórico de movimentação suficiente.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-muted-foreground">
          A etapa com o maior tempo médio é onde o lead mais demora a sair — geralmente o melhor lugar pra investigar antes de mexer em qualquer outra coisa do funil.
        </p>
      </section>

      <section className="rounded-lg border border-border bg-surface p-5">
        <p className="mb-3 text-sm font-medium text-foreground">4 · Até onde o follow-up consegue segurar o lead</p>
        <div className="flex flex-wrap items-end gap-4">
          {porFollowup.map((f) => (
            <div key={f.nome} className="text-center">
              <p className="text-2xl font-semibold text-foreground">{f.qtd}</p>
              <p className="text-xs text-muted-foreground">{f.nome}</p>
            </div>
          ))}
          <div className="text-center">
            <p className="text-2xl font-semibold text-destructive">{totalNutricao}</p>
            <p className="text-xs text-muted-foreground">Foram pra Nutrição</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Cada número mostra quantos leads chegaram a confirmar aquele follow-up. Se o número cai muito rápido do 1 pro 2, o problema está bem no início do contato, não na insistência.
        </p>
      </section>

      <section className="rounded-lg border border-border bg-surface p-5">
        <p className="mb-3 text-sm font-medium text-foreground">5 · Conversão por vendedora (não só valor — taxa de fechamento)</p>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="pb-2">Vendedora</th>
              <th className="pb-2 text-right">Leads</th>
              <th className="pb-2 text-right">Convertidos</th>
              <th className="pb-2 text-right">Taxa</th>
            </tr>
          </thead>
          <tbody>
            {porVendedora.map((v) => (
              <tr key={v.nome} className="border-t border-border">
                <td className="py-2 text-foreground">{v.nome}</td>
                <td className="py-2 text-right">{v.leads}</td>
                <td className="py-2 text-right">{v.convertidos}</td>
                <td className="py-2 text-right font-medium text-gold-700">{pct(v.convertidos, v.leads)}</td>
              </tr>
            ))}
            {porVendedora.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-muted-foreground">Sem leads atribuídos ainda.</td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-muted-foreground">
          Quem vende mais em valor não é sempre quem converte mais em proporção — essa coluna de taxa mostra quem está desperdiçando menos lead.
        </p>
      </section>
    </div>
  );
}
