"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatCpf } from "@/lib/cpf";

type Option = { id: string; name: string };
type SellerOption = { id: string; name: string; unit_id: string | null };
type ClientMatch = { id: string; name: string; cpf: string | null; phone: string | null };

export function NewOpportunityButton({
  sellers,
  units,
  firstStageId,
  organizationId,
  currentUserId,
}: {
  sellers: SellerOption[];
  units: Option[];
  firstStageId: string;
  organizationId: string;
  currentUserId: string;
}) {
  const supabase = createClient();
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<ClientMatch[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [mostrarResultados, setMostrarResultados] = useState(false);
  const [clienteSelecionado, setClienteSelecionado] = useState<ClientMatch | null>(null);
  const [parecidos, setParecidos] = useState<ClientMatch[]>([]);

  const [sellerId, setSellerId] = useState("");
  const [unitId, setUnitId] = useState(units[0]?.id ?? "");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    function onClickFora(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setMostrarResultados(false);
    }
    document.addEventListener("mousedown", onClickFora);
    return () => document.removeEventListener("mousedown", onClickFora);
  }, []);

  useEffect(() => {
    if (clienteSelecionado) return;
    const termo = busca.trim();
    setParecidos([]);
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
      const { data } = await supabase.from("clients").select("id, name, cpf, phone").or(filtro).order("name").limit(6);
      setResultados((data as ClientMatch[]) ?? []);
      setBuscando(false);
    }, 250);
    return () => clearTimeout(timeout);
  }, [busca, clienteSelecionado, supabase]);

  function selecionarCliente(c: ClientMatch) {
    setClienteSelecionado(c);
    setBusca(c.name);
    setMostrarResultados(false);
    setParecidos([]);
  }

  function limparSelecao() {
    setClienteSelecionado(null);
    setBusca("");
  }

  async function verificarParecidos(nome: string) {
    const { data } = await supabase.rpc("buscar_clientes_parecidos", { termo: nome });
    setParecidos((data as ClientMatch[]) ?? []);
    return (data as ClientMatch[])?.length ?? 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firstStageId) return;
    setError(null);

    let clientId = clienteSelecionado?.id ?? "";

    if (!clientId) {
      const nome = busca.trim();
      if (!nome) {
        setError("Escolha um cliente já cadastrado ou digite o nome de alguém novo.");
        return;
      }
      // antes de criar cliente novo, confere se ja existe alguem parecido
      const qtdParecidos = await verificarParecidos(nome);
      if (qtdParecidos > 0 && parecidos.length === 0) {
        // primeira tentativa: so mostra o aviso, nao cria ainda
        return;
      }
      setSaving(true);
      const { data: novoCliente, error: clientError } = await supabase
        .from("clients")
        .insert({ organization_id: organizationId, name: nome })
        .select("id")
        .single();
      if (clientError || !novoCliente) {
        setSaving(false);
        setError(clientError?.message ?? "Não foi possível criar o cliente.");
        return;
      }
      clientId = novoCliente.id;
    }

    setSaving(true);
    const { error: insertError } = await supabase.from("opportunities").insert({
      organization_id: organizationId,
      unit_id: unitId || null,
      client_id: clientId,
      stage_id: firstStageId,
      seller_id: sellerId || null,
      estimated_value: estimatedValue ? Number(estimatedValue) : null,
      notes: notes || null,
      created_by: currentUserId,
    });

    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setOpen(false);
    limparSelecao();
    setSellerId("");
    setEstimatedValue("");
    setNotes("");
    setParecidos([]);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-gold-500 px-4 py-2 text-sm font-medium text-white hover:bg-gold-600"
      >
        Novo lead
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-md space-y-3 rounded-lg border border-border bg-surface p-5 shadow-soft"
          >
            <p className="text-sm font-medium text-foreground">Novo lead</p>

            <div ref={wrapRef} className="relative">
              <label className="mb-1 block text-xs text-muted-foreground">
                Cliente (busca no cadastro ou digite o nome de alguém novo)
              </label>
              <input
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  setClienteSelecionado(null);
                  setMostrarResultados(true);
                  setParecidos([]);
                }}
                onFocus={() => setMostrarResultados(true)}
                placeholder="Nome, CPF ou telefone..."
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
              {mostrarResultados && !clienteSelecionado && busca.trim().length >= 2 && (
                <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-md border border-border bg-surface shadow-soft">
                  {buscando && <p className="px-3 py-2 text-xs text-muted-foreground">Buscando...</p>}
                  {!buscando && resultados.length === 0 && (
                    <p className="px-3 py-2 text-xs text-muted-foreground">
                      Ninguém encontrado. Pode seguir com esse nome pra criar um cliente novo.
                    </p>
                  )}
                  {resultados.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selecionarCliente(c)}
                      className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-muted"
                    >
                      <span className="font-medium text-foreground">{c.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {c.cpf ? formatCpf(c.cpf) : "sem CPF"} {c.phone ? `· ${c.phone}` : ""}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {clienteSelecionado && (
                <p className="mt-1 text-xs text-gold-700 dark:text-gold-400">✓ Cliente já cadastrado selecionado</p>
              )}
            </div>

            {parecidos.length > 0 && (
              <div className="rounded-md border border-amber-400 bg-amber-50 p-3 dark:bg-amber-900/20">
                <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                  Já existe alguém parecido no cadastro. É a mesma pessoa?
                </p>
                <div className="mt-2 space-y-1">
                  {parecidos.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selecionarCliente(c)}
                      className="flex w-full items-center justify-between rounded-md bg-white px-2 py-1.5 text-left text-xs hover:bg-muted dark:bg-background"
                    >
                      <span className="text-foreground">{c.name}</span>
                      <span className="text-muted-foreground">Usar esse</span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setParecidos([])}
                  className="mt-2 text-xs text-amber-800 underline dark:text-amber-300"
                >
                  Não, é pessoa diferente — criar cliente novo mesmo assim
                </button>
              </div>
            )}

            <label className="block text-xs">
              <span className="mb-1 block text-muted-foreground">Unidade</span>
              <select
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs">
              <span className="mb-1 block text-muted-foreground">Vendedor(a)</span>
              <select
                value={sellerId}
                onChange={(e) => setSellerId(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">Sem definir ainda</option>
                {sellers
                  .filter((s) => !s.unit_id || s.unit_id === unitId)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </label>

            <label className="block text-xs">
              <span className="mb-1 block text-muted-foreground">Valor estimado (opcional)</span>
              <input
                type="number"
                value={estimatedValue}
                onChange={(e) => setEstimatedValue(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </label>

            <label className="block text-xs">
              <span className="mb-1 block text-muted-foreground">Observações</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </label>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  limparSelecao();
                  setParecidos([]);
                }}
                className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-gold-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-gold-600 disabled:opacity-60"
              >
                {saving ? "Salvando..." : "Criar"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
