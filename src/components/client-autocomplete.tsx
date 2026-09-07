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
  const [creating, setCreating] = useState(false);
  const [localClients, setLocalClients] = useState(clients);

  const matches = useMemo(() => {
    if (!query.trim()) return localClients.slice(0, 8);
    const q = query.toLowerCase();
    return localClients.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [localClients, query]);

  const showCreateOption = query.trim().length >= 4 && matches.length === 0;

  async function handleCreate() {
    setCreating(true);
    const { data, error } = await supabase
      .from("clients")
      .insert({ organization_id: organizationId, name: query.trim() })
      .select("id, name")
      .single();
    setCreating(false);

    if (error || !data) return;

    setLocalClients((prev) => [...prev, data]);
    onChange(data.id);
    setQuery(data.name);
    setOpen(false);
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
        className="w-full rounded-md border border-gold-200 px-3 py-2 text-sm outline-none focus:border-gold-500"
      />
      {open && (matches.length > 0 || showCreateOption) && (
        <ul className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-md border border-gold-200 bg-white shadow-md">
          {matches.map((c) => (
            <li
              key={c.id}
              onMouseDown={() => {
                onChange(c.id);
                setQuery(c.name);
                setOpen(false);
              }}
              className="cursor-pointer px-3 py-2 text-sm hover:bg-gold-50"
            >
              {c.name}
            </li>
          ))}
          {showCreateOption && (
            <li
              onMouseDown={handleCreate}
              className="cursor-pointer px-3 py-2 text-sm font-medium text-gold-700 hover:bg-gold-50"
            >
              {creating ? "Cadastrando..." : `+ Cadastrar "${query.trim()}" como novo cliente`}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
