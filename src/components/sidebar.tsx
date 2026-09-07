"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X } from "lucide-react";
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
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function NavLinks() {
    return (
      <nav className="space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`block rounded-md px-3 py-2 text-sm transition ${
                active ? "bg-gold-100 text-gold-800" : "text-ink-700 hover:bg-gold-50"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  function AccountBlock() {
    return (
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
    );
  }

  return (
    <>
      {/* Barra superior no celular */}
      <div className="flex items-center justify-between border-b border-gold-100 bg-white px-4 py-3 md:hidden">
        <h1 className="font-serif text-lg text-ink-900">Laser Dream</h1>
        <button onClick={() => setOpen(true)} aria-label="Abrir menu" className="p-1">
          <Menu className="h-6 w-6 text-ink-700" />
        </button>
      </div>

      {/* Gaveta do celular */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <aside className="relative flex h-full w-72 max-w-[85%] flex-col justify-between bg-white px-4 py-6 shadow-lg">
            <button
              onClick={() => setOpen(false)}
              aria-label="Fechar menu"
              className="absolute right-3 top-3 p-1"
            >
              <X className="h-5 w-5 text-ink-500" />
            </button>
            <div>
              <h1 className="mb-8 font-serif text-xl text-ink-900">Laser Dream</h1>
              <NavLinks />
            </div>
            <AccountBlock />
          </aside>
        </div>
      )}

      {/* Sidebar fixa em tablet e desktop */}
      <aside className="sticky top-0 hidden h-screen w-56 flex-col justify-between border-r border-gold-100 bg-white px-4 py-6 md:flex lg:w-64">
        <div>
          <h1 className="mb-8 font-serif text-xl text-ink-900">Laser Dream</h1>
          <NavLinks />
        </div>
        <AccountBlock />
      </aside>
    </>
  );
}
