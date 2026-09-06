"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type InviteInfo = {
  email: string;
  role_name: string | null;
  unit_name: string | null;
};

export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [status, setStatus] = useState<"loading" | "valid" | "invalid">("loading");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function lookup() {
      const { data, error } = await supabase.rpc("get_invite_by_token", { p_token: token });

      if (error || !data || data.length === 0) {
        setStatus("invalid");
        return;
      }

      setInvite(data[0]);
      setStatus("valid");
    }

    lookup();
  }, [token, supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!invite) return;

    setError(null);
    setSubmitting(true);

    const { error } = await supabase.auth.signUp({
      email: invite.email,
      password,
      options: { data: { full_name: fullName } },
    });

    setSubmitting(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  if (status === "loading") {
    return <CenteredMessage text="Verificando convite..." />;
  }

  if (status === "invalid") {
    return (
      <CenteredMessage text="Este convite não é mais válido. Peça ao administrador para gerar um novo." />
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gold-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-gold-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 font-serif text-2xl text-ink-900">Bem-vindo à Laser Dream</h1>
        <p className="mb-6 text-sm text-ink-500">
          Convite para {invite?.role_name}
          {invite?.unit_name ? ` · ${invite.unit_name}` : ""}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-ink-700">E-mail</label>
            <input
              disabled
              value={invite?.email ?? ""}
              className="w-full rounded-md border border-gold-100 bg-gold-50 px-3 py-2 text-sm text-ink-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-ink-700" htmlFor="fullName">
              Nome completo
            </label>
            <input
              id="fullName"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-md border border-gold-200 px-3 py-2 text-sm outline-none focus:border-gold-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-ink-700" htmlFor="password">
              Crie uma senha
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-gold-200 px-3 py-2 text-sm outline-none focus:border-gold-500"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-gold-500 py-2 text-sm font-medium text-white transition hover:bg-gold-600 disabled:opacity-60"
          >
            {submitting ? "Criando conta..." : "Criar conta e entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}

function CenteredMessage({ text }: { text: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gold-50 px-4 text-center">
      <p className="text-sm text-ink-500">{text}</p>
    </div>
  );
}
