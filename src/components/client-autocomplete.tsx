"use client";

import { useMemo, useState } from "react";

type Client = { id: string; name: string };

export function ClientAutocomplete({
  clients,
  value,
  onChange,
}: {
  clients: Client[];
  value: string;
  onChange: (clientId: string) => void;
}) {
  const [query, setQuery] = useState(() => clients.find((c) => c.id === value)?.name ?? "");
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    if (!query.trim()) return clients.slice(0, 8);
    const q = query.toLowerCase();
    return clients.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8);
  }, [clients, query]);

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
      {open && matches.length > 0 && (
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
        </ul>
      )}
    </div>
  );
}
