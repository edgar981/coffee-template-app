import type { PaginaKey } from '@/components/admin/tienda-secciones';
import type { PaginasContent } from '@/lib/config/site-content-defaults';
import { sonIguales } from '@/lib/admin/historial-editor';

// § EDITOR-ESTADO-PAGINAS-1 — las reglas PURAS detrás de los hallazgos G1/G2/G4/G5/G7 de la
// auditoría del editor (`.scratch/auditoria-editor/hallazgos.md`). Cada función se prueba sola, sin
// montar React ni levantar el iframe — el componente sólo las LLAMA.

// ── G1/G2 — el punto ámbar es "el borrador difiere de lo publicado", no "la clave está en el
//    borrador del servidor" (§ lib/config/site-content-read.ts: `sinPublicar[key] = key in
//    borrador`, fuera de `touches:` — ese flag queda, pero deja de ser la ÚLTIMA palabra). Con el
//    borrador (`form`) y lo publicado de ESA sección ya en mano, la comparación es de VALOR: prender
//    y apagar un ojo, o volver al texto original, vuelve a dar `false` sin esperar un refetch.
//
// `sinPublicarFallback` es el flag crudo del servidor — la única señal disponible MIENTRAS lo
// publicado todavía no llegó (recién montado, o el fetch de `/api/site-content/publicado` falló):
// preferible a la señal vieja-pero-real antes que afirmar "sin cambios" sin base. `form == null`
// cubre TANTO `undefined` (sin prop) como `null` (el estado de "todavía sin sembrar" de
// `TiendaSeccionEditor`, antes de la siembra única) — ninguno de los dos es un VALOR comparable.
export function hayBorradorReal(form: unknown, publicado: unknown, sinPublicarFallback: boolean): boolean {
  if (form == null || publicado === undefined) return sinPublicarFallback;
  return !sonIguales(form, publicado);
}

// ── G4 — los controles del home (+ Agregar sección, la barra "el orden cambió", las secciones
//    agregadas) sólo tienen sentido en 'home': las demás páginas no tienen `content.orden` ni
//    `seccionesHome` propios. `ordenLocal`/`seccionesHomeLocal` (TiendaPaginas.tsx) se siembran UNA
//    vez por sesión del editor y se QUEDAN sembrados al cambiar de página — sin este guard, su mera
//    presencia (no su contenido) filtraba los controles del home a cualquier otra página.
export function debeMostrarControlesHome(pagina: PaginaKey): boolean {
  return pagina === 'home';
}

// ── G5 — si la página está apagada (`content.paginas.<pagina>.visible === false`), navegar el
//    iframe a su ruta real es pedirle al storefront que redirija a "/" — y el vigía de ruta
//    (`VistaTiendaIframe.tsx`) manda de vuelta a esa misma ruta, en loop. `home`/`tienda` no son
//    apagables (`PaginasContent` sólo declara `nosotros`/`suscripciones`): para ellas esta función
//    SIEMPRE da `false`, sin tocar `paginas`.
//
// `paginas` ausente (el `doc` todavía no cargó) → `false`: preferir mostrar el iframe de siempre a
// afirmar "apagada" sin haber leído el dato — mismo criterio que `sinPublicarFallback` arriba.
export function paginaEstaApagada(pagina: PaginaKey, paginas: PaginasContent | undefined | null): boolean {
  if (pagina !== 'nosotros' && pagina !== 'suscripciones') return false;
  if (!paginas) return false;
  return paginas[pagina].visible === false;
}

// ── G7 — el título del panel y la miga de vuelta nombran la página abierta, no "Inicio" a secas.
//    "Inicio" SIGUE siendo el nombre de HOME (es como ya lo llama el selector de página de
//    `EditorTiendaPantallaCompleta.tsx`, `LABEL_PAGINA_SELECTOR.home`, y como ya lo usa
//    `resumen-cambios.ts` para una sección agregada al home) — lo que cambia es que las OTRAS tres
//    páginas dejan de heredar ese nombre por omisión. `labelPagina` es el label YA RESUELTO de esa
//    página (`PAGINAS.find(...).label`, que para tienda/nosotros/suscripciones ya coincide con el
//    nombre visible) — este módulo no importa `PAGINAS` para no fijar una segunda fuente del label.
export function nombreNivelInicio(pagina: PaginaKey, labelPagina: string): string {
  return pagina === 'home' ? 'Inicio' : labelPagina;
}

// ── G5 (el "tope" del vigía) — `VistaTiendaIframe.tsx` reintentaba `location.replace` cada 400ms
//    SIN límite ante cualquier ruta que no coincidiera con la esperada; con la página apagada ya
//    cubierta arriba (el iframe ni se monta), este tope es la red GENERAL para cualquier otra causa
//    de loop que hoy no se conoce — nunca insistir indefinidamente contra una ruta que no vuelve.
export const TOPE_INTENTOS_VIGIA_RUTA = 5;

export function debeReintentarVigiaRuta(intentosPrevios: number): boolean {
  return intentosPrevios < TOPE_INTENTOS_VIGIA_RUTA;
}
