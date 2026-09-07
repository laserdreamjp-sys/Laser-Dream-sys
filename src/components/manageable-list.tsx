"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type FieldConfig = {
  key: string;
  label: string;
  type: "text" | "select";
  options?: { value: string; label: string }[];
};

type Item = Record<string, unknown> & { id: string; active?: boolean };

function displayValue(item: Item, field: FieldConfig) {
  const raw = item[field.key];
  if (field.type === "select" && field.options) {
    return field.options.find((o) => o.value === raw)?.label ?? String(raw ?? "-");
  }
  return String(raw ?? "-");
}

export function ManageableList({
  table,
  organizationId,
  userId,
  canWrite,
  items,
  fields,
}: {
  table: string;
  organizationId: string;
  userId: string;
  canWrite: boolean;
  items: Item[];
  fields: FieldConfig[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const emptyForm = () => Object.fromEntries(fields.map((f) => [f.key, ""]));

  const [newItem, setNewItem] = useState<Record<string, string>>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const { error } = await supabase.from(table).insert({ organization_id: organizationId, ...newItem });

    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setNewItem(emptyForm());
    router.refresh();
  }

  function startEdit(item: Item) {
    setEditingId(item.id);
    setEditItem(Object.fromEntries(fields.map((f) => [f.key, String(item[f.key] ?? "")])));
    setError(null);
  }

  async function handleSaveEdit(item: Item) {
    setSaving(true);
    setError(null);
    setNotice(null);

    if (canWrite) {
      const { error } = await supabase.from(table).update(editItem).eq("id", item.id);
      setSaving(false);
      if (error) {
        setError(error.message);
        return;
      }
      setEditingId(null);
      router.refresh();
      return;
    }

    const { error } = await supabase.from("change_requests").insert({
      organization_id: organizationId,
      table_name: table,
      record_id: item.id,
      record_label: String(item[fields[0].key] ?? ""),
      action: "edit",
      payload: editItem,
      requested_by: userId,
    });

    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setEditingId(null);
    setNotice("Solicitação de alteração enviada ao administrador.");
  }

  async function handleToggleActive(item: Item) {
    setError(null);
    setNotice(null);

    if (canWrite) {
      const { error } = await supabase.from(table).update({ active: !item.active }).eq("id", item.id);
      if (error) {
        setError(error.message);
        return;
      }
      router.refresh();
      return;
    }

    const { error } = await supabase.from("change_requests").insert({
      organization_id: organizationId,
      table_name: table,
      record_id: item.id,
      record_label: String(item[fields[0].key] ?? ""),
      action: "edit",
      payload: { active: !item.active },
      requested_by: userId,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setNotice("Solicitação enviada ao administrador.");
  }

  async function handleDelete(item: Item) {
    if (!confirm(canWrite ? "Excluir este item? Não será possível desfazer." : "Solicitar exclusão deste item?")) {
      return;
    }
    setError(null);
    setNotice(null);

    if (canWrite) {
      const { error } = await supabase.from(table).delete().eq("id", item.id);
      if (error) {
        setError(
          error.message.includes("foreign key")
            ? "Não é possível excluir: existem registros usando este item. Desative em vez de excluir."
            : error.message
        );
        return;
      }
      router.refresh();
      return;
    }

    const { error } = await supabase.from("change_requests").insert({
      organization_id: organizationId,
      table_name: table,
      record_id: item.id,
      record_label: String(item[fields[0].key] ?? ""),
      action: "delete",
      requested_by: userId,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setNotice("Solicitação de exclusão enviada ao administrador.");
  }

  return (
    <div>
      <form onSubmit={handleAdd} className="mb-3 flex flex-wrap items-start gap-3 rounded-lg border border-gold-100 bg-white p-4">
        {fields.map((field) =>
          field.type === "select" ? (
            <select
              key={field.key}
              required
              value={newItem[field.key]}
              onChange={(e) => setNewItem((prev) => ({ ...prev, [field.key]: e.target.value }))}
              className="rounded-md border border-gold-200 px-3 py-2 text-sm outline-none focus:border-gold-500"
            >
              <option value="" disabled>
                {field.label}
              </option>
              {field.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              key={field.key}
              required
              placeholder={field.label}
              value={newItem[field.key]}
              onChange={(e) => setNewItem((prev) => ({ ...prev, [field.key]: e.target.value }))}
              className="min-w-[160px] flex-1 rounded-md border border-gold-200 px-3 py-2 text-sm outline-none focus:border-gold-500"
            />
          )
        )}
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-gold-500 px-4 py-2 text-sm font-medium text-white hover:bg-gold-600 disabled:opacity-60"
        >
          Adicionar
        </button>
      </form>

      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
      {notice && <p className="mb-3 text-sm text-gold-700">{notice}</p>}

      <ul className="divide-y divide-gold-50 rounded-lg border border-gold-100 bg-white text-sm">
        {items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-2">
            {editingId === item.id ? (
              <>
                {fields.map((field) =>
                  field.type === "select" ? (
                    <select
                      key={field.key}
                      value={editItem[field.key]}
                      onChange={(e) => setEditItem((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      className="rounded-md border border-gold-200 px-2 py-1 text-sm outline-none focus:border-gold-500"
                    >
                      {field.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      key={field.key}
                      value={editItem[field.key]}
                      onChange={(e) => setEditItem((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      className="min-w-[140px] flex-1 rounded-md border border-gold-200 px-2 py-1 text-sm outline-none focus:border-gold-500"
                    />
                  )
                )}
                <button
                  onClick={() => handleSaveEdit(item)}
                  disabled={saving}
                  className="rounded-md bg-gold-500 px-3 py-1 text-xs font-medium text-white hover:bg-gold-600"
                >
                  {canWrite ? "Salvar" : "Enviar solicitação"}
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="text-xs text-ink-500 underline underline-offset-2"
                >
                  Cancelar
                </button>
              </>
            ) : (
              <>
                <div className="flex-1">
                  {fields.map((f, i) => (
                    <span key={f.key} className={item.active === false ? "text-ink-300 line-through" : ""}>
                      {displayValue(item, f)}
                      {i < fields.length - 1 ? " · " : ""}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => handleToggleActive(item)}
                  className="text-xs text-ink-500 underline underline-offset-2"
                >
                  {item.active === false ? (canWrite ? "Ativar" : "Solicitar ativação") : canWrite ? "Desativar" : "Solicitar desativação"}
                </button>
                <button
                  onClick={() => startEdit(item)}
                  className="text-xs text-gold-700 underline underline-offset-2"
                >
                  {canWrite ? "Editar" : "Solicitar edição"}
                </button>
                <button
                  onClick={() => handleDelete(item)}
                  className="text-xs text-destructive underline underline-offset-2"
                >
                  {canWrite ? "Excluir" : "Solicitar exclusão"}
                </button>
              </>
            )}
          </li>
        ))}
        {items.length === 0 && <li className="px-4 py-6 text-center text-ink-500">Nenhum item cadastrado.</li>}
      </ul>
    </div>
  );
}
