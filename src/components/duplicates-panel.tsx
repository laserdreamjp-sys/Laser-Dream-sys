"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type ClienteFlag = {
  id: string;
  kind: "cliente";
  record_a: string;
  record_b: string;
  similarity: number;
  detail: { nome_a: string; nome_b: string; telefone_a: string | null; telefone_b: string | null };
};
type VendaFlag = {
  id: string;
  kind: "venda";
  record_a: string;
  record_b: string;
  similarity: number;
  detail: {
    cliente: string;
    data_a: string;
    data_b: string;
    valor: number;
    vendedora_a: string | null;
    vendedora_b: string | null;
    mesma_vendedora: boolean;
  };
};
type Flag = ClienteFlag | VendaFlag;

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR");
}
function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function DuplicatesPanel({ flags: initialFlags }: { flags: Flag[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [flags, setFlags] = useState(initialFlags);
  const [scanning, setScanning] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const clientFlags = flags.filter((f): f is ClienteFlag => f.kind === "cliente");
  const saleFlags = (flags.filter((f): f is VendaFlag => f.kind === "venda")).sort(
    (a, b) => Number(b.detail.mesma_vendedora) - Number(a.detail.mesma_vendedora)
  );

  async function handleScan() {
    setScanning(true);
    await supabase.rpc("scan_duplicates");
    setScanning(false);
    router.refresh();
  }

  async function discard(id: string) {
    setBusyId(id);
    await supabase.from("duplicate_flags").update({ status: "descartado" }).eq("id", id);
    setFlags((prev) => prev.filter((f) => f.id !== id));
    setBusyId(null);
  }

  async function unifyClients(flag: ClienteFlag) {
    if (!confirm(`Unificar "${flag.detail.nome_a}" e "${flag.detail.nome_b}"? As compras do segundo migram para o primeiro, e o registro duplicado é removido.`))
      return;
    setBusyId(flag.id);

    await supabase.from("sales").update({ client_id: flag.record_a }).eq("client_id", flag.record_b);
    await supabase.from("opportunities").update({ client_id: flag.record_a }).eq("client_id", flag.record_b);
    await supabase.from("clients").delete().eq("id", flag.record_b);
    await supabase.from("duplicate_flags").update({ status: "confirmado" }).eq("id", flag.id);

    setFlags((prev) => prev.filter((f) => f.id !== flag.id));
    setBusyId(null);
    router.refresh();
  }

  async function cancelSaleB(flag: VendaFlag) {
    if (!confirm("Cancelar a segunda venda deste par? O histórico é preservado, só o status muda para cancelada."))
      return;
    setBusyId(flag.id);

    await supabase.from("sales").update({ status: "cancelada" }).eq("id", flag.record_b);
    await supabase.from("duplicate_flags").update({ status: "confirmado" }).eq("id", flag.id);

    setFlags((prev) => prev.filter((f) => f.id !== flag.id));
    setBusyId(null);
    router.refresh();
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Duplicidades ({flags.length})
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Nunca decide sozinho: mostra os dados encontrados e espera você confirmar ou descartar.
          </p>
        </div>
        <button
          onClick={handleScan}
          disabled={scanning}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-muted disabled:opacity-60"
        >
          {scanning ? "Varrendo..." : "Rodar varredura agora"}
        </button>
      </div>

      {clientFlags.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Clientes parecidos</p>
          <div className="space-y-2">
            {clientFlags.map((f) => (
              <div key={f.id} className="rounded-md border border-border bg-surface p-3 text-sm">
                <p className="text-foreground">
                  <span className="font-medium">{f.detail.nome_a}</span>
                  {f.detail.telefone_a && ` (${f.detail.telefone_a})`} vs.{" "}
                  <span className="font-medium">{f.detail.nome_b}</span>
                  {f.detail.telefone_b && ` (${f.detail.telefone_b})`}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {(f.similarity * 100).toFixed(0)}% parecido
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => unifyClients(f)}
                    disabled={busyId === f.id}
                    className="rounded-md bg-gold-500 px-3 py-1 text-xs font-medium text-white hover:bg-gold-600 disabled:opacity-60"
                  >
                    Unificar (é a mesma pessoa)
                  </button>
                  <button
                    onClick={() => discard(f.id)}
                    disabled={busyId === f.id}
                    className="rounded-md border border-border px-3 py-1 text-xs text-foreground hover:bg-muted"
                  >
                    São pessoas diferentes
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {saleFlags.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Vendas parecidas</p>
          <div className="space-y-2">
            {saleFlags.map((f) => (
              <div
                key={f.id}
                className={`rounded-md border p-3 text-sm ${
                  f.detail.mesma_vendedora ? "border-destructive bg-destructive/5" : "border-border bg-surface"
                }`}
              >
                <p className="text-foreground">
                  <span className="font-medium">{f.detail.cliente}</span> ·{" "}
                  {formatCurrency(Number(f.detail.valor))} · {formatDate(f.detail.data_a)}
                  {f.detail.data_a !== f.detail.data_b ? ` e ${formatDate(f.detail.data_b)}` : ""}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Vendedoras: {f.detail.vendedora_a ?? "-"} e {f.detail.vendedora_b ?? "-"}
                  {f.detail.mesma_vendedora && (
                    <span className="ml-2 font-medium text-destructive">
                      mesma vendedora nas duas — atenção
                    </span>
                  )}
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => cancelSaleB(f)}
                    disabled={busyId === f.id}
                    className="rounded-md bg-destructive px-3 py-1 text-xs font-medium text-white disabled:opacity-60"
                  >
                    Cancelar a segunda (é duplicata)
                  </button>
                  <button
                    onClick={() => discard(f.id)}
                    disabled={busyId === f.id}
                    className="rounded-md border border-border px-3 py-1 text-xs text-foreground hover:bg-muted"
                  >
                    São vendas legítimas (ex.: dupla)
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {flags.length === 0 && (
        <p className="rounded-md border border-border bg-surface px-4 py-6 text-center text-sm text-muted-foreground">
          Nenhuma duplicidade pendente de revisão.
        </p>
      )}
    </section>
  );
}
