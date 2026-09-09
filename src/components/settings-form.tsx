"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Settings = {
  organization_id: string;
  radar_retorno_min: number;
  radar_retorno_max: number;
  radar_risco_dias: number;
  radar_frio_dias: number;
  radar_ativo_dias: number;
  recorrente_alerta: number;
  recorrente_limite: number;
  ticket_atencao: number;
  ticket_meta: number;
};

const FIELDS: { key: keyof Settings; label: string; hint: string; suffix: string }[] = [
  { key: "radar_retorno_min", label: "Início da janela de retorno", hint: "Dias após a última sessão de laser em que já faz sentido chamar o cliente de volta.", suffix: "dias" },
  { key: "radar_retorno_max", label: "Fim da janela de retorno", hint: "Depois disso o cliente sai de 'hora de voltar'.", suffix: "dias" },
  { key: "radar_risco_dias", label: "Vira risco de perda a partir de", hint: "Sem comprar por esse tempo, o cliente entra na fila de risco.", suffix: "dias" },
  { key: "radar_frio_dias", label: "Vira reativação fria a partir de", hint: "Acima disso, exige oferta mais forte para voltar.", suffix: "dias" },
  { key: "radar_ativo_dias", label: "Considerar cliente ativo até", hint: "Limite para entrar nas filas de cross-sell.", suffix: "dias" },
  { key: "recorrente_alerta", label: "Alerta de Boleto/Recorrente", hint: "Percentual do faturamento em que a barra fica amarela.", suffix: "%" },
  { key: "recorrente_limite", label: "Limite de Boleto/Recorrente", hint: "Percentual em que a barra fica vermelha.", suffix: "%" },
  { key: "ticket_atencao", label: "Ticket de atenção", hint: "Abaixo disso o farol da vendedora fica vermelho.", suffix: "R$" },
  { key: "ticket_meta", label: "Ticket meta", hint: "A partir disso o farol fica verde.", suffix: "R$" },
];

export function SettingsForm({ settings, canEdit }: { settings: Settings; canEdit: boolean }) {
  const router = useRouter();
  const supabase = createClient();
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(FIELDS.map((f) => [f.key, String(settings[f.key] ?? "")]))
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const payload = Object.fromEntries(FIELDS.map((f) => [f.key, Number(values[f.key])]));

    const { error } = await supabase
      .from("org_settings")
      .update(payload)
      .eq("organization_id", settings.organization_id);

    setSaving(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Configurações salvas. O Radar já usa os novos valores.");
    router.refresh();
  }

  return (
    <form onSubmit={handleSave} className="space-y-4 rounded-lg border border-border bg-surface p-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FIELDS.map((f) => (
          <label key={f.key} className="block text-sm">
            <span className="mb-1 block text-foreground">{f.label}</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="any"
                min={0}
                disabled={!canEdit}
                value={values[f.key]}
                onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-gold-500 disabled:opacity-60"
              />
              <span className="shrink-0 text-xs text-muted-foreground">{f.suffix}</span>
            </div>
            <span className="mt-1 block text-xs text-muted-foreground">{f.hint}</span>
          </label>
        ))}
      </div>

      {message && <p className="text-sm text-gold-700 dark:text-gold-400">{message}</p>}

      {canEdit && (
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-gold-500 px-5 py-2 text-sm font-medium text-white hover:bg-gold-600 disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Salvar parâmetros"}
        </button>
      )}
    </form>
  );
}
