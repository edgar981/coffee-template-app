// lib/editor/site-content-compartido.ts — § EDITOR-CARGA-RAPIDA-1
//
// UN SOLO PEDIDO DE `/api/site-content`, COMPARTIDO POR TODO EL EDITOR. Mismo patrón que
// `cargarCatalogoReal`/`cargarRaicesTemaReal` (`TiendaSeccionEditor.tsx`: una promesa a nivel de
// módulo, nunca un fetch por instancia) — este archivo lo aplica al GET que faltaba: medido con el
// arnés de este slice (Chromium + Postgres efímero + `next build`/`next start`, sesión de editor
// sembrada), al abrir `/editor/tienda` SEIS componentes autónomos — `TiendaPaginas` + Encabezado ·
// Menú · Pie · Identidad del vendedor · Camino de compra — pedían `/api/site-content` COMPLETO cada
// uno por su cuenta, los seis en el MISMO instante (6 peticiones idénticas en vuelo a la vez, la
// cola de conexiones del navegador sirviéndolas una detrás de otra).
//
// LA DISTINCIÓN QUE IMPORTA es mount vs. tras-escritura, y por eso hay DOS funciones, no una:
//
// · `obtenerSiteContentCompartido` — para el mount (o cualquier lectura que no sigue a una
//   escritura PROPIA): si ya hay una lectura en curso o resuelta, la REUSA. Nunca dispara una
//   segunda petición idéntica mientras nada la haya invalidado.
// · `refrescarSiteContentCompartido` — para después de publicar/descartar: SIEMPRE dispara una
//   lectura nueva del servidor (servir la caché ahí mostraría el estado de ANTES de la propia
//   escritura, que es exactamente el bug que el flujo de "Descartar" no puede permitirse) y dicho
//   resultado queda como la caché compartida para el próximo `obtenerSiteContentCompartido`.
//
// Confundir las dos sería reintroducir, del lado de la frescura, el mismo tipo de bug que esto
// arregla del lado de la duplicación: un dato compartido sin distinguir cuándo hay que invalidarlo
// es tan peligroso como uno que nadie comparte.

export interface SiteContentDocCompartido {
  contenido: Record<string, unknown>;
  sinPublicar: Record<string, boolean>;
}

let promesaCompartida: Promise<SiteContentDocCompartido> | null = null;

async function leerDeServidor(): Promise<SiteContentDocCompartido> {
  const r = await fetch('/api/site-content');
  if (!r.ok) throw new Error('No se pudo cargar /api/site-content');
  const d = await r.json();
  return { contenido: d.contenido ?? {}, sinPublicar: d.sinPublicar ?? {} };
}

// Si el fetch falla, la promesa rechazada NO se queda como caché: un fallo transitorio (la red, un
// 500 pasajero) no debe condenar a todo componente que pida el dato DESPUÉS a heredar el mismo
// rechazo para siempre — cada llamador posterior merece su propio intento.
function leerYRegistrar(): Promise<SiteContentDocCompartido> {
  const promesa = leerDeServidor().catch((e: unknown) => {
    if (promesaCompartida === promesa) promesaCompartida = null;
    throw e;
  });
  return promesa;
}

export function obtenerSiteContentCompartido(): Promise<SiteContentDocCompartido> {
  if (!promesaCompartida) promesaCompartida = leerYRegistrar();
  return promesaCompartida;
}

export function refrescarSiteContentCompartido(): Promise<SiteContentDocCompartido> {
  promesaCompartida = leerYRegistrar();
  return promesaCompartida;
}
