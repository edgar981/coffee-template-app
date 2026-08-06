'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * El pliegue que guarda la evidencia densa: la respuesta primero, el detalle
 * detrás de un click. Nació en Analítica (§ LA RESPUESTA PRIMERO) y salió de ahí
 * al necesitarlo el detalle de la orden — el mismo widget escrito dos veces se
 * separa en cuanto uno de los dos se ajusta.
 *
 * Estado LOCAL y no persistido a propósito: la vista tiene que abrir siempre en
 * su forma corta, porque es esa forma la que responde de un vistazo. Un pliegue
 * recordado convertiría la pantalla del analista en el default de alguien.
 */
export function Pliegue({ label, children, className = 'mt-4 pt-4 border-t border-border' }: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setAbierto(a => !a)}
        aria-expanded={abierto}
        className="flex items-center gap-1.5 rounded text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${abierto ? '' : '-rotate-90'}`} />
        {label}
      </button>
      {abierto && <div className="mt-4">{children}</div>}
    </div>
  );
}
