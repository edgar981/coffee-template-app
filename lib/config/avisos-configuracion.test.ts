import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avisosDeConfiguracion } from './avisos-configuracion';
import { resolverSiteContent, type SiteContentData, type PresentacionesContent } from './site-content-defaults';
// `import type` (erased en compilación): el módulo trae prisma, pero sólo viaja el TIPO.
import type { SiteSettings } from './site-settings-read';
import type { MetodoPagoGuardado } from '../checkout/metodos-pago';

// Los defaults resueltos = la config "SANA" de referencia — YA NO son "Nayoli": los defaults dejaron
// de ser el contenido de ningún cliente (§ CONTENIDO-NEUTRALIZAR-1), así que el nombre no puede seguir
// prometiendo un tenant. El catálogo ALINEADO se DERIVA de esos mismos defaults, nunca se re-escribe a
// mano con las categorías de hoy: dos listas describiendo el mismo conjunto es cómo divergen (la misma
// trampa que el schema editable STRIPPEANDO lo no declarado) — si un default cambia mañana, esta lista
// lo sigue sola.
const DEFAULTS_SANOS = resolverSiteContent({});
const CATS_ALINEADO = [DEFAULTS_SANOS.presentaciones.categoria1, DEFAULTS_SANOS.presentaciones.categoria2];

// Los métodos "sanos" de referencia: nequi/daviplata/transferencia ENCENDIDOS pero SIN datos —
// el mismo estado que dejaba el modelo viejo con los booleanos en true y el número/cuenta sin
// llenar—, y efectivo completo. Sólo efectivo es MOSTRABLE (y sólo en Bogotá), que es justo el
// comportamiento que el fixture viejo producía.
const METODOS_SANOS: MetodoPagoGuardado[] = [
  { tipo: 'nequi', datos: { numero: '' } },
  { tipo: 'daviplata', datos: { numero: '' } },
  { tipo: 'transferencia', datos: { banco: '', tipoCuenta: '', numeroCuenta: '', titular: '' } },
  { tipo: 'efectivo', datos: {} },
];

// La IDENTIDAD sana de referencia: lo único que este módulo mira de `SiteSettings` es `whatsapp` y
// `metodosPago`, pero el fixture se declara COMPLETO para que agregar un campo al tipo rompa acá y
// no en silencio.
const AJUSTES_SANOS: SiteSettings = {
  nombre: 'Café Nayoli', tagline: '', descripcionFooter: '',
  whatsapp: '+573155766064', instagram: '', emailRemitente: '',
  emailReplyTo: null, adminEmail: null,
  metodosPago: METODOS_SANOS,
};
const conWhatsapp = (whatsapp: string): SiteSettings => ({ ...AJUSTES_SANOS, whatsapp });

function conPresentaciones(parcial: Partial<PresentacionesContent>): SiteContentData {
  return { ...DEFAULTS_SANOS, presentaciones: { ...DEFAULTS_SANOS.presentaciones, ...parcial } };
}
const destinos = (c: SiteContentData, cats: string[], listo = true) =>
  avisosDeConfiguracion(c, cats, listo, AJUSTES_SANOS).filter(a => a.clave.startsWith('presentaciones-destino'));
const imagenes = (c: SiteContentData, cats: string[], listo = true) =>
  avisosDeConfiguracion(c, cats, listo, AJUSTES_SANOS).filter(a => a.clave.startsWith('presentaciones-imagen'));
const whatsapps = (s: SiteSettings) =>
  avisosDeConfiguracion(DEFAULTS_SANOS, CATS_ALINEADO, true, s).filter(a => a.clave === 'negocio-whatsapp');
const salidas = (s: SiteSettings) =>
  avisosDeConfiguracion(DEFAULTS_SANOS, CATS_ALINEADO, true, s).filter(a => a.clave === 'checkout-sin-salida');
/** La lista VACÍA: la config que deja el paso de pago sin una sola opción que mostrar. */
const SIN_METODOS: Pick<SiteSettings, 'metodosPago'> = { metodosPago: [] };
/** Sólo efectivo, completo — un método mostrable (y sólo en Bogotá). */
const SOLO_EFECTIVO: Pick<SiteSettings, 'metodosPago'> = { metodosPago: [{ tipo: 'efectivo', datos: {} }] };
/** Nequi encendido pero incompleto (sin número) — no cuenta como mostrable. */
const NEQUI_SIN_NUMERO: Pick<SiteSettings, 'metodosPago'> = { metodosPago: [{ tipo: 'nequi', datos: { numero: '' } }] };
const NEQUI_CON_NUMERO: Pick<SiteSettings, 'metodosPago'> = { metodosPago: [{ tipo: 'nequi', datos: { numero: '+573155766064' } }] };

test('defaults SANOS (catálogo alineado + identidad cargada) → CERO avisos', () => {
  const avisos = avisosDeConfiguracion(DEFAULTS_SANOS, CATS_ALINEADO, true, AJUSTES_SANOS);
  assert.equal(avisos.length, 0, `esperaba 0 avisos, hubo: ${JSON.stringify(avisos)}`);
});

test('#1 destino inexistente — la categoría de la tarjeta no está en el catálogo', () => {
  const c = conPresentaciones({ categoria1: 'Café Descafeinado' });
  const avs = destinos(c, CATS_ALINEADO);
  assert.equal(avs.length, 1);
  assert.equal(avs[0].clave, 'presentaciones-destino-1');
  assert.match(avs[0].mensaje, /Café Descafeinado/);
  assert.equal(avs[0].href, '/admin/tienda?seccion=presentaciones&tarjeta=1');
});

test('#1 usa el MISMO predicado que el editor — un destino que SÍ está en el catálogo NO dispara', () => {
  const c = conPresentaciones({ categoria1: CATS_ALINEADO[1] }); // la categoría DEL OTRO slot, tomada del mismo derivado
  assert.equal(destinos(c, CATS_ALINEADO).length, 0);
});

test('#1 NO dispara si el catálogo no cargó (no se puede afirmar que la categoría no existe)', () => {
  const c = conPresentaciones({ categoria1: 'Café Descafeinado' });
  assert.equal(destinos(c, [], false).length, 0);
});

test('#1 destino VACÍO no es defecto (lleva a /tienda, todos)', () => {
  const c = conPresentaciones({ categoria1: '' });
  assert.equal(destinos(c, CATS_ALINEADO).length, 0);
});

test('#2 título SIN imagen — tarjeta con label y sin foto → un aviso de imagen', () => {
  const c = conPresentaciones({ imagen1: '' }); // label1 sigue, imagen1 vacía
  const avs = imagenes(c, CATS_ALINEADO);
  assert.equal(avs.length, 1);
  assert.equal(avs[0].clave, 'presentaciones-imagen-1');
  assert.equal(avs[0].href, '/admin/tienda?seccion=presentaciones&tarjeta=1');
});

test('#2 NO depende del catálogo — dispara aunque catalogoListo sea false', () => {
  const c = conPresentaciones({ imagen1: '' });
  assert.equal(imagenes(c, [], false).length, 1);
});

test('una tarjeta SIN título (imagen sola) no dispara #2 —no hay hueco de imagen que avisar—', () => {
  // slot 3 visible sólo por su imagen (label vacío): no hay título → #2 no aplica.
  const c = conPresentaciones({ label3: '', imagen3: '/images/x.webp', categoria3: 'Café Molido' });
  assert.equal(imagenes(c, CATS_ALINEADO).length, 0);
});

test('una tarjeta OPCIONAL visible por su título dispara sus defectos por SLOT', () => {
  // slot 3 visible por su título; destino inexistente + sin imagen → un aviso de cada tipo, del slot 3.
  const c = conPresentaciones({ label3: 'Cápsulas', copy3: 'x', imagen3: '', categoria3: 'Cápsulas' });
  const avisos = avisosDeConfiguracion(c, CATS_ALINEADO, true, AJUSTES_SANOS);
  assert.ok(avisos.some(a => a.clave === 'presentaciones-destino-3'), 'destino-3 esperado');
  assert.ok(avisos.some(a => a.clave === 'presentaciones-imagen-3'), 'imagen-3 esperado');
  // el enlace aterriza en el BLOQUE de ESA tarjeta (slot 3), no en la pantalla a secas.
  assert.ok(avisos.every(a => a.href === '/admin/tienda?seccion=presentaciones&tarjeta=3'), 'href al slot 3');
});

test('Presentaciones OCULTA (visible:false) → sin avisos aunque haya defectos', () => {
  const c = conPresentaciones({ visible: false, categoria1: 'Inexistente', imagen1: '' });
  assert.equal(avisosDeConfiguracion(c, CATS_ALINEADO, true, AJUSTES_SANOS).length, 0);
});

// ── #8 · WHATSAPP VACÍO ───────────────────────────────────────────────────────────────────────────
// El checkout promete confirmar el pago por WhatsApp; sin número esa promesa se retira del storefront
// (§ el gate del checkout) y el dueño tiene que enterarse de por qué.

test('#8 whatsapp VACÍO → un aviso, que aterriza donde se edita el campo', () => {
  const avs = whatsapps(conWhatsapp(''));
  assert.equal(avs.length, 1);
  assert.equal(avs[0].clave, 'negocio-whatsapp');
  assert.equal(avs[0].href, '/admin/configuracion');
});

test('#8 whatsapp CARGADO no dispara', () => {
  assert.equal(whatsapps(AJUSTES_SANOS).length, 0);
});

test('#8 whatsapp de SÓLO ESPACIOS cuenta como vacío — es lo mismo que recibe el visitante', () => {
  assert.equal(whatsapps(conWhatsapp('   ')).length, 1);
});

test('#8 NO depende del catálogo ni del contenido — dispara con catalogoListo false', () => {
  const avs = avisosDeConfiguracion(DEFAULTS_SANOS, [], false, conWhatsapp(''));
  assert.equal(avs.filter(a => a.clave === 'negocio-whatsapp').length, 1);
});

test('#8 el mensaje dice la CONSECUENCIA del comprador, no el mecanismo del campo', () => {
  const [av] = whatsapps(conWhatsapp(''));
  assert.match(av.mensaje, /checkout/i, 'nombra dónde lo sufre el comprador');
  assert.doesNotMatch(av.mensaje, /campo|vac[íi]o|SiteSetting|null/i, 'no habla del mecanismo');
});

test('#8 convive con los de Presentaciones — cada defecto es su propio aviso', () => {
  const c = conPresentaciones({ imagen1: '' });
  const avisos = avisosDeConfiguracion(c, CATS_ALINEADO, true, conWhatsapp(''));
  assert.equal(avisos.length, 2);
  assert.deepEqual(avisos.map(a => a.clave).sort(), ['negocio-whatsapp', 'presentaciones-imagen-1']);
});

// ── #8-GEMELO · CHECKOUT SIN SALIDA ───────────────────────────────────────────────────────────────
// El combo severo: sin método de pago MOSTRABLE la guarda defensiva del checkout es lo único que
// queda, y sin WhatsApp esa guarda ya no ofrece por dónde coordinar → el comprador llega al pago y
// no puede terminar. Es una venta muerta, no un canal menos.

test('el gemelo exige las DOS mitades — sin métodos PERO con WhatsApp no dispara', () => {
  assert.equal(salidas({ ...AJUSTES_SANOS, ...SIN_METODOS }).length, 0);
});

test('el gemelo exige las DOS mitades — sin WhatsApp PERO con un método mostrable no dispara', () => {
  // AJUSTES_SANOS deja efectivo ENCENDIDO (no necesita datos), así que hay un método que mostrar.
  assert.equal(salidas(conWhatsapp('')).length, 0);
});

test('sin métodos Y sin WhatsApp → el aviso del dead-end, donde se editan los dos datos', () => {
  const avs = salidas({ ...AJUSTES_SANOS, ...SIN_METODOS, whatsapp: '' });
  assert.equal(avs.length, 1);
  assert.equal(avs[0].clave, 'checkout-sin-salida');
  assert.equal(avs[0].href, '/admin/configuracion');
});

test('un método en la lista pero SIN SUS DATOS no cuenta como mostrable — es la regla del checkout', () => {
  // Sólo nequi en la lista, y su número sin cargar: el checkout NO lo muestra (§ metodos-pago),
  // así que el paso de pago queda igual de vacío que con la lista entera afuera.
  const s: SiteSettings = { ...AJUSTES_SANOS, ...NEQUI_SIN_NUMERO, whatsapp: '' };
  assert.equal(salidas(s).length, 1);
  // y con el número cargado el mismo método SÍ se muestra → deja de haber dead-end.
  assert.equal(salidas({ ...AJUSTES_SANOS, ...NEQUI_CON_NUMERO, whatsapp: '' }).length, 0);
});

test('el dead-end NO se juzga con la ciudad del comprador — efectivo en la lista es un método mostrable', () => {
  // `isBogota` es la dirección del COMPRADOR, no configuración: el aviso dispara sólo cuando NINGÚN
  // comprador tendría método. Efectivo en la lista (aunque sólo sirva en Bogotá) no es un dead-end cierto.
  const s: SiteSettings = { ...AJUSTES_SANOS, ...SOLO_EFECTIVO, whatsapp: '' };
  assert.equal(salidas(s).length, 0);
});

test('el gemelo y #8 conviven — un canal retirado y un pedido imposible son hechos distintos', () => {
  const avisos = avisosDeConfiguracion(DEFAULTS_SANOS, CATS_ALINEADO, true, { ...AJUSTES_SANOS, ...SIN_METODOS, whatsapp: '' });
  assert.deepEqual(avisos.map(a => a.clave), ['checkout-sin-salida', 'negocio-whatsapp'], 'el severo va primero');
});

test('el gemelo dice la CONSECUENCIA del comprador, no el mecanismo de la config', () => {
  const [av] = salidas({ ...AJUSTES_SANOS, ...SIN_METODOS, whatsapp: '' });
  assert.match(av.mensaje, /checkout/i, 'nombra dónde lo sufre el comprador');
  assert.doesNotMatch(av.mensaje, /campo|apagad|SiteSetting|null|booleano/i, 'no habla del mecanismo');
});

test('defaults SANOS siguen en CERO avisos con el gemelo puesto', () => {
  assert.equal(avisosDeConfiguracion(DEFAULTS_SANOS, CATS_ALINEADO, true, AJUSTES_SANOS).length, 0);
});
