import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";
import { buildBackupPayload } from "@/lib/backup";

export async function POST() {
  const supabase = createClient();
  const profile = await getCurrentProfile();

  if (!profile.isAdmin) {
    return NextResponse.json(
      { error: "Apenas o administrador pode gerar backups." },
      { status: 403 }
    );
  }

  try {
    const payload = await buildBackupPayload(supabase, profile.organizationId);
    const json = JSON.stringify(payload);
    const stamp = payload.generated_at.replace(/[:.]/g, "-");
    const path = `${profile.organizationId}/backup-${stamp}.json`;

    const { error: uploadError } = await supabase.storage
      .from("backups")
      .upload(path, json, { contentType: "application/json", upsert: false });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 400 });
    }

    const { error: rowError } = await supabase.from("backups").insert({
      organization_id: profile.organizationId,
      storage_path: path,
      size_bytes: new TextEncoder().encode(json).length,
      kind: "manual",
      created_by: profile.userId,
    });

    if (rowError) {
      return NextResponse.json({ error: rowError.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, path });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido ao gerar backup.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
