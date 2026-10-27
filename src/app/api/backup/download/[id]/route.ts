import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";
import { nomeDoArquivoDeBackup } from "@/lib/backup";

/**
 * Entrega o arquivo de backup como anexo, pela própria origem do app.
 * O link assinado direto do Supabase fica em outro domínio e o navegador
 * pode abrir o JSON na tela em vez de baixar; aqui o cabeçalho
 * Content-Disposition: attachment e o tipo application/octet-stream
 * forçam o download. O arquivo é repassado em fluxo, sem carregar tudo na memória.
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const profile = await getCurrentProfile();

  if (!profile.isAdmin) {
    return NextResponse.json({ error: "Apenas o administrador pode baixar backups." }, { status: 403 });
  }

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

  const arquivo = await fetch(signed.signedUrl);
  if (!arquivo.ok || !arquivo.body) {
    return NextResponse.json({ error: "Não foi possível ler o arquivo de backup." }, { status: 502 });
  }

  const nome = nomeDoArquivoDeBackup(backup.storage_path);
  const headers = new Headers({
    "Content-Type": "application/octet-stream",
    "Content-Disposition": `attachment; filename="${nome}"; filename*=UTF-8''${encodeURIComponent(nome)}`,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  const tamanho = arquivo.headers.get("content-length");
  if (tamanho) headers.set("Content-Length", tamanho);

  return new Response(arquivo.body, { status: 200, headers });
}
