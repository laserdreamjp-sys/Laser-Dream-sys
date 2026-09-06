"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Option = { id: string; name: string };

export function NewInviteForm({
  organizationId,
  roles,
  units,
}: {
  organizationId: string;
  roles: Option[];
  units: Option[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const [unitId, setUnitId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setLink(null);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14);

    const { data, error } = await supabase
      .from("invites")
      .insert({
        organization_id: organizationId,
        email,
        role_id: roleId,
        unit_id: unitId || null,
        expires_at: expiresAt.toISOString(),
      })
      .select("token")
      .single();

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setLink(`${window.location.origin}/convite/${data.token}`);
    setEmail("");
    router.refresh();
  }

  return (
    <div className="mb-6 rounded-lg border border-gold-100 bg-white p-4">
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <input
          required
          type="email"
          placeholder="E-mail do convidado"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md border border-gold-200 px-3 py-2 text-sm outline-none focus:border-gold-500 sm:col-span-2"
        />

        <select
          value={roleId}
          onChange={(e) => setRoleId(e.target.value)}
          className="rounded-md border border-gold-200 px-3 py-2 text-sm outline-none focus:border-gold-500"
        >
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>

        <select
          value={unitId}
          onChange={(e) => setUnitId(e.target.value)}
          className="rounded-md border border-gold-200 px-3 py-2 text-sm outline-none focus:border-gold-500"
        >
          <option value="">Sem unidade fixa</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>

        {error && <p className="text-sm text-destructive sm:col-span-4">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-gold-500 px-4 py-2 text-sm font-medium text-white hover:bg-gold-600 disabled:opacity-60 sm:col-span-4 sm:w-fit"
        >
          {saving ? "Gerando..." : "Gerar convite"}
        </button>
      </form>

      {link && (
        <div className="mt-3 rounded-md bg-gold-50 p-3 text-sm">
          <p className="mb-1 text-ink-700">Link do convite (compartilhe manualmente, válido por 14 dias):</p>
          <p className="break-all font-mono text-xs text-gold-800">{link}</p>
        </div>
      )}
    </div>
  );
}
