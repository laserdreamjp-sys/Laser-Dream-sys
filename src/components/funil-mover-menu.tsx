"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { FunilStage } from "@/components/funil-card";

/**
 * Botão "Mover ▾" da visão Lista: abre as etapas do funil e chama `onEscolher` com a etapa de destino.
 * Quem chama decide o que fazer (inclusive pedir o motivo quando a etapa é de perda).
 * Fecha com Esc, ao tocar fora e depois de escolher.
 */
export function FunilMoverMenu({
  stages,
  currentStageId,
  disabled,
  onEscolher,
}: {
  stages: FunilStage[];
  currentStageId: string;
  disabled?: boolean;
  onEscolher: (stageId: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!aberto) return;

    function aoTocarFora(e: PointerEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setAberto(false);
    }
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        setAberto(false);
        botaoRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", aoTocarFora);
    document.addEventListener("keydown", aoTeclar);
    // foca a primeira etapa disponível para quem usa teclado
    menuRef.current?.querySelector<HTMLButtonElement>("button:not([disabled])")?.focus();

    return () => {
      document.removeEventListener("pointerdown", aoTocarFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  function navegarComSetas(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const itens = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") ?? []);
    if (itens.length === 0) return;
    const atual = itens.indexOf(document.activeElement as HTMLButtonElement);
    const proximo = e.key === "ArrowDown" ? (atual + 1) % itens.length : (atual - 1 + itens.length) % itens.length;
    itens[proximo]?.focus();
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={botaoRef}
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={aberto ? menuId : undefined}
        onClick={() => setAberto((v) => !v)}
        className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50"
      >
        Mover ▾
      </button>

      {aberto && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="Mover para a etapa"
          onKeyDown={navegarComSetas}
          className="absolute right-0 top-full z-30 mt-1 max-h-72 w-56 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-md border border-border bg-surface p-1 shadow-soft"
        >
          {stages.map((s) => {
            const atual = s.id === currentStageId;
            return (
              <button
                key={s.id}
                type="button"
                role="menuitem"
                disabled={atual}
                onClick={() => {
                  setAberto(false);
                  onEscolher(s.id);
                }}
                className={`flex w-full items-center justify-between gap-2 rounded px-2.5 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 ${
                  atual
                    ? "cursor-default font-medium text-gold-700 dark:text-gold-400"
                    : s.is_lost
                      ? "text-destructive hover:bg-muted"
                      : "text-foreground hover:bg-muted"
                }`}
              >
                <span className="break-words">{s.name}</span>
                {atual && <span className="shrink-0 text-[10px] uppercase">atual</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
