"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Client = { id: string; name: string };

export function ClientReportPicker({ currentClientId, currentClientName }: { currentClientId: string; currentClientName: string }) {
  const supabase = createClient();
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState(currentClientName);
  const [open, setOpen] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [matches, setMatches] = useState<Client[]>([]);

  useEffect(() => {
    function onClickFora(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickFora);
    return () => document.removeEventListener("mousedown", onClickFora);
  }, []);

  useEffect(() => {
    const termo = query.trim();
    if (termo.length < 2 || termo === currentClientName) {
      setMatches([]);
      return;
    }
    setBuscando(true);
    const timeout = setTimeout(async () => {
      const { data } = await supabase.from("clients").select("id, name").ilike("name", `%${termo}%`).order("name").limit(8);
      setMatches((data as Client[]) ?? []);
      setBuscando(false);
    }, 250);
    return () => clearTimeout(timeout);
  }, [query, currentClientName, supabase]);

  return (
    <div ref={wrapRef} className="relative flex-1">
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Digite o nome do cliente"
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      />
      {open && query.trim().length >= 2 && query.trim() !== currentClientName && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-surface shadow-md">
          {buscando && <li className="px-3 py-2 text-xs text-muted-foreground">Buscando...</li>}
          {!buscando && matches.length === 0 && (
            <li className="px-3 py-2 text-xs text-muted-foreground">Ninguém encontrado.</li>
          )}
          {matches.map((c) => (
            <li
              key={c.id}
              onMouseDown={() => {
                setQuery(c.name);
                setOpen(false);
                router.push(`/relatorios?cliente=${c.id}`);
              }}
              className="cursor-pointer px-3 py-2 text-sm hover:bg-muted"
            >
              {c.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
