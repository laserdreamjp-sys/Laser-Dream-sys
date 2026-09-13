"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { maskCpf, normalizeCpf, isValidCpf, UFS } from "@/lib/cpf";

export function NewClientForm({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [cep, setCep] = useState("");
  const [logradouro, setLogradouro] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cpfLimpo = normalizeCpf(cpf);
  const cpfInvalido = cpfLimpo !== null && !isValidCpf(cpfLimpo);

  function reset() {
    setName(""); setCpf(""); setPhone(""); setEmail(""); setBirthDate("");
    setCep(""); setLogradouro(""); setNumero(""); setComplemento("");
    setBairro(""); setCidade(""); setUf("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (cpfInvalido) {
      setError("CPF inválido. Confira os números digitados.");
      return;
    }
    setSaving(true);
    setError(null);

    const { error } = await supabase.from("clients").insert({
      organization_id: organizationId,
      name,
      cpf: cpfLimpo,
      phone: phone || null,
      email: email || null,
      birth_date: birthDate || null,
      cep: normalizeCpf(cep) ? cep.replace(/\D/g, "") : null,
      logradouro: logradouro || null,
      numero: numero || null,
      complemento: complemento || null,
      bairro: bairro || null,
      cidade: cidade || null,
      uf: uf || null,
    });

    setSaving(false);

    if (error) {
      setError(
        error.code === "23505"
          ? "Já existe um cliente cadastrado com esse CPF."
          : error.message
      );
      return;
    }

    reset();
    setOpen(false);
    router.refresh();
  }

  const inputClass =
    "rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-gold-500";

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mb-6 rounded-md bg-gold-500 px-4 py-2 text-sm font-medium text-white hover:bg-gold-600"
      >
        Adicionar cliente
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 space-y-4 rounded-lg border border-border bg-surface p-4">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Identificação</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <input required placeholder="Nome completo" value={name}
            onChange={(e) => setName(e.target.value)} className={`${inputClass} sm:col-span-2`} />
          <div className="sm:col-span-1">
            <input placeholder="CPF (opcional)" value={cpf}
              onChange={(e) => setCpf(maskCpf(e.target.value))}
              className={`${inputClass} w-full ${cpfInvalido ? "border-destructive" : ""}`} />
            {cpfInvalido && <p className="mt-1 text-xs text-destructive">CPF inválido</p>}
          </div>
          <label className="text-sm">
            <input type="date" title="Aniversário" value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)} className={`${inputClass} w-full`} />
          </label>
          <input placeholder="Telefone" value={phone}
            onChange={(e) => setPhone(e.target.value)} className={inputClass} />
          <input placeholder="E-mail" type="email" value={email}
            onChange={(e) => setEmail(e.target.value)} className={`${inputClass} sm:col-span-2`} />
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Endereço</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
          <input placeholder="CEP" value={cep} onChange={(e) => setCep(e.target.value)} className={inputClass} />
          <input placeholder="Logradouro" value={logradouro}
            onChange={(e) => setLogradouro(e.target.value)} className={`${inputClass} sm:col-span-3`} />
          <input placeholder="Número" value={numero}
            onChange={(e) => setNumero(e.target.value)} className={inputClass} />
          <input placeholder="Complemento" value={complemento}
            onChange={(e) => setComplemento(e.target.value)} className={inputClass} />
          <input placeholder="Bairro" value={bairro}
            onChange={(e) => setBairro(e.target.value)} className={`${inputClass} sm:col-span-2`} />
          <input placeholder="Cidade" value={cidade}
            onChange={(e) => setCidade(e.target.value)} className={`${inputClass} sm:col-span-2`} />
          <select value={uf} onChange={(e) => setUf(e.target.value)} className={inputClass}>
            <option value="">UF</option>
            {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={saving || cpfInvalido}
          className="rounded-md bg-gold-500 px-4 py-2 text-sm font-medium text-white hover:bg-gold-600 disabled:opacity-60">
          {saving ? "Salvando..." : "Salvar cliente"}
        </button>
        <button type="button" onClick={() => { setOpen(false); setError(null); }}
          className="rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-muted">
          Cancelar
        </button>
      </div>
    </form>
  );
}
