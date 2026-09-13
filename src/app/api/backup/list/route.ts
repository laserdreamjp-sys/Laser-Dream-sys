import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";

export async function GET() {
  const supabase = createClient();
  const profile = await getCurrentProfile();

  if (!profile.isAdmin) {
    return NextResponse.json(
      { error: "Apenas o administrador pode ver os backups." },
      { status: 403 }
    );
  }

  const { data, error } = await supabase
    .from("backups")
    .select("id, storage_path, size_bytes, kind, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const withUrls = await Promise.all(
    (data ?? []).map(async (b) => {
      const { data: signed } = await supabase.storage
        .from("backups")
        .createSignedUrl(b.storage_path, 60 * 10);
      return { ...b, download_url: signed?.signedUrl ?? null };
    })
  );

  return NextResponse.json({ backups: withUrls });
}
