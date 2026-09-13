/** Remove tudo que não é dígito. Retorna null se não sobrar nada. */
export function normalizeCpf(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}

/** Formata para exibição: 000.000.000-00 */
export function formatCpf(raw: string | null | undefined): string {
  if (!raw) return "";
  const d = raw.replace(/\D/g, "");
  if (d.length !== 11) return raw;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Máscara progressiva enquanto digita. */
export function maskCpf(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/**
 * Valida dígitos verificadores. Recusa sequências de dígito repetido
 * (111.111.111-11 e afins), que passam na fórmula mas são erro de digitação.
 * Mesma regra da função is_valid_cpf no banco.
 */
export function isValidCpf(raw: string | null): boolean {
  if (!raw) return true; // vazio é permitido: o campo é opcional
  const d = raw.replace(/\D/g, "");
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;

  const digits = d.split("").map(Number);

  let soma = 0;
  for (let i = 0; i < 9; i++) soma += digits[i] * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== digits[9]) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) soma += digits[i] * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== digits[10]) return false;

  return true;
}

export const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB",
  "PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
] as const;
