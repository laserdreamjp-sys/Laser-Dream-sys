import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { buildBackupPayload } from "@/lib/backup";

const RETENTION_DAYS = 30;
const ORGANIZATION_ID = "00000000-0000-0000-0000-000000000001";

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const supabase = createServiceClient();
  if (!supabase) {
    return NextResponse.json(
      {
        error:
          "SUPABASE_SERVICE_ROLE_KEY não está configurada nas variáveis de ambiente da Vercel. " +
          "O backup automático diário não pode rodar sem ela. O backup manual em Configurações continua funcionando normalmente.",
      },
      { status: 500 }
    );
  }

  try {
    const payload = await buildBackupPayload(supabase, ORGANIZATION_ID);
    const json = JSON.stringify(payload);
    const stamp = payload.generated_at.replace(/[:.]/g, "-");
    const path = `${ORGANIZATION_ID}/backup-${stamp}.json`;

    const { error: uploadError } = await supabase.storage
      .from("backups")
      .upload(path, json, { contentType: "application/json", upsert: false });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 400 });
    }

    await supabase.from("backups").insert({
      organization_id: ORGANIZATION_ID,
      storage_path: path,
      size_bytes: new TextEncoder().encode(json).length,
      kind: "automatico",
    });

    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data: old } = await supabase
      .from("backups")
      .select("id, storage_path")
      .lt("created_at", cutoff);

    if (old && old.length > 0) {
      await supabase.storage.from("backups").remove(old.map((b) => b.storage_path));
      await supabase
        .from("backups")
        .delete()
        .in("id", old.map((b) => b.id));
    }

    return NextResponse.json({ ok: true, path, removidos: old?.length ?? 0 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
