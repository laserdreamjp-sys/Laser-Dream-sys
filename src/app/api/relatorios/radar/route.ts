import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { suggestedMessage } from "@/components/radar-client-card";

function csvEscape(value: unknown) {
  const str = String(value ?? "");
  if (str.includes(";") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const BUCKET_LABELS: Record<string, string> = {
  risco_perda: "Risco de perda",
  hora_de_voltar: "Hora de voltar",
  aniversariante: "Aniversariante do mes",
  cross_estetica: "Oferecer estetica",
  cross_laser: "Oferecer laser",
  reativacao_fria: "Reativacao fria",
  em_dia: "Em dia",
  sem_compra: "Sem compra",
};

export async function GET() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("client_intelligence")
    .select("name, phone, dias_desde_ultima, valor_total, total_compras, ticket_medio, ultima_compra, bucket")
    .order("valor_total", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  type Row = {
    name: string;
    phone: string | null;
    dias_desde_ultima: number | null;
    valor_total: number;
    total_compras: number;
    ticket_medio: number;
    ultima_compra: string | null;
    bucket: string;
  };

  const rows = ((data ?? []) as unknown as Row[]).filter(
    (r) => r.bucket !== "em_dia" && r.bucket !== "sem_compra"
  );

  const header = [
    "Situacao",
    "Cliente",
    "Telefone",
    "Ultima compra",
    "Dias sem voltar",
    "Compras",
    "Valor total",
    "Ticket medio",
    "Mensagem sugerida",
  ];

  const lines = [header.join(";")];

  for (const r of rows) {
    lines.push(
      [
        BUCKET_LABELS[r.bucket] ?? r.bucket,
        r.name,
        r.phone,
        r.ultima_compra,
        r.dias_desde_ultima,
        r.total_compras,
        Number(r.valor_total).toFixed(2).replace(".", ","),
        Number(r.ticket_medio).toFixed(2).replace(".", ","),
        suggestedMessage(r.bucket, r.name),
      ]
        .map(csvEscape)
        .join(";")
    );
  }

  const csv = "\uFEFF" + lines.join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="radar-oportunidades.csv"`,
    },
  });
}
