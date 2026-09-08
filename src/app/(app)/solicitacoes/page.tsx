import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";
import { RequestActions, TABLE_LABELS, type ChangeRequest } from "@/components/request-actions";

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR");
}

export default async function SolicitacoesPage() {
  const supabase = createClient();
  const { userId, isAdmin } = await getCurrentProfile();

  if (!isAdmin) {
    const mineRes = await supabase
      .from("change_requests")
      .select("id, table_name, record_label, action, status, requested_at")
      .eq("requested_by", userId)
      .order("requested_at", { ascending: false })
      .limit(30);

    type MineRow = {
      id: string;
      table_name: string;
      record_label: string | null;
      action: string;
      status: string;
      requested_at: string;
    };
    const mine = (mineRes.data ?? []) as MineRow[];

    return (
      <div>
        <h2 className="mb-2 font-display font-semibold text-2xl text-foreground">Minhas solicitações</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Pedidos de alteração ou exclusão enviados ao administrador.
        </p>
        <ul className="divide-y divide-gold-50 rounded-lg border border-border bg-surface text-sm">
          {mine.map((req) => (
            <li key={req.id} className="flex items-center justify-between px-4 py-3">
              <span>
                {req.action === "delete" ? "Exclusão" : "Alteração"} de{" "}
                {TABLE_LABELS[req.table_name] ?? req.table_name}
                {req.record_label ? ` — ${req.record_label}` : ""}
              </span>
              <span
                className={
                  req.status === "aprovada"
                    ? "text-gold-700"
                    : req.status === "rejeitada"
                    ? "text-destructive"
                    : "text-muted-foreground"
                }
              >
                {req.status}
              </span>
            </li>
          ))}
          {mine.length === 0 && (
            <li className="px-4 py-8 text-center text-muted-foreground">Você ainda não fez nenhuma solicitação.</li>
          )}
        </ul>
      </div>
    );
  }

  const pendingRes = await supabase
    .from("change_requests")
    .select("id, table_name, record_id, record_label, action, payload, requested_at, profiles(full_name)")
    .eq("status", "pendente")
    .order("requested_at", { ascending: true });

  const resolvedRes = await supabase
    .from("change_requests")
    .select("id, table_name, record_id, record_label, action, status, requested_at, resolved_at, profiles!change_requests_requested_by_fkey(full_name)")
    .neq("status", "pendente")
    .order("resolved_at", { ascending: false })
    .limit(20);

  const pending = (pendingRes.data ?? []) as unknown as ChangeRequest[];

  type ResolvedRow = {
    id: string;
    table_name: string;
    record_label: string | null;
    action: string;
    status: string;
    requested_at: string;
    resolved_at: string;
    profiles: { full_name: string } | null;
  };
  const resolved = (resolvedRes.data ?? []) as unknown as ResolvedRow[];

  return (
    <div className="space-y-10">
      <div>
        <h2 className="font-display font-semibold text-2xl text-foreground">Solicitações</h2>
        <p className="text-sm text-muted-foreground">Alterações e exclusões pedidas pela equipe, aguardando aprovação.</p>
      </div>

      <section>
        <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">Pendentes</h3>
        <ul className="divide-y divide-gold-50 rounded-lg border border-border bg-surface text-sm">
          {pending.map((req) => (
            <li key={req.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="flex-1">
                <p className="text-foreground">
                  <span className="font-medium">{req.profiles?.full_name}</span> pediu{" "}
                  {req.action === "delete" ? "exclusão" : "alteração"} de{" "}
                  {TABLE_LABELS[req.table_name] ?? req.table_name}
                  {req.record_label ? ` — ${req.record_label}` : ""}
                </p>
                {req.action === "edit" && req.payload && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Novo(s) valor(es): {JSON.stringify(req.payload)}
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(req.requested_at)}</p>
              </div>
              <RequestActions request={req} userId={userId} />
            </li>
          ))}
          {pending.length === 0 && (
            <li className="px-4 py-8 text-center text-muted-foreground">Nenhuma solicitação pendente.</li>
          )}
        </ul>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">Histórico recente</h3>
        <ul className="divide-y divide-gold-50 rounded-lg border border-border bg-surface text-sm">
          {resolved.map((req) => (
            <li key={req.id} className="px-4 py-2">
              <span className="font-medium">{req.profiles?.full_name}</span> pediu{" "}
              {req.action === "delete" ? "exclusão" : "alteração"} de{" "}
              {TABLE_LABELS[req.table_name] ?? req.table_name}
              {req.record_label ? ` — ${req.record_label}` : ""} ·{" "}
              <span className={req.status === "aprovada" ? "text-gold-700" : "text-muted-foreground"}>
                {req.status}
              </span>{" "}
              em {formatDateTime(req.resolved_at)}
            </li>
          ))}
          {resolved.length === 0 && (
            <li className="px-4 py-6 text-center text-muted-foreground">Nenhum histórico ainda.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
