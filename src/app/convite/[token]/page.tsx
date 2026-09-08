"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
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
      const { data, error } = (await (supabase.rpc as any)("get_invite_by_token", {
        p_token: token,
      })) as { data: InviteInfo[] | null; error: unknown };

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
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center rounded-xl bg-[#1B140C] px-6 py-5">
          <Image src="/icon.png" alt="" width={34} height={39} priority />
          <Image src="/wordmark-dark.png" alt="Laser Dream" width={148} height={23} priority className="ml-2.5 self-center" />
        </div>

        <div className="rounded-lg border border-border bg-surface p-8 shadow-soft">
        <h1 className="mb-1 font-display font-semibold text-2xl text-foreground">Bem-vindo à Laser Dream</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Convite para {invite?.role_name}
          {invite?.unit_name ? ` · ${invite.unit_name}` : ""}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-foreground">E-mail</label>
            <input
              disabled
              value={invite?.email ?? ""}
              className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-foreground" htmlFor="fullName">
              Nome completo
            </label>
            <input
              id="fullName"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-gold-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-foreground" htmlFor="password">
              Crie uma senha
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-gold-500"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-gold-500 py-2.5 text-sm font-medium text-white transition hover:bg-gold-600 disabled:opacity-60"
          >
            {submitting ? "Criando conta..." : "Criar conta e entrar"}
          </button>
        </form>
        </div>
      </div>
    </div>
  );
}

function CenteredMessage({ text }: { text: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
