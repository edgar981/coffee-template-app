'use client';

import type { ComponentType } from 'react';
import { LayoutList, Palette, Image as ImageIcon, HelpCircle } from 'lucide-react';

// EL RIEL (§ EDITOR-TIENDA-SHELL-1, REDISENO.md § 3): Secciones · Estilo · Medios. Reemplaza al pill
// «Tema» que vivía dentro del tablist de página (§ EditorTiendaPantallaCompleta.tsx) — «Estilo» deja
// de ser una PESTAÑA de la misma fila que las páginas y pasa a ser una HERRAMIENTA, con su propio
// carril a la izquierda del panel, gemelo del rail de Duna OS (`components/admin/Sidebar.tsx`,
// `NavRow`): activo = superficie elevada + barra de TINTA a la izquierda — el sol no marca posición
// (§ CLAUDE.md, Amber Minimal).
//
// `medios` no es un ESTADO persistente como las otras dos herramientas (no hay un `modo: 'medios'` en
// `EditorTiendaPantallaCompleta`): abre la «vista nueva» (una hoja sobre el lienzo, § VistaNueva.tsx)
// y vuelve sola al cerrarse. El riel igual lo pinta ACTIVO mientras esa hoja está abierta — quien
// mira el riel no debe preguntarse "¿dónde estoy?" mientras la hoja sigue sobre la pantalla.
//
// `ayuda` SÍ es un `modo` persistente, igual que `secciones`/`estilo` — § EDITOR-AYUDA-1: el centro
// de ayuda reemplaza el panel (como «Estilo» ya hace con `PaletaSeccion`), no una hoja efímera sobre
// el lienzo como «Medios». Dejó de estar deshabilitado: ya existe destino (§ AyudaCentro.tsx).
export type HerramientaRiel = 'secciones' | 'estilo' | 'medios' | 'ayuda';

// `tour` (§ EDITOR-AYUDA-RECORRIDO-1, opcional): el valor del atributo `data-tour` que ubica este
// ítem para el recorrido guiado (`RecorridoEditor.tsx`). Sólo «Estilo» lo lleva — es el único ítem
// del riel que el recorrido resalta; los demás no lo necesitan.
const ITEMS: { clave: HerramientaRiel; label: string; Icon: ComponentType<{ 'aria-hidden'?: boolean }>; tour?: string }[] = [
  { clave: 'secciones', label: 'Secciones', Icon: LayoutList },
  { clave: 'estilo', label: 'Estilo', Icon: Palette, tour: 'estilo' },
  { clave: 'medios', label: 'Medios', Icon: ImageIcon },
];

// UN SOLO botón, parametrizado por `on` — el que ya pintaba los tres de siempre, ahora también
// pinta «Ayuda» (antes era una segunda copia a mano, deshabilitada). La barra de posición y el
// resaltado son IDÉNTICOS para los cuatro: «Ayuda» activa se ve exactamente como «Secciones»/
// «Estilo» activas, no como un cuarto estado visual distinto.
function ItemRiel({ label, Icon, on, onClick, tour }: { label: string; Icon: ComponentType<{ 'aria-hidden'?: boolean }>; on: boolean; onClick: () => void; tour?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      data-tour={tour}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        padding: '10px 4px',
        borderRadius: 'var(--duna-r-m)',
        border: 'none',
        cursor: 'pointer',
        fontSize: 11,
        fontWeight: on ? 600 : 500,
        background: on ? 'var(--duna-bg)' : 'transparent',
        color: on ? 'var(--duna-ink)' : 'var(--duna-muted)',
        boxShadow: on ? 'var(--duna-shadow-1)' : 'none',
      }}
    >
      {/* La barra de posición es de TINTA, no ámbar (§ el comentario de arriba). */}
      {on && (
        <span
          aria-hidden
          style={{ position: 'absolute', left: -8, top: '50%', transform: 'translateY(-50%)', width: 3, height: 20, borderRadius: 'var(--duna-r-full)', background: 'var(--duna-ink)' }}
        />
      )}
      <Icon aria-hidden />
      <span>{label}</span>
    </button>
  );
}

export function Riel({ activo, onElegir }: { activo: HerramientaRiel; onElegir: (h: HerramientaRiel) => void }) {
  return (
    <nav
      aria-label="Herramientas del editor"
      style={{
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--duna-space-1)',
        width: '72px',
        padding: 'var(--duna-space-3) var(--duna-space-2)',
        borderRight: '1px solid var(--duna-border)',
        background: 'var(--duna-surface)',
      }}
    >
      {ITEMS.map(({ clave, label, Icon, tour }) => (
        <ItemRiel key={clave} label={label} Icon={Icon} on={activo === clave} onClick={() => onElegir(clave)} tour={tour} />
      ))}
      {/* EDITOR-VISUAL-MARCO-1 (§ REDISENO.md § 3, prototipo: "Ayuda" abajo, separado por un
          espaciador — `.rail-sp` en el prototipo). § EDITOR-AYUDA-1 le da destino: el centro de
          ayuda (`AyudaCentro.tsx`) ya existe, así que deja de estar deshabilitado. */}
      <div aria-hidden style={{ flex: '1 1 auto' }} />
      <ItemRiel label="Ayuda" Icon={HelpCircle} on={activo === 'ayuda'} onClick={() => onElegir('ayuda')} />
    </nav>
  );
}

export default Riel;
