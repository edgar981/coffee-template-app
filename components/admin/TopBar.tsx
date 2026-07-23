'use client';

import {
  Menu, Sun, Moon,
  User, Settings, LogOut, ChevronDown,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import NotificationBell from '@/components/admin/NotificationBell';
import { authClient } from '@/lib/auth-client';
import { getInitials } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TopBarProps {
  onMenuToggle: () => void;
  sidebarWidth: number | string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TopBar({ onMenuToggle, sidebarWidth }: TopBarProps) {
  const { theme, setTheme }         = useTheme();
  const router                      = useRouter();
  const menuRef                     = useRef<HTMLDivElement>(null);
  const [mounted, setMounted]       = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen]     = useState(false);
  const { data: session }           = authClient.useSession();
  const user                        = session?.user;

  // Avoid hydration mismatch for theme icon
  useEffect(() => { setMounted(true); }, []);

  // ⌘K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Close user menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    await authClient.signOut();
    router.push('/login');
  };

  const initials = getInitials(user?.name);
  const firstName = user?.name?.split(/\s+/)[0] ?? 'Usuario';

  return (
    <>
      <header
        className="fixed top-0 right-0 left-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur transition-[left] duration-300 lg:left-[var(--sb-w)]"
        style={{ "--sb-w": typeof sidebarWidth === "number" ? `${sidebarWidth}px` : sidebarWidth } as React.CSSProperties}
      >
        {/* Mobile menu toggle — opens the off-canvas drawer (< lg only) */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden cursor-pointer"
          onClick={onMenuToggle}
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <div className="ml-auto flex items-center gap-2">
          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="text-muted-foreground cursor-pointer"
          >
            {mounted ? (
              theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />
            ) : (
              <div className="h-4 w-4" />
            )}
          </Button>

          {/* Notifications */}
          <NotificationBell />

          {/* User menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-muted transition-colors"
            >
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <span className="text-xs font-semibold text-primary">{initials}</span>
              </div>
              <span className="hidden sm:block text-xs font-medium text-foreground max-w-20 truncate">
                {firstName}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-11 w-56 bg-card border border-border rounded-2xl shadow-xl z-50 py-1 overflow-hidden">
                {/* User info */}
                <div className="px-4 py-3 border-b border-border">
                  <p className="text-sm font-semibold text-foreground truncate">{user?.name ?? 'Usuario'}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>

                {/* Links */}
                <div className="py-1">
                  <Link
                    href="/admin/perfil"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                  >
                    <User className="w-4 h-4 text-muted-foreground" /> Mi perfil
                  </Link>
                  <Link
                    href="/admin/configuracion"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                  >
                    <Settings className="w-4 h-4 text-muted-foreground" /> Configuración
                  </Link>
                </div>

                {/* Logout */}
                <div className="border-t border-border py-1">
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <LogOut className="w-4 h-4" /> Cerrar sesión
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
}