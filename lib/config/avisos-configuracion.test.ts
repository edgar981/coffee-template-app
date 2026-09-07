import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avisosDeConfiguracion } from './avisos-configuracion';
import { resolverSiteContent, type SiteContentData, type PresentacionesContent } from './site-content-defaults';
// `import type` (erased en compilación): el módulo trae prisma, pero sólo viaja el TIPO.
import type { SiteSettings } from './site-settings-read';

// Nayoli resuelto (los defaults) = la config "SANA" de referencia. Sus presentaciones apuntan a
// 'Café en Grano' / 'Café Molido' y traen imagen.
const NAYOLI = resolverSiteContent({});
const CATS_NAYOLI = ['Café en Grano', 'Café Molido']; // el catálogo alineado con las presentaciones

// La IDENTIDAD sana de referencia: lo único que este módulo mira de `SiteSettings` es `whatsapp`, pero
// el fixture se declara COMPLETO para que agregar un campo al tipo rompa acá y no en silencio.
const AJUSTES_SANOS: SiteSettings = {
  nombre: 'Café Nayoli', tagline: '', descripcionFooter: '',
  whatsapp: '+573155766064', instagram: '', emailRemitente: '',
  emailReplyTo: null, adminEmail: null,
  bancoNombre: null, bancoTipoCuenta: null, bancoNumeroCuenta: null, bancoTitular: null,
  pagoNequiActivo: true, pagoDaviplataActivo: true, pagoTransferenciaActivo: true,
  pagoEfectivoActivo: true, pagoMovilNumero: null,
};
const conWhatsapp = (whatsapp: string): SiteSettings => ({ ...AJUSTES_SANOS, whatsapp });

function conPresentaciones(parcial: Partial<PresentacionesContent>): SiteContentData {
  return { ...NAYOLI, presentaciones: { ...NAYOLI.presentaciones, ...parcial } };
}
const destinos = (c: SiteContentData, cats: string[], listo = true) =>
  avisosDeConfiguracion(c, cats, listo, AJUSTES_SANOS).filter(a => a.clave.startsWith('presentaciones-destino'));
const imagenes = (c: SiteContentData, cats: string[], listo = true) =>
  avisosDeConfiguracion(c, cats, listo, AJUSTES_SANOS).filter(a => a.clave.startsWith('presentaciones-imagen'));
const whatsapps = (s: SiteSettings) =>
  avisosDeConfiguracion(NAYOLI, CATS_NAYOLI, true, s).filter(a => a.clave === 'negocio-whatsapp');

test('Nayoli SANO (defaults + catálogo alineado + identidad cargada) → CERO avisos', () => {
  const avisos = avisosDeConfiguracion(NAYOLI, CATS_NAYOLI, true, AJUSTES_SANOS);
  assert.equal(avisos.length, 0, `esperaba 0 avisos, hubo: ${JSON.stringify(avisos)}`);
});

test('#1 destino inexistente — la categoría de la tarjeta no está en el catálogo', () => {
  const c = conPresentaciones({ categoria1: 'Café Descafeinado' });
  const avs = destinos(c, CATS_NAYOLI);
  assert.equal(avs.length, 1);
  assert.equal(avs[0].clave, 'presentaciones-destino-1');
  assert.match(avs[0].mensaje, /Café Descafeinado/);
  assert.equal(avs[0].href, '/admin/tienda?seccion=presentaciones&tarjeta=1');
});

test('#1 usa el MISMO predicado que el editor — un destino que SÍ está en el catálogo NO dispara', () => {
  const c = conPresentaciones({ categoria1: 'Café Molido' }); // está en CATS_NAYOLI
  assert.equal(destinos(c, CATS_NAYOLI).length, 0);
});

test('#1 NO dispara si el catálogo no cargó (no se puede afirmar que la categoría no existe)', () => {
  const c = conPresentaciones({ categoria1: 'Café Descafeinado' });
  assert.equal(destinos(c, [], false).length, 0);
});

test('#1 destino VACÍO no es defecto (lleva a /tienda, todos)', () => {
  const c = conPresentaciones({ categoria1: '' });
  assert.equal(destinos(c, CATS_NAYOLI).length, 0);
});

test('#2 título SIN imagen — tarjeta con label y sin foto → un aviso de imagen', () => {
  const c = conPresentaciones({ imagen1: '' }); // label1 sigue, imagen1 vacía
  const avs = imagenes(c, CATS_NAYOLI);
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
  assert.equal(imagenes(c, CATS_NAYOLI).length, 0);
});

test('una tarjeta OPCIONAL visible por su título dispara sus defectos por SLOT', () => {
  // slot 3 visible por su título; destino inexistente + sin imagen → un aviso de cada tipo, del slot 3.
  const c = conPresentaciones({ label3: 'Cápsulas', copy3: 'x', imagen3: '', categoria3: 'Cápsulas' });
  const avisos = avisosDeConfiguracion(c, CATS_NAYOLI, true, AJUSTES_SANOS);
  assert.ok(avisos.some(a => a.clave === 'presentaciones-destino-3'), 'destino-3 esperado');
  assert.ok(avisos.some(a => a.clave === 'presentaciones-imagen-3'), 'imagen-3 esperado');
  // el enlace aterriza en el BLOQUE de ESA tarjeta (slot 3), no en la pantalla a secas.
  assert.ok(avisos.every(a => a.href === '/admin/tienda?seccion=presentaciones&tarjeta=3'), 'href al slot 3');
});

test('Presentaciones OCULTA (visible:false) → sin avisos aunque haya defectos', () => {
  const c = conPresentaciones({ visible: false, categoria1: 'Inexistente', imagen1: '' });
  assert.equal(avisosDeConfiguracion(c, CATS_NAYOLI, true, AJUSTES_SANOS).length, 0);
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
  const avs = avisosDeConfiguracion(NAYOLI, [], false, conWhatsapp(''));
  assert.equal(avs.filter(a => a.clave === 'negocio-whatsapp').length, 1);
});

test('#8 el mensaje dice la CONSECUENCIA del comprador, no el mecanismo del campo', () => {
  const [av] = whatsapps(conWhatsapp(''));
  assert.match(av.mensaje, /checkout/i, 'nombra dónde lo sufre el comprador');
  assert.doesNotMatch(av.mensaje, /campo|vac[íi]o|SiteSetting|null/i, 'no habla del mecanismo');
});

test('#8 convive con los de Presentaciones — cada defecto es su propio aviso', () => {
  const c = conPresentaciones({ imagen1: '' });
  const avisos = avisosDeConfiguracion(c, CATS_NAYOLI, true, conWhatsapp(''));
  assert.equal(avisos.length, 2);
  assert.deepEqual(avisos.map(a => a.clave).sort(), ['negocio-whatsapp', 'presentaciones-imagen-1']);
});
