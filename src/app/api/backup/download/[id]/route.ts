import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";
import { nomeDoArquivoDeBackup } from "@/lib/backup";
import { criarRespostaDeBackup } from "@/lib/backup-resposta";

/**
 * Entrega o backup pela própria origem do app. Por padrão vai dentro de um
 * .zip (`?formato=zip`), que o Android salva e compartilha sem depender de
 * como o navegador trata .json; `?formato=json` devolve o JSON puro como anexo.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const profile = await getCurrentProfile();

  if (!profile.isAdmin) {
    return NextResponse.json({ error: "Apenas o administrador pode baixar backups." }, { status: 403 });
  }

  const formato = request.nextUrl.searchParams.get("formato") === "json" ? "json" : "zip";

  const { data: backup, error } = await supabase
    .from("backups")
    .select("storage_path")
    .eq("id", params.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!backup) {
    return NextResponse.json({ error: "Backup não encontrado." }, { status: 404 });
  }

  const { data: signed, error: signError } = await supabase.storage
    .from("backups")
    .createSignedUrl(backup.storage_path, 60);

  if (signError || !signed?.signedUrl) {
    return NextResponse.json(
      { error: signError?.message ?? "Não foi possível acessar o arquivo de backup." },
      { status: 400 }
    );
  }

  let bytes: Uint8Array;
  try {
    const arquivo = await fetch(signed.signedUrl);
    if (!arquivo.ok) {
      return NextResponse.json({ error: "Não foi possível ler o arquivo de backup." }, { status: 502 });
    }
    bytes = new Uint8Array(await arquivo.arrayBuffer());
  } catch {
    return NextResponse.json({ error: "Não foi possível ler o arquivo de backup." }, { status: 502 });
  }

  return criarRespostaDeBackup({ nome: nomeDoArquivoDeBackup(backup.storage_path), bytes, formato });
}
