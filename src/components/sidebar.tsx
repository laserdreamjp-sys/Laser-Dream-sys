"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Menu,
  X,
  LayoutDashboard,
  ShoppingBag,
  Wallet,
  Users,
  Bell,
  UserCog,
  Settings,
  LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/vendas", label: "Vendas", icon: ShoppingBag },
  { href: "/caixa", label: "Caixa", icon: Wallet },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/solicitacoes", label: "Solicitações", icon: Bell },
  { href: "/usuarios", label: "Usuários", icon: UserCog },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

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

  function Logo() {
    return (
      <div className="flex items-center gap-2.5 px-1">
        <Image src="/icon.png" alt="" width={30} height={35} priority />
        <Image src="/wordmark-dark.png" alt="Laser Dream" width={132} height={21} priority />
      </div>
    );
  }

  function NavLinks() {
    return (
      <nav className="space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 rounded-md border-l-2 px-3 py-2 text-sm transition ${
                active
                  ? "border-gold-400 bg-white/[0.06] text-white"
                  : "border-transparent text-white/60 hover:border-white/20 hover:bg-white/[0.04] hover:text-white/90"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  function AccountBlock() {
    return (
      <div className="space-y-3 border-t border-white/10 pt-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold-500/20 text-xs font-medium text-gold-300">
            {initials(fullName)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm text-white">{fullName}</p>
            <p className="text-xs text-white/50">{roleName}</p>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <ThemeToggle className="text-white/60 hover:text-white" />
          <button
            onClick={handleLogout}
            aria-label="Sair"
            className="rounded-md p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Barra superior no celular */}
      <div className="flex items-center justify-between border-b border-white/10 bg-[#1B140C] px-4 py-3 md:hidden">
        <Logo />
        <button onClick={() => setOpen(true)} aria-label="Abrir menu" className="p-1 text-white/80">
          <Menu className="h-6 w-6" strokeWidth={1.75} />
        </button>
      </div>

      {/* Gaveta do celular */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="relative flex h-full w-72 max-w-[85%] flex-col justify-between bg-[#1B140C] px-4 py-6 shadow-xl">
            <button
              onClick={() => setOpen(false)}
              aria-label="Fechar menu"
              className="absolute right-3 top-3 p-1 text-white/60"
            >
              <X className="h-5 w-5" strokeWidth={1.75} />
            </button>
            <div>
              <div className="mb-8">
                <Logo />
              </div>
              <NavLinks />
            </div>
            <AccountBlock />
          </aside>
        </div>
      )}

      {/* Sidebar fixa em tablet e desktop */}
      <aside className="sticky top-0 hidden h-screen w-60 flex-col justify-between bg-[#1B140C] px-4 py-6 md:flex lg:w-64">
        <div>
          <div className="mb-9">
            <Logo />
          </div>
          <NavLinks />
        </div>
        <AccountBlock />
      </aside>
    </>
  );
}
