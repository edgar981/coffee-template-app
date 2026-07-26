'use client';

import { useEffect, useState } from 'react';
import { ArrowUp, ArrowDown, X, RotateCcw } from 'lucide-react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DASHBOARD_WIDGETS, DEFAULT_WIDGET_KEYS, WIDGET_MAP,
  WIDGET_CATEGORIA_ORDER, WIDGET_CATEGORIA_LABEL,
} from '@/constants/dashboard-widgets';

// Dashboard layout editor. Two zones:
//   • "Tu panel" — the ordered VISIBLE widgets (this is the grid order), each with
//     ↑/↓ to reorder and ✕ to hide. Arrows (not drag) so it's keyboard-accessible
//     and deterministic.
//   • "Catálogo" — every widget grouped by categoría, each with a visibility
//     Switch. Turning one on appends it to your panel; off removes it.
// Edits live in a local draft; applying (Save, or closing the sheet) persists via
// the parent's onApply and the grid re-renders. Reset restores the registry
// default.

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Current visible widget keys, in order. */
  value: string[];
  /** Persist + re-render the grid with these keys. */
  onApply: (keys: string[]) => void;
}

export default function DashboardCustomizer({ open, onOpenChange, value, onApply }: Props) {
  const [draft, setDraft] = useState<string[]>(value);

  // Re-seed the draft from the live value each time the sheet opens, so a
  // discarded edit (closing is a save in this design, but re-opening still starts
  // from the persisted truth) never shows stale state.
  useEffect(() => { if (open) setDraft(value); }, [open, value]);

  const visibleSet = new Set(draft);

  const toggle = (key: string) =>
    setDraft((d) => (d.includes(key) ? d.filter((k) => k !== key) : [...d, key]));

  const move = (index: number, dir: -1 | 1) =>
    setDraft((d) => {
      const next = [...d];
      const target = index + dir;
      if (target < 0 || target >= next.length) return d;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  // Apply on close (per spec: closing OR Save persists) — only when it actually
  // changed, to avoid a needless write on a look-but-don't-touch open/close.
  const handleOpenChange = (next: boolean) => {
    if (!next && !sameOrder(draft, value)) onApply(draft);
    onOpenChange(next);
  };

  const save  = () => { onApply(draft); onOpenChange(false); };
  const reset = () => setDraft(DEFAULT_WIDGET_KEYS);

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border p-5">
          <SheetTitle>Personalizar panel</SheetTitle>
          <SheetDescription>
            Elige qué tarjetas ves y en qué orden. Tu selección se guarda solo para ti.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-6 p-5">
            {/* ── Tu panel (visibles, ordenados) ── */}
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Tu panel · {draft.length} {draft.length === 1 ? 'tarjeta' : 'tarjetas'}
              </h3>
              {draft.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                  Sin tarjetas. Actívalas desde el catálogo de abajo.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {draft.map((key, i) => {
                    const w = WIDGET_MAP[key];
                    if (!w) return null;
                    const Icon = w.icono;
                    return (
                      <li key={key} className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2">
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${w.color}`}>
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="flex-1 truncate text-sm font-medium">{w.titulo}</span>
                        <div className="flex items-center gap-0.5">
                          <IconBtn label="Subir"  disabled={i === 0}                 onClick={() => move(i, -1)}><ArrowUp className="h-3.5 w-3.5" /></IconBtn>
                          <IconBtn label="Bajar"  disabled={i === draft.length - 1}  onClick={() => move(i, 1)}><ArrowDown className="h-3.5 w-3.5" /></IconBtn>
                          <IconBtn label="Quitar" onClick={() => toggle(key)}><X className="h-3.5 w-3.5" /></IconBtn>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* ── Catálogo (agrupado por categoría) ── */}
            <section className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Catálogo</h3>
              {WIDGET_CATEGORIA_ORDER.map((cat) => {
                const widgets = DASHBOARD_WIDGETS.filter((w) => w.categoria === cat);
                if (widgets.length === 0) return null;
                return (
                  <div key={cat}>
                    <p className="mb-1.5 text-[11px] font-medium text-muted-foreground/80">{WIDGET_CATEGORIA_LABEL[cat]}</p>
                    <ul className="space-y-1">
                      {widgets.map((w) => {
                        const Icon = w.icono;
                        const on = visibleSet.has(w.key);
                        return (
                          <li key={w.key} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/40">
                            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${w.color}`}>
                              <Icon className="h-3.5 w-3.5" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{w.titulo}</p>
                              <p className="truncate text-xs text-muted-foreground">{w.subtitulo}</p>
                            </div>
                            <Switch checked={on} onCheckedChange={() => toggle(w.key)} aria-label={`Mostrar ${w.titulo}`} />
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </section>
          </div>
        </ScrollArea>

        <SheetFooter className="flex-row items-center justify-between gap-2 border-t border-border p-4">
          <Button variant="ghost" size="sm" onClick={reset} className="gap-1.5 text-xs">
            <RotateCcw className="h-3.5 w-3.5" /> Restablecer
          </Button>
          <Button size="sm" onClick={save}>Guardar</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function IconBtn({ label, disabled, onClick, children }: {
  label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function sameOrder(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((k, i) => k === b[i]);
}
