import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";
import { buildBackupPayload } from "@/lib/backup";

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const profile = await getCurrentProfile();

  if (!profile.isAdmin) {
    return NextResponse.json(
      { error: "Apenas o administrador pode restaurar backups." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const backupId = body?.backupId as string | undefined;
  const confirm = body?.confirm as string | undefined;

  if (confirm !== "RESTAURAR") {
    return NextResponse.json(
      { error: "Digite RESTAURAR para confirmar. Nenhuma alteração foi feita." },
      { status: 400 }
    );
  }

  if (!backupId) {
    return NextResponse.json({ error: "Backup não informado." }, { status: 400 });
  }

  const { data: backupRow, error: backupError } = await supabase
    .from("backups")
    .select("storage_path")
    .eq("id", backupId)
    .single();

  if (backupError || !backupRow) {
    return NextResponse.json({ error: "Backup não encontrado." }, { status: 404 });
  }

  const { data: file, error: downloadError } = await supabase.storage
    .from("backups")
    .download(backupRow.storage_path);

  if (downloadError || !file) {
    return NextResponse.json(
      { error: downloadError?.message ?? "Não foi possível baixar o arquivo de backup." },
      { status: 400 }
    );
  }

  const payload = JSON.parse(await file.text());

  // Rede de segurança: salva o estado atual antes de sobrescrever.
  try {
    const safetyPayload = await buildBackupPayload(supabase, profile.organizationId);
    const safetyJson = JSON.stringify(safetyPayload);
    const stamp = safetyPayload.generated_at.replace(/[:.]/g, "-");
    const safetyPath = `${profile.organizationId}/pre-restauracao-${stamp}.json`;

    await supabase.storage
      .from("backups")
      .upload(safetyPath, safetyJson, { contentType: "application/json", upsert: false });

    await supabase.from("backups").insert({
      organization_id: profile.organizationId,
      storage_path: safetyPath,
      size_bytes: new TextEncoder().encode(safetyJson).length,
      kind: "automatico",
      created_by: profile.userId,
    });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível criar o backup de segurança antes de restaurar. Restauração cancelada por precaução." },
      { status: 500 }
    );
  }

  const { data: result, error: restoreError } = await supabase.rpc("restore_from_backup", {
    payload,
  });

  if (restoreError) {
    return NextResponse.json({ error: restoreError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, result });
}
