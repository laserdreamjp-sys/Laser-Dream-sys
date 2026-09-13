import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";
import { formatCpf } from "@/lib/cpf";

type Row = {
  sale_date: string;
  amount: number;
  status: string;
  installments: number | null;
  procedures: { name: string; segment: string | null } | null;
  payment_methods: { name: string } | null;
  sellers: { name: string } | null;
  clients: {
    name: string;
    cpf: string | null;
    phone: string | null;
    email: string | null;
    cep: string | null;
    logradouro: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cidade: string | null;
    uf: string | null;
  } | null;
  sale_areas: { procedure_areas: { name: string } | null }[];
};

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET() {
  const supabase = createClient();
  const profile = await getCurrentProfile();

  if (!profile.isAdmin) {
    return NextResponse.json(
      { error: "Apenas o administrador pode exportar relatórios." },
      { status: 403 }
    );
  }

  const { data, error } = await supabase
    .from("sales")
    .select(
      "sale_date, amount, status, installments, procedures(name, segment), payment_methods(name), sellers(name), sale_areas(procedure_areas(name)), clients(name, cpf, phone, email, cep, logradouro, numero, complemento, bairro, cidade, uf)"
    )
    .order("sale_date", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const rows = (data ?? []) as unknown as Row[];

  const header = [
    "CPF", "Nome completo", "Telefone", "E-mail",
    "CEP", "Logradouro", "Número", "Complemento", "Bairro", "Cidade", "UF",
    "Data da venda", "Segmento", "Procedimento", "Áreas",
    "Valor", "Parcelas", "Pagamento", "Vendedora", "Status",
  ];

  const lines = rows.map((r) =>
    [
      formatCpf(r.clients?.cpf),
      r.clients?.name,
      r.clients?.phone,
      r.clients?.email,
      r.clients?.cep,
      r.clients?.logradouro,
      r.clients?.numero,
      r.clients?.complemento,
      r.clients?.bairro,
      r.clients?.cidade,
      r.clients?.uf,
      r.sale_date,
      r.procedures?.segment,
      r.procedures?.name,
      r.sale_areas.map((sa) => sa.procedure_areas?.name).filter(Boolean).join(" + "),
      Number(r.amount).toFixed(2).replace(".", ","),
      r.installments,
      r.payment_methods?.name,
      r.sellers?.name,
      r.status,
    ]
      .map(csvCell)
      .join(";")
  );

  const csv = "\uFEFF" + [header.map(csvCell).join(";"), ...lines].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="clientes-completo-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
