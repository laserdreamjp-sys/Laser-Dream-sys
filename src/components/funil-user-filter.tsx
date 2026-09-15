"use client";

import { useRouter } from "next/navigation";

export function FunilUserFilter({
  funnelId,
  currentUsuario,
  usuarios,
}: {
  funnelId: string;
  currentUsuario: string;
  usuarios: { id: string; full_name: string }[];
}) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-muted-foreground">Ver leads de:</label>
      <select
        defaultValue={currentUsuario}
        onChange={(e) => {
          const params = new URLSearchParams();
          params.set("funil", funnelId);
          if (e.target.value) params.set("usuario", e.target.value);
          router.push(`/funil?${params.toString()}`);
        }}
        className="rounded-md border border-border bg-background px-2 py-1 text-xs"
      >
        <option value="">Todo mundo</option>
        {usuarios.map((u) => (
          <option key={u.id} value={u.id}>
            {u.full_name}
          </option>
        ))}
      </select>
    </div>
  );
}
