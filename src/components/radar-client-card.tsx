"use client";

import { useState } from "react";
import { MessageCircle, Copy, Check } from "lucide-react";

export type RadarClient = {
  client_id: string;
  name: string;
  phone: string | null;
  dias_desde_ultima: number | null;
  valor_total: number;
  total_compras: number;
  bucket: string;
};

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0];
}

function onlyDigits(phone: string) {
  return phone.replace(/\D/g, "");
}

function whatsappNumber(phone: string) {
  const digits = onlyDigits(phone);
  if (digits.startsWith("55")) return digits;
  return `55${digits}`;
}

export function suggestedMessage(bucket: string, name: string) {
  const nome = firstName(name);
  switch (bucket) {
    case "aniversariante":
      return `Oi, ${nome}! Passando aqui pra desejar um feliz aniversário. Separamos uma condição especial de presente pra você comemorar com a gente na Laser Dream. Posso te contar?`;
    case "risco_perda":
      return `Oi, ${nome}! Tudo bem? Faz um tempinho que a gente não te vê por aqui e ficamos com saudade. Quer que eu veja um horário pra você essa semana?`;
    case "reativacao_fria":
      return `Oi, ${nome}! Aqui é da Laser Dream. Faz um tempo que você não vem e queríamos te trazer de volta com uma condição especial. Posso te mostrar?`;
    case "hora_de_voltar":
      return `Oi, ${nome}! Já está no intervalo ideal pra sua próxima sessão. Quer que eu reserve um horário pra você?`;
    case "cross_estetica":
      return `Oi, ${nome}! Como você já faz laser com a gente, queria te apresentar nossos tratamentos de estética. Tem procedimento que combina muito com o seu perfil. Posso te explicar?`;
    case "cross_laser":
      return `Oi, ${nome}! Além dos tratamentos que você já faz, temos depilação a laser aqui na Laser Dream. Quer que eu te passe as condições?`;
    default:
      return `Oi, ${nome}! Tudo bem? Aqui é da Laser Dream.`;
  }
}

export function RadarClientCard({ client }: { client: RadarClient }) {
  const [copied, setCopied] = useState(false);
  const message = suggestedMessage(client.bucket, client.name);

  const waLink = client.phone
    ? `https://wa.me/${whatsappNumber(client.phone)}?text=${encodeURIComponent(message)}`
    : null;

  async function copyMessage() {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{client.name}</p>
        <p className="text-xs text-muted-foreground">
          {client.dias_desde_ultima !== null
            ? `${client.dias_desde_ultima} dias desde a última compra`
            : "Sem compra registrada"}
          {" · "}
          {formatCurrency(Number(client.valor_total))} em {client.total_compras}{" "}
          {client.total_compras === 1 ? "compra" : "compras"}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={copyMessage}
          title="Copiar mensagem sugerida"
          className="rounded-md border border-border p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </button>

        {waLink ? (
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-md bg-gold-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-gold-600"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            WhatsApp
          </a>
        ) : (
          <span className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground">
            Sem telefone
          </span>
        )}
      </div>
    </li>
  );
}
