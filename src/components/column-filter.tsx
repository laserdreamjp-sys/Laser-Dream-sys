"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";

export function ColumnFilter({
  label,
  paramName,
  options,
  currentParams,
}: {
  label: string;
  paramName: string;
  options: { value: string; label: string }[];
  currentParams: Record<string, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [aberto, setAberto] = useState(false);

  const selecionadosAtuais = (currentParams[paramName] ?? "").split(",").filter(Boolean);
  const [selecionados, setSelecionados] = useState<string[]>(selecionadosAtuais);

  useEffect(() => {
    function onClickFora(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", onClickFora);
    return () => document.removeEventListener("mousedown", onClickFora);
  }, []);

  function toggle(value: string) {
    setSelecionados((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  function aplicar() {
    const params = new URLSearchParams(currentParams);
    params.delete("pagina");
    if (selecionados.length > 0) params.set(paramName, selecionados.join(","));
    else params.delete(paramName);
    router.push(`${pathname}?${params.toString()}`);
    setAberto(false);
  }

  function limpar() {
    setSelecionados([]);
    const params = new URLSearchParams(currentParams);
    params.delete(paramName);
    params.delete("pagina");
    router.push(`${pathname}?${params.toString()}`);
    setAberto(false);
  }

  const ativo = selecionadosAtuais.length > 0;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className={`flex w-full items-center justify-between gap-1 rounded-md border px-2 py-1.5 text-xs ${
          ativo ? "border-gold-500 bg-gold-50 text-gold-800 dark:bg-gold-900/20" : "border-border bg-background text-foreground"
        }`}
      >
        <span className="truncate">
          {label}
          {ativo ? ` (${selecionadosAtuais.length})` : ""}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
      </button>

      {aberto && (
        <div className="absolute left-0 top-full z-30 mt-1 max-h-64 w-56 overflow-y-auto rounded-md border border-border bg-surface p-2 shadow-soft">
          {options.length === 0 && <p className="px-2 py-1 text-xs text-muted-foreground">Sem opções.</p>}
          {options.map((o) => (
            <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-muted">
              <input
                type="checkbox"
                checked={selecionados.includes(o.value)}
                onChange={() => toggle(o.value)}
              />
              {o.label}
            </label>
          ))}
          <div className="mt-2 flex gap-2 border-t border-border pt-2">
            <button
              type="button"
              onClick={aplicar}
              className="flex-1 rounded-md bg-gold-500 px-2 py-1 text-xs font-medium text-white hover:bg-gold-600"
            >
              Aplicar
            </button>
            <button
              type="button"
              onClick={limpar}
              className="rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-muted"
            >
              Limpar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
