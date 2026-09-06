"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = {
  table: "procedures" | "packages" | "cash_categories";
  organizationId: string;
  extraFields?: { key: string; label: string; type: "select"; options: { value: string; label: string }[] }[];
};

export function SimpleRegistrationForm({ table, organizationId, extraFields }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState("");
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload: Record<string, unknown> = { organization_id: organizationId, name, ...extra };

    const { error } = await supabase.from(table).insert(payload);

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setName("");
    setExtra({});
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 flex flex-wrap items-start gap-3 rounded-lg border border-gold-100 bg-white p-4">
      <input
        required
        placeholder="Nome"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="min-w-[180px] flex-1 rounded-md border border-gold-200 px-3 py-2 text-sm outline-none focus:border-gold-500"
      />

      {extraFields?.map((field) => (
        <select
          key={field.key}
          required
          value={extra[field.key] ?? ""}
          onChange={(e) => setExtra((prev) => ({ ...prev, [field.key]: e.target.value }))}
          className="rounded-md border border-gold-200 px-3 py-2 text-sm outline-none focus:border-gold-500"
        >
          <option value="" disabled>
            {field.label}
          </option>
          {field.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ))}

      {error && <p className="w-full text-sm text-destructive">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-gold-500 px-4 py-2 text-sm font-medium text-white hover:bg-gold-600 disabled:opacity-60"
      >
        {saving ? "Salvando..." : "Adicionar"}
      </button>
    </form>
  );
}
