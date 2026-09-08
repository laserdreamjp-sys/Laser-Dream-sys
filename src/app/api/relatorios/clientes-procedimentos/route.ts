import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function csvEscape(value: unknown) {
  const str = String(value ?? "");
  if (str.includes(";") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("sales")
    .select("sale_date, amount, clients(name), procedures(name, segment)")
    .eq("status", "ativa")
    .order("sale_date", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  type Row = {
    sale_date: string;
    amount: number;
    clients: { name: string } | null;
    procedures: { name: string; segment: string | null } | null;
  };

  const rows = (data ?? []) as unknown as Row[];

  const grouped = new Map<
    string,
    { cliente: string; procedimento: string; segmento: string; vezes: number; ultima: string; total: number }
  >();

  for (const r of rows) {
    const cliente = r.clients?.name ?? "-";
    const procedimento = r.procedures?.name ?? "-";
    const segmento = r.procedures?.segment === "laser" ? "Laser" : r.procedures?.segment === "estetica" ? "Estetica" : "-";
    const key = `${cliente}__${procedimento}`;
    const cur = grouped.get(key) ?? { cliente, procedimento, segmento, vezes: 0, ultima: r.sale_date, total: 0 };
    cur.vezes += 1;
    cur.total += Number(r.amount);
    if (r.sale_date > cur.ultima) cur.ultima = r.sale_date;
    grouped.set(key, cur);
  }

  const header = ["Cliente", "Procedimento", "Segmento", "Vezes que fez", "Ultima vez", "Total gasto"];
  const lines = [header.join(";")];

  for (const g of Array.from(grouped.values()).sort((a, b) => a.cliente.localeCompare(b.cliente))) {
    lines.push(
      [g.cliente, g.procedimento, g.segmento, g.vezes, g.ultima, g.total.toFixed(2).replace(".", ",")]
        .map(csvEscape)
        .join(";")
    );
  }

  const csv = "\uFEFF" + lines.join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="clientes-procedimentos.csv"`,
    },
  });
}
