"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCpf } from "@/lib/cpf";

type Client = { id: string; name: string; cpf?: string | null; phone?: string | null };

export function ClientAutocomplete({
  organizationId,
  value,
  onChange,
  onCreated,
}: {
  organizationId: string;
  value: string;
  onChange: (clientId: string) => void;
  onCreated?: (client: Client) => void;
}) {
  const supabase = createClient();
  const wrapRef = useRef<HTMLDivElement>(null);

  const [nomeSelecionado, setNomeSelecionado] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [matches, setMatches] = useState<Client[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newBirthDate, setNewBirthDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // carrega o nome de quem ja vem selecionado (ex.: vindo do funil com clientId pronto)
  useEffect(() => {
    if (!value) {
      setNomeSelecionado("");
      return;
    }
    supabase
      .from("clients")
      .select("name")
      .eq("id", value)
      .single()
      .then(({ data }) => setNomeSelecionado((data as { name: string } | null)?.name ?? ""));
  }, [value, supabase]);

  useEffect(() => {
    function onClickFora(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickFora);
    return () => document.removeEventListener("mousedown", onClickFora);
  }, []);

  useEffect(() => {
    const termo = query.trim();
    if (termo.length < 2) {
      setMatches([]);
      return;
    }
    setBuscando(true);
    const timeout = setTimeout(async () => {
      const soDigitos = termo.replace(/\D/g, "");
      const filtro =
        soDigitos.length >= 3
          ? `name.ilike.%${termo}%,cpf.ilike.%${soDigitos}%,phone.ilike.%${soDigitos}%`
          : `name.ilike.%${termo}%`;
      const { data } = await supabase.from("clients").select("id, name, cpf, phone").or(filtro).order("name").limit(8);
      setMatches((data as Client[]) ?? []);
      setBuscando(false);
    }, 250);
    return () => clearTimeout(timeout);
  }, [query, supabase]);

  const showCreateOption = query.trim().length >= 4 && !buscando && matches.length === 0;

  function openCreateModal() {
    setNewName(query.trim());
    setNewPhone("");
    setNewEmail("");
    setNewBirthDate("");
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
        birth_date: newBirthDate || null,
      })
      .select("id, name")
      .single();

    setCreating(false);

    if (error || !data) {
      setCreateError(error?.message ?? "Não foi possível cadastrar o cliente.");
      return;
    }

    onChange(data.id);
    setNomeSelecionado(data.name);
    setQuery("");
    setShowModal(false);
    onCreated?.(data);
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        required
        placeholder="Digite para buscar (nome, CPF ou telefone)"
        value={value ? nomeSelecionado : query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (value) onChange("");
        }}
        onFocus={() => {
          if (value) {
            onChange("");
            setQuery(nomeSelecionado);
          }
          setOpen(true);
        }}
        className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-gold-500"
      />
      {open && query.trim().length >= 2 && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-surface shadow-md">
          {buscando && <li className="px-3 py-2 text-xs text-muted-foreground">Buscando...</li>}
          {!buscando &&
            matches.map((c) => (
              <li
                key={c.id}
                onMouseDown={() => {
                  onChange(c.id);
                  setNomeSelecionado(c.name);
                  setQuery("");
                  setOpen(false);
                }}
                className="cursor-pointer px-3 py-2 text-sm hover:bg-muted"
              >
                <span className="block font-medium text-foreground">{c.name}</span>
                <span className="text-xs text-muted-foreground">
                  {c.cpf ? formatCpf(c.cpf) : "sem CPF"} {c.phone ? `· ${c.phone}` : ""}
                </span>
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
              <div>
                <label className="mb-1 block text-sm text-foreground">Aniversário (opcional)</label>
                <input
                  type="date"
                  value={newBirthDate}
                  onChange={(e) => setNewBirthDate(e.target.value)}
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
