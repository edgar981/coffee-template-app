'use client';

import { useEffect, useState } from 'react';
import { ArrowUp, ArrowDown, X, RotateCcw } from 'lucide-react';
import { DunaSheet } from '@/components/admin/DunaSheet';
import { Switch } from '@/components/ui/switch';
import {
  DASHBOARD_WIDGETS, DEFAULT_WIDGET_KEYS, WIDGET_MAP,
  WIDGET_CATEGORIA_ORDER, WIDGET_CATEGORIA_LABEL,
} from '@/constants/dashboard-widgets';

// Editor del layout del dashboard, en el DunaSheet lateral —la misma superficie que
// los otros form-sheets del panel y el detalle de pedido, así que se lee como el
// panel (§ CLAUDE.md: el shadcn Sheet portaleaba a <body>, fuera de `.admin-shell`, y
// caía en la fuente por defecto del navegador; el DunaSheet portalea al shell y hereda
// Hanken). Dos zonas:
//   • "Tu panel" — los indicadores VISIBLES ordenados (el orden del grid), cada uno
//     con ↑/↓ para reordenar y ✕ para ocultar. Flechas, no drag: accesible por teclado
//     y determinista.
//   • "Catálogo" — cada widget agrupado por categoría, con un Switch de visibilidad.
//
// CERRAR = GUARDAR, y NO es un descuido: este NO es un formulario con mutación en
// vuelo, es un editor de PREFERENCIAS que persiste el layout al cerrar. Por eso:
//   • NO usa `useDescarteDeDrawer` —eso pregunta "¿descartar?" y descarta al cerrar,
//     la conducta OPUESTA— ni `useAccionGuardada` —no hay submit que bloquear—. Si
//     alguien "unifica" agregando la guarda de descarte, ROMPE la conducta correcta:
//     cerrar dejaría de guardar.
//   • NO tiene botón "Guardar", y NO se repone "por consistencia con los otros
//     drawers": aquí la consistencia sería el error. Un "Guardar" MIENTE sobre el
//     modelo —implica que nada se aplica hasta clicarlo, cuando se aplica al cerrar de
//     cualquier forma— y sería un segundo camino al mismo hecho que `onCerrar`. La
//     confirmación de que se guardó es el panel de atrás cambiando al layout nuevo al
//     cerrar.
// La persistencia es optimista (`onApply`), con "Reintentar" en el toast del padre si
// falla. Los edits viven en un `draft` local; aplicar (cerrar tocando fuera o con
// Escape) persiste y el grid se re-renderiza.

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

  // Re-siembra el draft desde el value en vivo en cada apertura, para que un draft
  // anterior nunca muestre estado rancio (cerrar guarda, pero re-abrir parte de la
  // verdad persistida).
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

  // Persistir sólo si cambió, para no escribir en un abrir/cerrar sin tocar nada.
  const persistirSiCambio = () => { if (!sameOrder(draft, value)) onApply(draft); };
  // Cerrar = GUARDAR (auto-save al salir; no hay un "Guardar" explícito porque la
  // confirmación es el panel cambiando detrás). Lo usan las TRES salidas: el botón
  // "Listo", el clic-fuera y Escape (los dos últimos vía `onCerrar` de Radix). "Listo"
  // es prop-driven, así que no re-dispara `onCerrar` — se persiste una sola vez por
  // cierre. El botón es la salida DESCUBRIBLE: en un teléfono el sheet --lado no deja
  // scrim que tocar ni hay tecla Escape, así que clic-fuera dejaba al operador ATRAPADO
  // (defecto de producción). El carril de scrim de la primitiva garantiza que clic-fuera
  // EXISTA; "Listo" garantiza que se VEA.
  const cerrar = () => { persistirSiCambio(); onOpenChange(false); };
  const reset  = () => setDraft(DEFAULT_WIDGET_KEYS);

  return (
    <DunaSheet
      abierto={open}
      onCerrar={cerrar}
      anclaje="lado"
      titulo="Personalizar panel"
      descripcion="Elige qué indicadores ves y en qué orden. Tu selección se guarda solo para ti."
    >
      <div className="duna-modal__head">
        <div className="duna-title">Personalizar panel</div>
        <p className="duna-sub">Elige qué indicadores ves y en qué orden. Tu selección se guarda solo para ti.</p>
      </div>

      <div className="duna-modal__body space-y-6">
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
                // ELEGIDO = el par superficie+barra-de-tinta del activo del rail
                // (§ CLAUDE.md): --duna-surface + --duna-shadow-1 + una barra de 2px de
                // --duna-ink a la izquierda. Mismo significado ("esto está puesto") y
                // misma forma. NO es color de estado: la tinta no compite con sol
                // (atención) ni bad (problema). `pl-3.5` da aire entre la barra y el
                // ícono; las flechas y la × viven a la DERECHA, lejos de la barra.
                return (
                  <li key={key} className="relative flex items-center gap-2 rounded-lg border border-border bg-card pl-3.5 pr-2.5 py-2" style={{ boxShadow: 'var(--duna-shadow-1)' }}>
                    <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full" style={{ background: 'var(--duna-ink)' }} aria-hidden />
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

      <div className="duna-modal__foot">
        {/* Restablecer (ghost, IZQUIERDA con `mr-auto`) · "Listo" (primario, derecha).
            "Listo" y no "Cerrar"/"Guardar": cerrar GUARDA, así que "Cerrar" callaría que
            se conserva y "Guardar" reintroduciría el gesto que el diseño quitó. Es la
            salida explícita que faltaba en móvil (§ el comentario de `cerrar`). El foot es
            `justify-content:flex-end`; `mr-auto` empuja Restablecer al borde izquierdo,
            igual que los form-sheets empujan su aviso con `.duna-modal__aviso`. */}
        <button type="button" className="duna-btn duna-btn--ghost mr-auto" onClick={reset}>
          <RotateCcw className="h-3.5 w-3.5" /> Restablecer
        </button>
        <button type="button" className="duna-btn duna-btn--primary" onClick={cerrar}>
          Listo
        </button>
      </div>
    </DunaSheet>
  );
}

function IconBtn({ label, disabled, onClick, children }: {
  label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode;
}) {
  // `admin-foco`: anillo de foco de teclado (box-shadow var(--duna-ring)) VISIBLE sobre
  // la superficie elevada de la tarjeta — la sombra del `li` es de otro elemento, no lo tapa.
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="admin-foco flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function sameOrder(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((k, i) => k === b[i]);
}
