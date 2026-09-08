"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export function SegmentChart({ data }: { data: { name: string; total: number }[] }) {
  return (
    <div className="h-64 rounded-lg border border-border bg-surface p-4">
      <p className="mb-2 text-sm font-medium text-foreground">Faturamento por segmento</p>
      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={(v) => formatCurrency(v)} width={70} tick={{ fontSize: 10 }} />
          <Tooltip formatter={(v: number) => formatCurrency(v)} />
          <Bar dataKey="total" fill="#C4922B" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PaymentMethodChart({ data }: { data: { name: string; total: number }[] }) {
  return (
    <div className="h-64 rounded-lg border border-border bg-surface p-4">
      <p className="mb-2 text-sm font-medium text-foreground">Faturamento por forma de pagamento</p>
      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} />
          <YAxis tickFormatter={(v) => formatCurrency(v)} width={70} tick={{ fontSize: 10 }} />
          <Tooltip formatter={(v: number) => formatCurrency(v)} />
          <Bar dataKey="total" fill="#D9A93E" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RecorrenteAlert({ pct }: { pct: number }) {
  const status = pct >= 40 ? "excedido" : pct >= 37 ? "alerta" : "ok";
  const barColor = status === "excedido" ? "#B3432E" : status === "alerta" ? "#D9A93E" : "#7A9B76";

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">Concentração Boleto / Recorrente</p>
        <span className="text-lg font-medium" style={{ color: barColor }}>
          {pct.toFixed(1)}%
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Limite de 40% do faturamento em Boleto/Recorrente, alerta a partir de 37%.{" "}
        {status === "excedido" && <span className="font-medium text-destructive">Limite ultrapassado.</span>}
        {status === "alerta" && <span className="font-medium text-gold-700">Próximo do limite.</span>}
        {status === "ok" && "Dentro do esperado."}
      </p>
    </div>
  );
}
