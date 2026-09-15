"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function DeletePasswordForm({
  organizationId,
  currentSenha,
  canEdit,
}: {
  organizationId: string;
  currentSenha: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [senha, setSenha] = useState(currentSenha);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!senha.trim()) return;
    setSaving(true);
    setMessage(null);
    const { error } = await supabase
      .from("org_settings")
      .update({ senha_exclusao_permanente: senha.trim() })
      .eq("organization_id", organizationId);
    setSaving(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Senha padrão atualizada.");
    router.refresh();
  }

  return (
    <form onSubmit={handleSave} className="rounded-lg border border-border bg-surface p-4">
      <p className="mb-1 text-sm font-medium text-foreground">Senha padrão para exclusão permanente</p>
      <p className="mb-3 text-xs text-muted-foreground">
        Exigida ao excluir uma venda de vez (só possível dentro do mês corrente). Guarde em lugar seguro.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          disabled={!canEdit}
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-gold-500 disabled:opacity-60"
        />
        {canEdit && (
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-gold-500 px-4 py-2 text-sm font-medium text-white hover:bg-gold-600 disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar senha"}
          </button>
        )}
      </div>
      {message && <p className="mt-2 text-xs text-gold-700 dark:text-gold-400">{message}</p>}
    </form>
  );
}
