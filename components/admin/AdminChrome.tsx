"use client";

import { useCallback, useEffect, useState } from "react";

import Sidebar from "@/components/admin/Sidebar";
import TopBar from "@/components/admin/TopBar";
import { CommandPalette } from "@/components/admin/CommandPalette";
import { TooltipProvider } from "@/components/ui/tooltip";

const COLLAPSE_KEY = "admin:sidebar-collapsed";

// Interactive admin shell. Independent concerns:
//   • collapsed — desktop rail 72↔240, toggled by CLICK (persisted in localStorage).
//   • mobileOpen — off-canvas drawer < lg.
//   • paletteOpen — the ⌘K command palette (global shortcut).
export default function AdminChrome({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed]     = useState(false);
  const [mobileOpen, setMobileOpen]   = useState(false);
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

  const openMobile  = useCallback(() => setMobileOpen(true), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);
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

  // Crossing up to desktop forces the mobile drawer shut (else the scroll lock
  // would linger with no visible drawer). lg = 1024px.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => { if (mq.matches) setMobileOpen(false); };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return (
    // ONE TooltipProvider for the whole admin shell (no per-item nesting).
    <TooltipProvider delayDuration={300}>
      <div className="min-h-screen bg-background">
        <Sidebar
          collapsed={collapsed}
          onToggle={toggleCollapsed}
          mobileOpen={mobileOpen}
          onClose={closeMobile}
          onOpenSearch={openSearch}
        />

        <TopBar
          onMenuToggle={openMobile}
          sidebarWidth={sidebarWidth}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
          onOpenSearch={openSearch}
        />

        <main
          className="min-h-screen pt-16 transition-[margin] duration-300 lg:ml-(--sb-w)"
          style={{ "--sb-w": `${sidebarWidth}px` } as React.CSSProperties}
        >
          <div className="animate-fade-in p-6">{children}</div>
        </main>

        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      </div>
    </TooltipProvider>
  );
}
