"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCpf } from "@/lib/cpf";

type Resultado = { id: string; name: string; cpf: string | null; phone: string | null };

export function GlobalSearch() {
  const supabase = createClient();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [aberto, setAberto] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickFora(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", onClickFora);
    return () => document.removeEventListener("mousedown", onClickFora);
  }, []);

  useEffect(() => {
    const termo = query.trim();
    if (termo.length < 2) {
      setResultados([]);
      return;
    }
    setBuscando(true);
    const timeout = setTimeout(async () => {
      const soDigitos = termo.replace(/\D/g, "");
      const filtro =
        soDigitos.length >= 3
          ? `name.ilike.%${termo}%,cpf.ilike.%${soDigitos}%,phone.ilike.%${soDigitos}%`
          : `name.ilike.%${termo}%`;
      const { data } = await supabase
        .from("clients")
        .select("id, name, cpf, phone")
        .or(filtro)
        .order("name")
        .limit(8);
      setResultados((data as Resultado[]) ?? []);
      setBuscando(false);
    }, 250);
    return () => clearTimeout(timeout);
  }, [query, supabase]);

  function irPara(id: string) {
    setAberto(false);
    setQuery("");
    router.push(`/clientes/${id}`);
  }

  return (
    <div ref={wrapRef} className="relative w-full max-w-md">
      <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setAberto(true);
          }}
          onFocus={() => setAberto(true)}
          placeholder="Buscar cliente por nome, CPF ou telefone..."
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {query && (
          <button onClick={() => setQuery("")} aria-label="Limpar">
            <X className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
          </button>
        )}
      </div>

      {aberto && query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-80 overflow-y-auto rounded-md border border-border bg-surface shadow-soft">
          {buscando && <p className="px-3 py-3 text-xs text-muted-foreground">Buscando...</p>}
          {!buscando && resultados.length === 0 && (
            <p className="px-3 py-3 text-xs text-muted-foreground">Nenhum cliente encontrado.</p>
          )}
          {resultados.map((r) => (
            <button
              key={r.id}
              onClick={() => irPara(r.id)}
              className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-muted"
            >
              <span className="font-medium text-foreground">{r.name}</span>
              <span className="text-xs text-muted-foreground">
                {r.cpf ? formatCpf(r.cpf) : "sem CPF"} {r.phone ? `· ${r.phone}` : ""}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
