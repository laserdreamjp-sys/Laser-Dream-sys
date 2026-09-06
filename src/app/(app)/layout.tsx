import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profileRaw } = await supabase
    .from("profiles")
    .select("full_name, roles(name)")
    .eq("id", user.id)
    .single();

  const profile = profileRaw as { full_name: string; roles: { name: string } | null } | null;

  const fullName = profile?.full_name ?? user.email ?? "";
  const roleName = profile?.roles?.name ?? "";

  return (
    <div className="flex bg-gold-50">
      <Sidebar fullName={fullName} roleName={roleName} />
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
