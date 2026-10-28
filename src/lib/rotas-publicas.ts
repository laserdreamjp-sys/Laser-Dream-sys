/**
 * Rotas que o middleware deixa passar sem sessão de usuário.
 *
 * - /login e /convite: telas anteriores ao login.
 * - /api/cron/*: chamadas do agendador da Vercel, que não tem sessão. Cada
 *   rota de cron confere sozinha o cabeçalho Authorization: Bearer CRON_SECRET
 *   e recusa (401) quem não tiver a senha. Sem esta exceção o middleware
 *   redirecionava o agendador para /login e o backup automático nunca rodava.
 */
export function rotaPublica(pathname: string): boolean {
  if (pathname.startsWith("/login") || pathname.startsWith("/convite")) return true;
  return pathname === "/api/cron" || pathname.startsWith("/api/cron/");
}
