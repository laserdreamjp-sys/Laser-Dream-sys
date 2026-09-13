"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";

export function RadarFilters({
  valorMin,
  valorMax,
  diasMin,
  diasMax,
  tier,
}: {
  valorMin: string;
  valorMax: string;
  diasMin: string;
  diasMax: string;
  tier: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [form, setForm] = useState({ valorMin, valorMax, diasMin, diasMax, tier });

  const hasFilters = Object.values(form).some((v) => v !== "");

  function apply() {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(form)) {
      if (v) params.set(k, v);
    }
    router.push(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`);
  }

  function clear() {
    setForm({ valorMin: "", valorMax: "", diasMin: "", diasMax: "", tier: "" });
    router.push(pathname);
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-3">
      <label className="text-xs">
        <span className="mb-1 block text-muted-foreground">Valor gasto de</span>
        <input
          type="number"
          placeholder="R$ 0"
          value={form.valorMin}
          onChange={(e) => setForm((p) => ({ ...p, valorMin: e.target.value }))}
          className="w-24 rounded-md border border-border bg-background px-2 py-1.5"
        />
      </label>
      <label className="text-xs">
        <span className="mb-1 block text-muted-foreground">até</span>
        <input
          type="number"
          placeholder="sem limite"
          value={form.valorMax}
          onChange={(e) => setForm((p) => ({ ...p, valorMax: e.target.value }))}
          className="w-24 rounded-md border border-border bg-background px-2 py-1.5"
        />
      </label>
      <label className="text-xs">
        <span className="mb-1 block text-muted-foreground">Dias sem comprar de</span>
        <input
          type="number"
          placeholder="0"
          value={form.diasMin}
          onChange={(e) => setForm((p) => ({ ...p, diasMin: e.target.value }))}
          className="w-24 rounded-md border border-border bg-background px-2 py-1.5"
        />
      </label>
      <label className="text-xs">
        <span className="mb-1 block text-muted-foreground">até</span>
        <input
          type="number"
          placeholder="sem limite"
          value={form.diasMax}
          onChange={(e) => setForm((p) => ({ ...p, diasMax: e.target.value }))}
          className="w-24 rounded-md border border-border bg-background px-2 py-1.5"
        />
      </label>
      <label className="text-xs">
        <span className="mb-1 block text-muted-foreground">Classificação</span>
        <select
          value={form.tier}
          onChange={(e) => setForm((p) => ({ ...p, tier: e.target.value }))}
          className="rounded-md border border-border bg-background px-2 py-1.5"
        >
          <option value="">Todas</option>
          <option value="Diamante">Diamante</option>
          <option value="Ouro">Ouro</option>
          <option value="Prata">Prata</option>
          <option value="Bronze">Bronze</option>
        </select>
      </label>

      <button
        onClick={apply}
        className="rounded-md bg-gold-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-gold-600"
      >
        Filtrar
      </button>
      {hasFilters && (
        <button onClick={clear} className="text-xs text-muted-foreground underline underline-offset-2">
          Limpar filtros
        </button>
      )}
    </div>
  );
}
