import { createClient } from "@/lib/supabase/server";
import { RadarClientCard, type RadarClient } from "@/components/radar-client-card";

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const BUCKETS: {
  key: string;
  title: string;
  description: string;
  tone: "urgent" | "warm" | "neutral";
}[] = [
  {
    key: "risco_perda",
    title: "Risco de perda",
    description: "Compraram, gostaram, e sumiram entre 3 e 6 meses. É aqui que o dinheiro escapa em silêncio.",
    tone: "urgent",
  },
  {
    key: "hora_de_voltar",
    title: "Hora de voltar",
    description: "Estão no intervalo ideal para a próxima sessão de laser. Ligar agora é aproveitar o timing.",
    tone: "warm",
  },
  {
    key: "aniversariante",
    title: "Aniversariantes do mês",
    description: "Motivo pronto para um contato afetivo, sem parecer venda.",
    tone: "warm",
  },
  {
    key: "cross_estetica",
    title: "Oferecer estética",
    description: "Clientes ativos de laser que nunca fizeram um procedimento estético.",
    tone: "neutral",
  },
  {
    key: "cross_laser",
    title: "Oferecer laser",
    description: "Clientes ativos de estética que nunca fizeram depilação a laser.",
    tone: "neutral",
  },
  {
    key: "reativacao_fria",
    title: "Reativação fria",
    description: "Mais de 6 meses sem voltar. Exige oferta forte, mas a base já conhece a casa.",
    tone: "neutral",
  },
];

export default async function RadarPage() {
  const supabase = createClient();

  const { data } = await supabase
    .from("client_intelligence")
    .select("client_id, name, phone, dias_desde_ultima, valor_total, total_compras, bucket")
    .order("valor_total", { ascending: false });

  const clients = (data ?? []) as unknown as RadarClient[];

  const byBucket = new Map<string, RadarClient[]>();
  for (const c of clients) {
    byBucket.set(c.bucket, [...(byBucket.get(c.bucket) ?? []), c]);
  }

  const emRisco = [
    ...(byBucket.get("risco_perda") ?? []),
    ...(byBucket.get("reativacao_fria") ?? []),
  ];
  const receitaEmRisco = emRisco.reduce((acc, c) => acc + Number(c.valor_total), 0);
  const ticketMedioBase =
    clients.length > 0
      ? clients.reduce((acc, c) => acc + Number(c.valor_total), 0) /
        Math.max(clients.filter((c) => c.total_compras > 0).length, 1)
      : 0;

  const totalOportunidades = BUCKETS.reduce(
    (acc, b) => acc + (byBucket.get(b.key)?.length ?? 0),
    0
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display font-semibold text-2xl text-foreground">Radar de oportunidades</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A base de clientes lida como fila de trabalho: quem contatar hoje, por quê, e com qual mensagem.
          </p>
        </div>
        <a
          href="/api/relatorios/radar"
          className="rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-muted"
        >
          Baixar lista (CSV)
        </a>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-5 shadow-soft">
          <p className="mb-1 text-xs text-muted-foreground">Contatos sugeridos hoje</p>
          <p className="font-display text-2xl font-semibold text-gold-600 dark:text-gold-400">
            {totalOportunidades}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-5 shadow-soft">
          <p className="mb-1 text-xs text-muted-foreground">Clientes esfriando ou perdidos</p>
          <p className="font-display text-2xl font-semibold text-gold-600 dark:text-gold-400">
            {emRisco.length}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-5 shadow-soft">
          <p className="mb-1 text-xs text-muted-foreground">Já gastaram (base em risco)</p>
          <p className="font-display text-2xl font-semibold text-destructive">
            {formatCurrency(receitaEmRisco)}
          </p>
        </div>
      </div>

      {ticketMedioBase > 0 && emRisco.length > 0 && (
        <div className="rounded-lg border border-gold-300 bg-gold-50 p-4 text-sm text-gold-800 dark:border-gold-700 dark:bg-gold-900/30 dark:text-gold-200">
          Trazer de volta {Math.ceil(emRisco.length * 0.2)} desses clientes (20% da lista) representaria
          cerca de {formatCurrency(Math.ceil(emRisco.length * 0.2) * ticketMedioBase)} em receita,
          usando o ticket médio histórico da base.
        </div>
      )}

      {BUCKETS.map((bucket) => {
        const list = byBucket.get(bucket.key) ?? [];
        if (list.length === 0) return null;

        const accent =
          bucket.tone === "urgent"
            ? "border-l-destructive"
            : bucket.tone === "warm"
            ? "border-l-gold-400"
            : "border-l-border";

        return (
          <section key={bucket.key}>
            <div className={`mb-3 border-l-2 pl-3 ${accent}`}>
              <h3 className="text-sm font-medium text-foreground">
                {bucket.title}{" "}
                <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {list.length}
                </span>
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">{bucket.description}</p>
            </div>
            <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
              {list.map((c) => (
                <RadarClientCard key={c.client_id} client={c} />
              ))}
            </ul>
          </section>
        );
      })}

      {totalOportunidades === 0 && (
        <div className="rounded-lg border border-border bg-surface p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhuma oportunidade no radar por enquanto. Conforme as vendas forem sendo registradas, esta
            tela passa a apontar quem contatar.
          </p>
        </div>
      )}
    </div>
  );
}
