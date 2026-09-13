"use client";

import { useEffect, useState } from "react";

type Backup = {
  id: string;
  storage_path: string;
  size_bytes: number | null;
  kind: string;
  created_at: string;
  download_url: string | null;
};

function formatSize(bytes: number | null) {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("pt-BR");
}

export function BackupPanel() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [restoreTarget, setRestoreTarget] = useState<Backup | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [restoring, setRestoring] = useState(false);

  async function loadBackups() {
    setLoading(true);
    const res = await fetch("/api/backup/list");
    const data = await res.json();
    setBackups(data.backups ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadBackups();
  }, []);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/backup/generate", { method: "POST" });
    const data = await res.json();
    setGenerating(false);
    if (!res.ok) {
      setError(data.error ?? "Erro ao gerar backup.");
      return;
    }
    setMessage("Backup gerado com sucesso.");
    loadBackups();
  }

  async function handleRestore() {
    if (!restoreTarget) return;
    setRestoring(true);
    setError(null);
    const res = await fetch("/api/backup/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ backupId: restoreTarget.id, confirm: confirmText }),
    });
    const data = await res.json();
    setRestoring(false);
    if (!res.ok) {
      setError(data.error ?? "Erro ao restaurar backup.");
      return;
    }
    setMessage("Restauração concluída. A página será recarregada.");
    setRestoreTarget(null);
    setConfirmText("");
    setTimeout(() => window.location.reload(), 1500);
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">Backup</p>
          <p className="text-xs text-muted-foreground">
            Gera uma cópia de todos os dados de negócio (clientes, vendas, catálogos e
            configurações). Guardado por 30 dias.
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="rounded-md bg-gold-500 px-4 py-2 text-sm font-medium text-white hover:bg-gold-600 disabled:opacity-60"
        >
          {generating ? "Gerando..." : "Gerar backup agora"}
        </button>
      </div>

      {message && <p className="text-sm text-gold-700 dark:text-gold-400">{message}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Tamanho</th>
              <th className="px-3 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {backups.map((b) => (
              <tr key={b.id} className="border-t border-border">
                <td className="px-3 py-2 whitespace-nowrap">{formatDate(b.created_at)}</td>
                <td className="px-3 py-2">
                  {b.kind === "automatico" ? "Automático" : "Manual"}
                </td>
                <td className="px-3 py-2">{formatSize(b.size_bytes)}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-3">
                    {b.download_url && (
                      <a
                        href={b.download_url}
                        className="text-xs text-gold-700 underline underline-offset-2 dark:text-gold-400"
                      >
                        Baixar
                      </a>
                    )}
                    <button
                      onClick={() => {
                        setRestoreTarget(b);
                        setConfirmText("");
                        setError(null);
                      }}
                      className="text-xs text-destructive underline underline-offset-2"
                    >
                      Restaurar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && backups.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                  Nenhum backup gerado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {restoreTarget && (
        <div className="rounded-md border border-destructive bg-destructive/5 p-4 space-y-3">
          <p className="text-sm font-medium text-destructive">
            Restaurar o backup de {formatDate(restoreTarget.created_at)}?
          </p>
          <p className="text-xs text-muted-foreground">
            Isso substitui clientes, vendas, catálogos e configurações pelo estado salvo nesse
            backup. Antes de restaurar, o sistema salva automaticamente um backup do estado atual,
            para o caso de ser necessário desfazer. Digite <strong>RESTAURAR</strong> para
            confirmar.
          </p>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="RESTAURAR"
            className="w-full max-w-xs rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={handleRestore}
              disabled={confirmText !== "RESTAURAR" || restoring}
              className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {restoring ? "Restaurando..." : "Confirmar restauração"}
            </button>
            <button
              onClick={() => setRestoreTarget(null)}
              className="rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-muted"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
