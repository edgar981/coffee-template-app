import Link from 'next/link';
import { resolveStatLine } from '@/lib/stat-line';
import type { StatTono } from '@/constants/dashboard-widgets';

// ─── Indicador editorial (Dashboard) ──────────────────────────────────────────
// Una COLUMNA de la tira de indicadores de "Hoy": cifra grande, pleca de estado,
// etiqueta y una línea de contexto. Sin caja, sin ícono, sin chip (§ duna.css,
// `.admin-indicadores`). NAVEGA a su pantalla y nada más — cero acciones. Reemplaza
// a `StatCard`; el contexto sale de la MISMA función de slot (`resolveStatLine`),
// así que insight y sub siguen compitiendo por un solo renglón igual que antes.
//
// El TREND se retiró con `StatCard`: el ±% mes-contra-mes es una COMPARATIVA que el
// sistema no calcula en general, y la forma editorial no le da slot (§ CLAUDE.md).

interface IndicadorProps {
  value:  string;
  label:  string;
  /** Estado para la pleca: 'atencion' (ámbar) · 'alerta' (rojo) · null (sin pleca). */
  estado: StatTono | null;
  /** Línea de contexto de fallback (se muestra si no hay insight). */
  sub?:   string;
  /** Hecho derivado; gana el slot sobre `sub`. */
  insight?: string;
  insightEnfasis?: boolean;
  scopeSuffix?: string;
  /** Navega a la lista de la que salió la cifra. Sin href → no navegable (no-op). */
  href?:  string;
}

export default function Indicador({ value, label, estado, sub, insight, insightEnfasis, scopeSuffix, href }: IndicadorProps) {
  // Mismo slot único que StatCard: insight gana, y el scope se apende. La regla vive
  // en lib/stat-line.ts (pura y testeada) — no se reimplementa acá.
  const contexto = resolveStatLine({ insight, sub, insightEnfasis, scopeSuffix });

  // La pleca SIEMPRE se renderiza (reserva su alto para que las etiquetas alineen);
  // 'none' la deja transparente — sin estado es SIN color, no un filete gris.
  const plecaMod = estado === 'atencion' ? 'admin-indicador__pleca--pend'
                 : estado === 'alerta'   ? 'admin-indicador__pleca--prob'
                 : '';

  const cuerpo = (
    <>
      <span className="admin-indicador__val">{value}</span>
      <span className={`admin-indicador__pleca ${plecaMod}`} aria-hidden />
      <span className="admin-indicador__lab">{label}</span>
      {contexto && <span className="admin-indicador__ctx">{contexto.text}</span>}
    </>
  );

  // Con href: link navegable con foco admin. Sin href (despachos_hoy, promedio,
  // productos_activos): un div plano — no se promete una navegación que no existe.
  if (href) {
    return (
      <Link href={href} className="admin-indicador admin-foco" aria-label={`Ir a ${label}`}>
        {cuerpo}
      </Link>
    );
  }
  return <div className="admin-indicador">{cuerpo}</div>;
}
