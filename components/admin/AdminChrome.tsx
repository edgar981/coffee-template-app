"use client";

import { useCallback, useEffect, useState } from "react";

import Sidebar from "@/components/admin/Sidebar";
import TopBar from "@/components/admin/TopBar";
import { CommandPalette } from "@/components/admin/CommandPalette";
import { MobileNav } from "@/components/admin/MobileNav";
import { TooltipProvider } from "@/components/ui/tooltip";

const COLLAPSE_KEY = "admin:sidebar-collapsed";

// Interactive admin shell. Independent concerns:
//   • collapsed — rail de escritorio 72↔240, por CLICK (persistido en localStorage).
//   • paletteOpen — la paleta ⌘K (atajo global).
//
// `mobileOpen` YA NO EXISTE. El drawer off-canvas murió con la tanda de móvil: la
// navegación en angosto es `MobileNav` (barra inferior + sheet), y con él se fue
// también el efecto que forzaba su cierre al cruzar a escritorio — existía sólo
// para que el bloqueo de scroll hecho a mano no quedara colgado sin drawer visible.
// Una pieza menos que sincronizar en el cruce del breakpoint.
export default function AdminChrome({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed]     = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const sidebarWidth = collapsed ? 72 : 240;

  // Persisted collapse preference. Read post-mount (client-only) to avoid a
  // hydration mismatch; the width transition makes the one-time settle smooth.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydrate from localStorage (client-only, can't read during SSR)
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "true");
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(COLLAPSE_KEY, String(next)); } catch { /* private mode — non-fatal */ }
      return next;
    });
  }, []);

  const openSearch  = useCallback(() => setPaletteOpen(true), []);

  // Global ⌘K / Ctrl+K → toggle palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    // ONE TooltipProvider for the whole admin shell (no per-item nesting).
    <TooltipProvider delayDuration={300}>
      <div className="min-h-screen bg-background">
        <Sidebar
          collapsed={collapsed}
          onToggle={toggleCollapsed}
          onOpenSearch={openSearch}
        />

        <TopBar
          sidebarWidth={sidebarWidth}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
          onOpenSearch={openSearch}
        />

        <main
          className="min-h-screen pt-16 transition-[margin] duration-300 duna:ml-(--sb-w)"
          style={{ "--sb-w": `${sidebarWidth}px` } as React.CSSProperties}
        >
          {/* `duna-nav-hueco` reserva el alto de la barra inferior al final del
              contenido, y sólo por debajo del breakpoint. Va acá y no en cada
              pantalla porque lo que queda tapado sin él es el FINAL de la lista —
              la parte a la que se llega scrolleando, o sea la que ya costó
              alcanzar— y el que agregue una pantalla nueva no se va a acordar. */}
          <div className="animate-fade-in duna-nav-hueco p-6">{children}</div>
        </main>

        {/* La navegación de angosto. Se monta siempre y se muestra sola: su
            `display` lo decide el sistema en el mismo breakpoint que retira el
            rail, así que no hay un `esMovil` en JS que pueda desincronizarse del
            CSS que esconde el rail. */}
        <MobileNav />

        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      </div>
    </TooltipProvider>
  );
}
