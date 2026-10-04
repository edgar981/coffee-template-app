'use client';

import type { ComponentType } from 'react';
import { LayoutList, Palette, Image as ImageIcon } from 'lucide-react';

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
export type HerramientaRiel = 'secciones' | 'estilo' | 'medios';

const ITEMS: { clave: HerramientaRiel; label: string; Icon: ComponentType<{ 'aria-hidden'?: boolean }> }[] = [
  { clave: 'secciones', label: 'Secciones', Icon: LayoutList },
  { clave: 'estilo', label: 'Estilo', Icon: Palette },
  { clave: 'medios', label: 'Medios', Icon: ImageIcon },
];

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
      {ITEMS.map(({ clave, label, Icon }) => {
        const on = activo === clave;
        return (
          <button
            key={clave}
            type="button"
            aria-pressed={on}
            onClick={() => onElegir(clave)}
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
      })}
    </nav>
  );
}

export default Riel;
