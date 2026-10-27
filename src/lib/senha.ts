/**
 * Regras de senha forte usadas no cadastro por convite.
 * Devolve a mensagem do primeiro problema encontrado ou null se a senha serve.
 * A mesma regra precisa estar ligada no painel do Supabase (Auth) para valer
 * também no servidor.
 */
export const DICA_SENHA = "Mínimo de 8 caracteres, com letra maiúscula, letra minúscula e número.";

export function problemaSenha(senha: string): string | null {
  if (senha.length < 8) return "A senha precisa ter pelo menos 8 caracteres.";
  if (!/[a-z]/.test(senha)) return "A senha precisa ter ao menos uma letra minúscula.";
  if (!/[A-Z]/.test(senha)) return "A senha precisa ter ao menos uma letra maiúscula.";
  if (!/[0-9]/.test(senha)) return "A senha precisa ter ao menos um número.";
  return null;
}
