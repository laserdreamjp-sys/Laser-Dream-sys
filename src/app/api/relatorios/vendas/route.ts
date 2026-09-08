import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function csvEscape(value: unknown) {
  const str = String(value ?? "");
  if (str.includes(";") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { searchParams } = new URL(request.url);

  let query = supabase
    .from("sales")
    .select(
      "sale_date, amount, status, tipo_venda, classificacao_financeira, transaction_code, notes, clients(name), sellers(name), procedures(name, segment), payment_methods(name), profiles!sales_created_by_fkey(full_name), created_at"
    )
    .order("sale_date", { ascending: false })
    .limit(2000);

  const de = searchParams.get("de");
  const ate = searchParams.get("ate");
  const procedimento = searchParams.get("procedimento");
  const vendedor = searchParams.get("vendedor");
  const pagamento = searchParams.get("pagamento");
  const tipo = searchParams.get("tipo");
  const status = searchParams.get("status");
  const segmento = searchParams.get("segmento");

  if (de) query = query.gte("sale_date", de);
  if (ate) query = query.lte("sale_date", ate);
  if (procedimento) query = query.eq("procedure_id", procedimento);
  if (vendedor) query = query.eq("seller_id", vendedor);
  if (pagamento) query = query.eq("payment_method_id", pagamento);
  if (tipo) query = query.eq("tipo_venda", tipo);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  type Row = {
    sale_date: string;
    amount: number;
    status: string;
    tipo_venda: string | null;
    classificacao_financeira: string | null;
    transaction_code: string | null;
    notes: string | null;
    clients: { name: string } | null;
    sellers: { name: string } | null;
    procedures: { name: string; segment: string | null } | null;
    payment_methods: { name: string } | null;
    profiles: { full_name: string } | null;
    created_at: string;
  };

  let rows = (data ?? []) as unknown as Row[];
  if (segmento) rows = rows.filter((r) => r.procedures?.segment === segmento);

  const header = [
    "Data",
    "Cliente",
    "Vendedor(a)",
    "Segmento",
    "Procedimento",
    "Forma de pagamento",
    "Tipo de venda",
    "Classificacao financeira",
    "Valor",
    "Status",
    "Codigo/comprovante",
    "Observacoes",
    "Registrado por",
    "Registrado em",
  ];

  const lines = [header.join(";")];

  for (const r of rows) {
    lines.push(
      [
        r.sale_date,
        r.clients?.name,
        r.sellers?.name,
        r.procedures?.segment === "laser" ? "Laser" : r.procedures?.segment === "estetica" ? "Estetica" : "",
        r.procedures?.name,
        r.payment_methods?.name,
        r.tipo_venda,
        r.classificacao_financeira,
        Number(r.amount).toFixed(2).replace(".", ","),
        r.status,
        r.transaction_code,
        r.notes,
        r.profiles?.full_name,
        new Date(r.created_at).toLocaleString("pt-BR"),
      ]
        .map(csvEscape)
        .join(";")
    );
  }

  const csv = "\uFEFF" + lines.join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="vendas.csv"`,
    },
  });
}
