"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function NewClientForm({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const { error } = await supabase.from("clients").insert({
      organization_id: organizationId,
      name,
      phone: phone || null,
      email: email || null,
    });

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setName("");
    setPhone("");
    setEmail("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 grid grid-cols-1 gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-4">
      <input
        required
        placeholder="Nome"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-gold-500 sm:col-span-2"
      />
      <input
        placeholder="Telefone"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-gold-500"
      />
      <input
        placeholder="E-mail"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-gold-500"
      />
      {error && <p className="text-sm text-destructive sm:col-span-4">{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-gold-500 px-4 py-2 text-sm font-medium text-white hover:bg-gold-600 disabled:opacity-60 sm:col-span-4 sm:w-fit"
      >
        {saving ? "Salvando..." : "Adicionar cliente"}
      </button>
    </form>
  );
}
