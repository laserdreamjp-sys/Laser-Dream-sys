import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Laser Dream OS",
  description: "Gestão de vendas e caixa da Laser Dream",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
