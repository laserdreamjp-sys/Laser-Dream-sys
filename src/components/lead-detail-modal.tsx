"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Tag = { id: string; name: string; color: string };
type Task = {
  id: string;
  title: string;
  due_date: string | null;
  done: boolean;
  assigned_to: string | null;
  assigned_name?: string;
};
type Note = { id: string; content: string; created_at: string; author_name?: string };
type Origin = { id: string; name: string };
type Procedure = { id: string; name: string; segment: string | null };
type Area = { id: string; name: string; group_label: string | null; procedure_id: string | null; segment: string | null };
type Seller = { id: string; name: string };

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function formatDate(value: string) {
  return new Date(value + "T00:00:00").toLocaleDateString("pt-BR");
}

export function LeadDetailModal({
  opportunityId,
  clientName,
  leadOriginId,
  referredByName,
  interesseProcedureId,
  dataAvaliacao,
  notes,
  tags,
  tasks,
  interestAreaIds,
  allTags,
  origins,
  procedures,
  areas,
  sellers,
  organizationId,
  currentUserId,
  onClose,
}: {
  opportunityId: string;
  clientName: string;
  leadOriginId: string | null;
  referredByName: string | null;
  interesseProcedureId: string | null;
  dataAvaliacao: string | null;
  notes: Note[];
  tags: Tag[];
  tasks: Task[];
  interestAreaIds: string[];
  allTags: Tag[];
  origins: Origin[];
  procedures: Procedure[];
  areas: Area[];
  sellers: Seller[];
  organizationId: string;
  currentUserId: string;
  onClose: () => void;
}) {
  const supabase = createClient();
  const router = useRouter();

  const [localOriginId, setLocalOriginId] = useState(leadOriginId ?? "");
  const [localReferredBy, setLocalReferredBy] = useState(referredByName ?? "");
  const [localProcedureId, setLocalProcedureId] = useState(interesseProcedureId ?? "");
  const [localAreaIds, setLocalAreaIds] = useState<string[]>(interestAreaIds);
  const [localDataAvaliacao, setLocalDataAvaliacao] = useState(
    dataAvaliacao ? dataAvaliacao.slice(0, 16) : ""
  );
  const [savingAvaliacao, setSavingAvaliacao] = useState(false);
  const [savingInterest, setSavingInterest] = useState(false);

  const [localNotes, setLocalNotes] = useState(notes);
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const [localTags, setLocalTags] = useState(tags);
  const [novaTag, setNovaTag] = useState("");
  const [criandoTag, setCriandoTag] = useState(false);

  const [localTasks, setLocalTasks] = useState(tasks);
  const [novaTarefa, setNovaTarefa] = useState("");
  const [novaTarefaData, setNovaTarefaData] = useState("");
  const [novaTarefaResp, setNovaTarefaResp] = useState("");
  const [criandoTarefa, setCriandoTarefa] = useState(false);

  const isIndicacao = origins.find((o) => o.id === localOriginId)?.name?.toLowerCase().includes("indica");

  const areasDisponiveis = useMemo(() => {
    if (!localProcedureId) return [];
    const proc = procedures.find((p) => p.id === localProcedureId);
    if (!proc) return [];
    if (proc.segment === "laser") return areas.filter((a) => a.segment === "laser");
    return areas.filter((a) => a.procedure_id === localProcedureId);
  }, [areas, procedures, localProcedureId]);

  async function salvarAvaliacao() {
    setSavingAvaliacao(true);
    await supabase
      .from("opportunities")
      .update({ data_avaliacao: localDataAvaliacao ? new Date(localDataAvaliacao).toISOString() : null })
      .eq("id", opportunityId);
    setSavingAvaliacao(false);
    router.refresh();
  }

  async function salvarInteresse() {
    setSavingInterest(true);
    await supabase
      .from("opportunities")
      .update({
        lead_origin_id: localOriginId || null,
        referred_by_name: localReferredBy || null,
        interesse_procedure_id: localProcedureId || null,
      })
      .eq("id", opportunityId);

    await supabase.from("opportunity_interest_areas").delete().eq("opportunity_id", opportunityId);
    if (localAreaIds.length > 0) {
      await supabase
        .from("opportunity_interest_areas")
        .insert(localAreaIds.map((area_id) => ({ opportunity_id: opportunityId, area_id })));
    }
    setSavingInterest(false);
    router.refresh();
  }

  async function salvarNota() {
    const content = newNote.trim();
    if (!content) return;
    setSavingNote(true);
    const { data, error } = await supabase
      .from("opportunity_notes")
      .insert({ organization_id: organizationId, opportunity_id: opportunityId, author_id: currentUserId, content })
      .select("id, content, created_at")
      .single();
    setSavingNote(false);
    if (error) {
      alert(`Não foi possível salvar: ${error.message}`);
      return;
    }
    if (data) {
      setLocalNotes((prev) => [...prev, data as Note]);
      setNewNote("");
      router.refresh();
    }
  }

  function toggleTagAtiva(tagId: string) {
    return localTags.some((t) => t.id === tagId);
  }

  async function alternarTag(tag: Tag) {
    if (toggleTagAtiva(tag.id)) {
      setLocalTags((prev) => prev.filter((t) => t.id !== tag.id));
      await supabase.from("opportunity_tags").delete().eq("opportunity_id", opportunityId).eq("tag_id", tag.id);
    } else {
      setLocalTags((prev) => [...prev, tag]);
      await supabase.from("opportunity_tags").insert({ opportunity_id: opportunityId, tag_id: tag.id });
    }
    router.refresh();
  }

  async function criarEAplicarTag() {
    const nome = novaTag.trim();
    if (!nome) return;
    setCriandoTag(true);
    const { data, error } = await supabase
      .from("tags")
      .insert({ organization_id: organizationId, name: nome })
      .select("id, name, color")
      .single();
    setCriandoTag(false);
    if (error || !data) {
      alert(error?.message ?? "Não foi possível criar a etiqueta.");
      return;
    }
    await supabase.from("opportunity_tags").insert({ opportunity_id: opportunityId, tag_id: data.id });
    setLocalTags((prev) => [...prev, data as Tag]);
    setNovaTag("");
    router.refresh();
  }

  async function criarTarefa() {
    const title = novaTarefa.trim();
    if (!title) return;
    setCriandoTarefa(true);
    const { data, error } = await supabase
      .from("opportunity_tasks")
      .insert({
        organization_id: organizationId,
        opportunity_id: opportunityId,
        title,
        due_date: novaTarefaData || null,
        assigned_to: novaTarefaResp || null,
        created_by: currentUserId,
      })
      .select("id, title, due_date, done, assigned_to")
      .single();
    setCriandoTarefa(false);
    if (error || !data) {
      alert(error?.message ?? "Não foi possível criar a tarefa.");
      return;
    }
    setLocalTasks((prev) => [...prev, data as Task]);
    setNovaTarefa("");
    setNovaTarefaData("");
    setNovaTarefaResp("");
    router.refresh();
  }

  async function alternarTarefa(task: Task) {
    setLocalTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)));
    await supabase.from("opportunity_tasks").update({ done: !task.done }).eq("id", task.id);
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-surface p-5 shadow-soft">
        <div className="mb-4 flex items-start justify-between">
          <p className="text-lg font-semibold text-foreground">{clientName}</p>
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">
            Fechar
          </button>
        </div>

        <div className="space-y-5">
          <section>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Origem e indicação
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <select
                value={localOriginId}
                onChange={(e) => setLocalOriginId(e.target.value)}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">Sem origem definida</option>
                {origins.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
              {isIndicacao && (
                <input
                  value={localReferredBy}
                  onChange={(e) => setLocalReferredBy(e.target.value)}
                  placeholder="Quem indicou?"
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              )}
            </div>
          </section>

          <section>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Avaliação agendada
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="datetime-local"
                value={localDataAvaliacao}
                onChange={(e) => setLocalDataAvaliacao(e.target.value)}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
              <button
                onClick={salvarAvaliacao}
                disabled={savingAvaliacao}
                className="rounded-md bg-gold-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-gold-600 disabled:opacity-60"
              >
                {savingAvaliacao ? "Salvando..." : "Salvar data"}
              </button>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Marcando aqui, o sistema cria sozinho uma tarefa de confirmação um dia antes.
            </p>
          </section>

          <section>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Interesse (antes de comprar)
            </p>
            <select
              value={localProcedureId}
              onChange={(e) => {
                setLocalProcedureId(e.target.value);
                setLocalAreaIds([]);
              }}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">Sem procedimento de interesse definido</option>
              {procedures.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {areasDisponiveis.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {areasDisponiveis.map((a) => (
                  <label
                    key={a.id}
                    className={`cursor-pointer rounded-full border px-2 py-0.5 text-xs ${
                      localAreaIds.includes(a.id)
                        ? "border-gold-500 bg-gold-100 text-gold-800"
                        : "border-border text-foreground"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={localAreaIds.includes(a.id)}
                      onChange={() =>
                        setLocalAreaIds((prev) =>
                          prev.includes(a.id) ? prev.filter((id) => id !== a.id) : [...prev, a.id]
                        )
                      }
                    />
                    {a.name}
                  </label>
                ))}
              </div>
            )}
            <button
              onClick={salvarInteresse}
              disabled={savingInterest}
              className="mt-2 rounded-md bg-gold-500 px-3 py-1 text-xs font-medium text-white hover:bg-gold-600 disabled:opacity-60"
            >
              {savingInterest ? "Salvando..." : "Salvar origem e interesse"}
            </button>
          </section>

          <section>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Etiquetas</p>
            <div className="flex flex-wrap gap-1.5">
              {allTags.map((t) => (
                <button
                  key={t.id}
                  onClick={() => alternarTag(t)}
                  className="rounded-full border px-2 py-0.5 text-xs"
                  style={
                    toggleTagAtiva(t.id)
                      ? { backgroundColor: t.color, borderColor: t.color, color: "white" }
                      : { borderColor: t.color, color: t.color }
                  }
                >
                  {t.name}
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-1.5">
              <input
                value={novaTag}
                onChange={(e) => setNovaTag(e.target.value)}
                placeholder="Nova etiqueta..."
                className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
              />
              <button
                onClick={criarEAplicarTag}
                disabled={criandoTag}
                className="shrink-0 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
              >
                Criar e aplicar
              </button>
            </div>
          </section>

          <section>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Tarefas</p>
            <div className="space-y-1.5">
              {localTasks.map((t) => {
                const atrasada = !t.done && t.due_date && t.due_date < new Date().toISOString().slice(0, 10);
                return (
                  <label
                    key={t.id}
                    className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm ${
                      atrasada ? "border-destructive/40 bg-destructive/5" : "border-border"
                    }`}
                  >
                    <input type="checkbox" checked={t.done} onChange={() => alternarTarefa(t)} />
                    <span className={t.done ? "flex-1 text-muted-foreground line-through" : "flex-1 text-foreground"}>
                      {t.title}
                    </span>
                    {t.due_date && (
                      <span className={atrasada ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
                        {formatDate(t.due_date)}
                      </span>
                    )}
                  </label>
                );
              })}
              {localTasks.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma tarefa ainda.</p>}
            </div>
            <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-[1fr_auto_auto_auto]">
              <input
                value={novaTarefa}
                onChange={(e) => setNovaTarefa(e.target.value)}
                placeholder="Nova tarefa..."
                className="rounded-md border border-border bg-background px-2 py-1 text-xs"
              />
              <input
                type="date"
                value={novaTarefaData}
                onChange={(e) => setNovaTarefaData(e.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1 text-xs"
              />
              <select
                value={novaTarefaResp}
                onChange={(e) => setNovaTarefaResp(e.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1 text-xs"
              >
                <option value="">Responsável</option>
                {sellers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button
                onClick={criarTarefa}
                disabled={criandoTarefa}
                className="rounded-md bg-gold-500 px-2 py-1 text-xs font-medium text-white hover:bg-gold-600"
              >
                Adicionar
              </button>
            </div>
          </section>

          <section>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Anotações ({localNotes.length})
            </p>
            <div className="max-h-48 space-y-1.5 overflow-y-auto">
              {localNotes.map((n) => (
                <div key={n.id} className="rounded bg-muted p-2 text-xs">
                  <p className="text-foreground">{n.content}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {n.author_name ?? "alguém"} · {formatDateTime(n.created_at)}
                  </p>
                </div>
              ))}
              {localNotes.length === 0 && <p className="text-xs text-muted-foreground">Sem anotações ainda.</p>}
            </div>
            <div className="mt-2 flex gap-1.5">
              <input
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Nova anotação..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    salvarNota();
                  }
                }}
                className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
              />
              <button
                onClick={salvarNota}
                disabled={savingNote}
                className="shrink-0 rounded-md bg-gold-500 px-2 py-1 text-xs font-medium text-white hover:bg-gold-600"
              >
                Salvar
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
