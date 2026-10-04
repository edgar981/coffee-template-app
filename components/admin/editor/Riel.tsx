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
      {/* EDITOR-VISUAL-MARCO-1 (§ REDISENO.md § 3, prototipo: "Ayuda" abajo, separado por un espaciador
          — `.rail-sp` en el prototipo). SIN DESTINO: no existe hoy documentación del editor para el
          dueño de la tienda —`docs/editor-tienda/` es documentación de INGENIERÍA, no un artículo de
          ayuda para quien opera el panel—, así que el botón se deja DESHABILITADO con el motivo en el
          `title`, en vez de fingir un enlace que no lleva a ningún lado (§ CLAUDE.md, "un botón
          deshabilitado no promete nada"). */}
      <div aria-hidden style={{ flex: '1 1 auto' }} />
      <button
        type="button"
        disabled
        title="Documentación del editor — todavía no existe"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          padding: '10px 4px',
          borderRadius: 'var(--duna-r-m)',
          border: 'none',
          cursor: 'default',
          fontSize: 11,
          fontWeight: 500,
          background: 'transparent',
          color: 'var(--duna-faint)',
        }}
      >
        <HelpCircle aria-hidden />
        <span>Ayuda</span>
      </button>
    </nav>
  );
}

export default Riel;
