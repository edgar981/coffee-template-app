// INTERLUDIO Y CIERRE SE MUESTRAN CUANDO TIENEN CONTENIDO (§ TIENDA-CHAMISAS-AJUSTES-1). PURO
// (capa 1): sin red, sin DOM. Las dos secciones nacen ENCENDIDAS (`DEFAULTS.tiendaInterludio.visible`/
// `.tiendaCierre.visible`, site-content-defaults.ts) — "publicar = se ve", el pedido del owner tras
// el demo de Las Chamisas: antes había que publicar Y encender un interruptor aparte. El GATE real es
// tener CONTENIDO (la foto del interludio, la frase del cierre); el interruptor de sección
// (`visible`, § `seccionEsVisible`) sigue sirviendo para esconder A PROPÓSITO una sección que SÍ
// tiene contenido — las dos condiciones se COMPONEN, nunca se reemplazan entre sí.

import { whatsappUrl } from '@/lib/config/site';

/** ¿Hay algo que mostrar en el Interludio «Retrato y cita»/«Plano»? Sin foto no hay retrato ni plano
 *  que componer — ninguna composición tiene un fallback de stock (§ TiendaInterludioContent, "una
 *  imagen de stock sería una mentira de marca"). */
export function tiendaInterludioVisible(imagen: string): boolean {
  return imagen.trim() !== '';
}

/** ¿Hay algo que mostrar en el Cierre «Costura»/«Frase y botón»? Sin frase no hay nada que cerrar
 *  con — a diferencia del interludio, el Cierre SIEMPRE lleva texto (`frase`/`boton` son copy de la
 *  tienda, no un claim atribuido a nadie), pero sin él NO se arma ninguna de las dos composiciones. */
export function tiendaCierreVisible(frase: string): boolean {
  return frase.trim() !== '';
}

export interface CierreCta {
  label: string;
  href: string;
}

/** El botón del Cierre NUNCA desaparece por falta de WhatsApp (§ el spec, item 3): con número
 *  configurado, conversa por WhatsApp con el texto que el dueño eligió (`boton`); sin número, cae a
 *  «Ver suscripciones» — SI esa página está encendida (la MISMA capacidad que ya gatea las otras seis
 *  superficies que enlazan a /suscripciones, § `PAGINAS` en `components/admin/tienda-secciones.ts`).
 *  Sin ninguna de las dos, no hay botón: un enlace que no lleva a ningún lado es peor que ninguno. */
export function botonCierre(opts: {
  whatsapp?: string;
  boton: string;
  mensajeWhatsapp: string;
  suscripcionesVisible: boolean;
}): CierreCta | null {
  if (opts.whatsapp) return { label: opts.boton, href: whatsappUrl(opts.whatsapp, opts.mensajeWhatsapp) };
  if (opts.suscripcionesVisible) return { label: 'Ver suscripciones', href: '/suscripciones' };
  return null;
}
