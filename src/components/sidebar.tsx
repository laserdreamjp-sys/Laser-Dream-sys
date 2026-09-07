"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/vendas", label: "Vendas" },
  { href: "/caixa", label: "Caixa" },
  { href: "/clientes", label: "Clientes" },
  { href: "/solicitacoes", label: "Solicitações" },
  { href: "/usuarios", label: "Usuários" },
  { href: "/configuracoes", label: "Configurações" },
];

export function Sidebar({ fullName, roleName }: { fullName: string; roleName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-screen w-56 flex-col justify-between border-r border-gold-100 bg-white px-4 py-6">
      <div>
        <h1 className="mb-8 font-serif text-xl text-ink-900">Laser Dream</h1>
        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-md px-3 py-2 text-sm transition ${
                  active
                    ? "bg-gold-100 text-gold-800"
                    : "text-ink-700 hover:bg-gold-50"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-gold-100 pt-4">
        <p className="text-sm font-medium text-ink-900">{fullName}</p>
        <p className="mb-3 text-xs text-ink-500">{roleName}</p>
        <button
          onClick={handleLogout}
          className="text-xs text-ink-500 underline underline-offset-2 hover:text-ink-900"
        >
          Sair
        </button>
      </div>
    </aside>
  );
}
