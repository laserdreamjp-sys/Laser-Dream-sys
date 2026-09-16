"use client";

import { useEffect, useState } from "react";
import { FlaskConical } from "lucide-react";

const CHAVE = "laser_dream_modo_teste";

export function isModoTesteAtivo(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(CHAVE) === "1";
}

export function TestModeToggle() {
  const [ativo, setAtivo] = useState(false);

  useEffect(() => {
    setAtivo(isModoTesteAtivo());
  }, []);

  function alternar() {
    const novo = !ativo;
    setAtivo(novo);
    window.localStorage.setItem(CHAVE, novo ? "1" : "0");
    window.dispatchEvent(new Event("modo-teste-mudou"));
  }

  return (
    <button
      onClick={alternar}
      className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
        ativo
          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
          : "text-muted-foreground hover:bg-muted"
      }`}
      title="Enquanto ligado, leads e orçamentos criados ficam marcados como teste e somem dos relatórios"
    >
      <FlaskConical className="h-4 w-4" strokeWidth={1.75} />
      Modo de teste {ativo ? "ligado" : "desligado"}
    </button>
  );
}
