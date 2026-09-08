"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

function addMonths(monthStr: string, delta: number) {
  const [y, m] = monthStr.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(monthStr: string) {
  const [y, m] = monthStr.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function MonthSwitcher({
  currentMonth,
  basePath,
  otherParams,
}: {
  currentMonth: string;
  basePath: string;
  otherParams: Record<string, string>;
}) {
  const router = useRouter();
  const [showPicker, setShowPicker] = useState(false);

  function go(month: string) {
    const params = new URLSearchParams({ ...otherParams, mes: month });
    router.push(`${basePath}?${params.toString()}`);
    setShowPicker(false);
  }

  return (
    <div className="relative flex items-center gap-1 rounded-lg border border-border bg-surface px-2 py-1.5">
      <button
        onClick={() => go(addMonths(currentMonth, -1))}
        aria-label="Mês anterior"
        className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <button
        onClick={() => setShowPicker((v) => !v)}
        className="min-w-[160px] rounded px-2 py-1 text-center font-display text-base font-semibold text-gold-700 hover:bg-muted dark:text-gold-400"
      >
        {monthLabel(currentMonth)}
      </button>

      <button
        onClick={() => go(addMonths(currentMonth, 1))}
        aria-label="Próximo mês"
        className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      {showPicker && (
        <input
          type="month"
          autoFocus
          defaultValue={currentMonth}
          onChange={(e) => e.target.value && go(e.target.value)}
          onBlur={() => setShowPicker(false)}
          className="absolute left-0 top-full z-10 mt-1 rounded-md border border-border bg-surface px-2 py-1 text-sm shadow-soft"
        />
      )}
    </div>
  );
}
