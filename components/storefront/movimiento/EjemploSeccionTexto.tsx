// EJEMPLO DE CABLEADO (§ MOVIMIENTO-MARCO-GSAP-1, punto 4 del spec) — NO SE IMPORTA DESDE NINGUNA
// RUTA DEL STOREFRONT NI DEL ADMIN. No es la sección "texto" real (`components/storefront/
// secciones/Texto.tsx`, fuera de `touches:` de este slice): es la DEMOSTRACIÓN mínima de cómo esa
// sección —o cualquier otra— leería el eje `animacion` que este slice deja listo
// (`InstanciaTextoContent.animacion`, § `lib/config/secciones-instancias.ts`) y lo pasaría a
// `<Movimiento>`.
//
// `animacion` AUSENTE/«Ninguna» (el valor de TODA tienda hoy, Nayoli incluida: el campo nace
// `''` en `DEFAULTS_INSTANCIA.texto`) hace que `<Movimiento id="">` devuelva `children` sin
// wrapper (§ `Movimiento.tsx`) — por eso este ejemplo, montado con el default, es byte-idéntico a
// montar el título SIN `<Movimiento>` — lo afirma `lib/movimiento/demo-byte-identidad.test.ts` con
// `renderToStaticMarkup`, sin tocar una base ni un `.env`.
//
// CABLEAR esto en la sección "texto" REAL (quitar `RevelarBloque` del título, o anidar los dos) es
// la tanda que EXPONE el eje en el editor — explícitamente fuera de este slice (§ el spec, punto
// 4: "no cablea el ajuste en cada sección ni lo expone en el editor").

import Movimiento from './Movimiento';
import type { InstanciaTextoContent } from '@/lib/config/secciones-instancias';

export default function EjemploSeccionTexto({ instancia }: { instancia: InstanciaTextoContent }) {
  return (
    <section>
      <Movimiento id={instancia.animacion} as="h2">
        {instancia.titulo}
      </Movimiento>
    </section>
  );
}
