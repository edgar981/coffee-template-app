'use client';

// § EDITOR-VISUAL-PANEL-1 — los GLIFOS de fila del nivel Inicio, calcados del prototipo
// (docs/editor-tienda/prototipo/prototipo-editor.html): el mismo `viewBox="0 0 24 24"` y los mismos
// `<path>`/`<rect>` que el HTML navegable, no un ícono de lucide-react parecido — la fidelidad pixel
// a pixel importa más acá que reusar un set ya instalado. `.editor-row__icon svg` (editor.css) fija
// stroke/fill/tamaño para los cinco, así que este componente sólo aporta la geometría.
//
// 'hero' = la zona-imagen del hero (rect + "colinas", el mismo path que usa el prototipo para la fila
// «Hero»); 'nav'/'menu'/'footer' = Encabezado/Menú/Pie (barra superior, tres líneas, barra inferior);
// 'generico' = TODAS las demás secciones de contenido (Historia, Presentaciones, Testimonios…) y las
// secciones agregadas — el prototipo usa EL MISMO glifo para esa familia entera (`homeRows` en el
// HTML, un solo `<svg>` reusado por `sc-for`), así que no se inventa un ícono por sección.
export type TipoIconoFila = 'hero' | 'nav' | 'menu' | 'footer' | 'generico';

export function IconoFila({ tipo }: { tipo: TipoIconoFila }) {
  switch (tipo) {
    case 'hero':
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 15l5-4 4 3 3-2 6 4" />
        </svg>
      );
    case 'nav':
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <rect x="3" y="4" width="18" height="5" rx="1.5" />
          <path d="M3 13h18M3 17h12" />
        </svg>
      );
    case 'menu':
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      );
    case 'footer':
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <rect x="3" y="15" width="18" height="5" rx="1.5" />
          <path d="M3 7h18M3 11h12" />
        </svg>
      );
    case 'generico':
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M7 10h6M7 14h10" />
        </svg>
      );
  }
}

export default IconoFila;
