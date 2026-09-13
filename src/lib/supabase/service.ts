import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente com a chave de serviço (bypassa RLS). Usado apenas pela rotina
 * automática de backup (/api/cron/backup), que roda sem sessão de usuário.
 * Nunca importar isso em código que responde a requisições de usuários finais.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;

  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
