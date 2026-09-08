"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Client = { id: string; name: string };

export function ClientAutocomplete({
  clients,
  organizationId,
  value,
  onChange,
  onCreated,
}: {
  clients: Client[];
  organizationId: string;
  value: string;
  onChange: (clientId: string) => void;
  onCreated?: (client: Client) => void;
}) {
  const supabase = createClient();
  const [query, setQuery] = useState(() => clients.find((c) => c.id === value)?.name ?? "");
  const [open, setOpen] = useState(false);
  const [localClients, setLocalClients] = useState(clients);

  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const matches = useMemo(() => {
    if (!query.trim()) return localClients.slice(0, 8);
    const q = query.toLowerCase();
    return localClients.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [localClients, query]);

  const showCreateOption = query.trim().length >= 4 && matches.length === 0;

  function openCreateModal() {
    setNewName(query.trim());
    setNewPhone("");
    setNewEmail("");
    setCreateError(null);
    setShowModal(true);
    setOpen(false);
  }

  async function handleConfirmCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);

    const { data, error } = await supabase
      .from("clients")
      .insert({
        organization_id: organizationId,
        name: newName.trim(),
        phone: newPhone || null,
        email: newEmail || null,
      })
      .select("id, name")
      .single();

    setCreating(false);

    if (error || !data) {
      setCreateError(error?.message ?? "Não foi possível cadastrar o cliente.");
      return;
    }

    setLocalClients((prev) => [...prev, data]);
    onChange(data.id);
    setQuery(data.name);
    setShowModal(false);
    onCreated?.(data);
  }

  return (
    <div className="relative">
      <input
        required
        placeholder="Digite para buscar"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (!e.target.value) onChange("");
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-gold-500"
      />
      {open && (matches.length > 0 || showCreateOption) && (
        <ul className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-md border border-border bg-surface shadow-md">
          {matches.map((c) => (
            <li
              key={c.id}
              onMouseDown={() => {
                onChange(c.id);
                setQuery(c.name);
                setOpen(false);
              }}
              className="cursor-pointer px-3 py-2 text-sm hover:bg-muted"
            >
              {c.name}
            </li>
          ))}
          {showCreateOption && (
            <li
              onMouseDown={openCreateModal}
              className="cursor-pointer px-3 py-2 text-sm font-medium text-gold-700 hover:bg-muted"
            >
              {`+ Cadastrar "${query.trim()}" como novo cliente`}
            </li>
          )}
        </ul>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-sm rounded-lg bg-surface p-6 shadow-lg">
            <h3 className="mb-4 font-display font-semibold text-lg text-foreground">Novo cliente</h3>
            <form onSubmit={handleConfirmCreate} className="space-y-3">
              <div>
                <label className="mb-1 block text-sm text-foreground">Nome</label>
                <input
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-gold-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-foreground">Telefone (opcional)</label>
                <input
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-gold-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-foreground">E-mail (opcional)</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-gold-500"
                />
              </div>

              {createError && <p className="text-sm text-destructive">{createError}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-md bg-gold-500 px-4 py-2 text-sm font-medium text-white hover:bg-gold-600 disabled:opacity-60"
                >
                  {creating ? "Salvando..." : "Cadastrar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
