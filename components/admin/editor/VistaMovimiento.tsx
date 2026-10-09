'use client';

import { useRef } from 'react';
import { Play } from 'lucide-react';
import Movimiento, { type MovimientoHandle } from '@/components/storefront/movimiento/Movimiento';
import { puedeReproducirUnaVez, MOVIMIENTO_NINGUNA, type ElementoMovimiento } from '@/lib/movimiento/catalogo';

// LA VISTA PREVIA JUNTO AL AJUSTE, Y SU BOTÓN «VER ANIMACIÓN» (§ MOVIMIENTO-EDITOR-EXPOSICION-1, el
// spec: "la página del editor sigue quieta... un botón «▶ Ver animación»... la reproduce UNA vez en
// la vista previa y la deja en su estado final"). Monta el MOTOR REAL (`<Movimiento>`, el mismo que
// corre en la tienda publicada) con `auto={false}` — NO se auto-dispara por scroll ni por estar
// montado (la cajita puede estar perfectamente dentro del 82% del viewport del panel sin que nadie
// haya pedido verla animar): sólo corre al llamar `reproducir()`, vía el `ref` imperativo.
//
// EL CONTENIDO es REPRESENTATIVO del elemento, no la sección entera: un párrafo de muestra para
// 'texto', una foto de muestra para 'imagen', tres tarjetas para 'tarjetas' — construir el
// escenario de la sección REAL (con su fondo, su CTA, su layout) para una vista previa de 120px es
// más superficie que lo que esto necesita probar: QUE LA ANIMACIÓN ELEGIDA SE VE, no la composición
// completa de la sección (eso ya se ve en la tienda publicada tras Publicar).
//
// EL BOTÓN SE DESHABILITA para «Ninguna» (nada que reproducir) y para un id que no es clase
// `revelado` (`puedeReproducirUnaVez`, § catalogo.ts — I03/parallax y C02/hover no tienen "una vez"
// que mostrar; `useMovimiento.ts` ya lo rechazaría en silencio, pero un botón habilitado que no
// hace nada al tocarlo es peor que uno deshabilitado que LO DICE).

export function VistaMovimiento({ elemento, animacion }: {
  elemento: ElementoMovimiento;
  animacion: string;
}) {
  const ref = useRef<MovimientoHandle>(null);
  const habilitado = puedeReproducirUnaVez(animacion);

  return (
    <div className="editor-movimiento-vista">
      <div className="editor-movimiento-vista__caja">
        {elemento === 'imagen' ? (
          <Movimiento ref={ref} id={animacion} as="div" auto={false} className="editor-movimiento-vista__imagen">
            <div className="editor-movimiento-vista__foto" />
          </Movimiento>
        ) : elemento === 'tarjetas' ? (
          <Movimiento ref={ref} id={animacion} as="div" auto={false} className="editor-movimiento-vista__tarjetas">
            <div className="editor-movimiento-vista__tarjeta" />
            <div className="editor-movimiento-vista__tarjeta" />
            <div className="editor-movimiento-vista__tarjeta" />
          </Movimiento>
        ) : (
          <Movimiento ref={ref} id={animacion} as="p" auto={false} className="editor-movimiento-vista__texto">
            Un texto de muestra para ver la animación.
          </Movimiento>
        )}
      </div>
      <button
        type="button"
        className="duna-btn duna-btn--secondary duna-btn--sm"
        disabled={!habilitado || animacion === MOVIMIENTO_NINGUNA}
        onClick={() => ref.current?.reproducir()}
      >
        <Play className="h-3.5 w-3.5" /> Ver animación
      </button>
    </div>
  );
}

export default VistaMovimiento;
