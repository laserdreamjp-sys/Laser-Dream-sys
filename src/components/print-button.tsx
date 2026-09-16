"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-md bg-gold-500 px-4 py-2 text-sm font-medium text-white hover:bg-gold-600"
    >
      Gerar PDF
    </button>
  );
}
