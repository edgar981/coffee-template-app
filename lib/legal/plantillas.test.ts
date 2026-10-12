import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, type VendedorContent } from '@/lib/config/site-content-defaults';
import {
  vendedorEstaCompleto, camposVendedorFaltantes, CAMPOS_VENDEDOR_REQUERIDOS,
  etiquetaDocumento, etiquetaTipoPersona, nombreParaMostrar, lineaVendedor,
  terminosYCondiciones, politicaDeDatosPersonales, avisoDePrivacidadCorto,
  enviosYDevoluciones, cookies,
  type CapacidadesTienda, type SeccionLegal,
} from './plantillas';

// Un vendedor COMPLETO de prueba — ninguno de los cinco campos requeridos vacío, y todos los
// opcionales-dentro-de-completo LLENOS (para probar la sustitución, no el fallback). Ningún dato
// de rubro: nombre genérico, sin "café" ni ninguna marca real.
const VENDEDOR_COMPLETO: VendedorContent = {
  ...DEFAULTS.vendedor,
  nombreCompleto: 'Ana María Rodríguez',
  tipoPersona: 'natural',
  documentoTipo: 'cc',
  documentoNumero: '1.234.567.890',
  nombreComercial: 'La Tienda de Ana',
  direccion: 'Calle 10 # 20-30',
  ciudad: 'Medellín',
  correo: 'contacto@latienda.test',
  telefono: '+573001234567',
  horarioAtencion: 'Lunes a viernes, 8am a 5pm',
  municipioDespacho: 'Medellín',
  transportadoras: 'Servientrega',
  diasPreparacionHabiles: '2',
  ventanaCambiosDias: '5',
};

const CAP_TODO: CapacidadesTienda = { suscripciones: true, contraentrega: true };
const CAP_NADA: CapacidadesTienda = { suscripciones: false, contraentrega: false };

// ─── Completitud ────────────────────────────────────────────────────────────────────────────────

test('vendedorEstaCompleto: true con los cinco campos requeridos llenos, aunque el resto esté vacío', () => {
  const v: VendedorContent = {
    ...DEFAULTS.vendedor,
    nombreCompleto: 'Ana', documentoNumero: '123', ciudad: 'Cali', correo: 'a@a.com', telefono: '300',
  };
  assert.equal(vendedorEstaCompleto(v), true);
});

test('vendedorEstaCompleto: false con TODO vacío (el default de fábrica)', () => {
  assert.equal(vendedorEstaCompleto(DEFAULTS.vendedor), false);
});

test('vendedorEstaCompleto: false si falta UNO solo de los cinco requeridos', () => {
  for (const campo of CAMPOS_VENDEDOR_REQUERIDOS) {
    const v: VendedorContent = {
      ...DEFAULTS.vendedor,
      nombreCompleto: 'Ana', documentoNumero: '123', ciudad: 'Cali', correo: 'a@a.com', telefono: '300',
      [campo]: '',
    };
    assert.equal(vendedorEstaCompleto(v), false, `faltando «${campo}» debería dar incompleto`);
  }
});

test('vendedorEstaCompleto: un campo con sólo espacios cuenta como vacío (no cuela espacios)', () => {
  const v: VendedorContent = { ...DEFAULTS.vendedor, nombreCompleto: '   ' };
  assert.equal(vendedorEstaCompleto(v), false);
});

test('camposVendedorFaltantes: nombra EXACTAMENTE los requeridos vacíos, en el orden declarado', () => {
  const v: VendedorContent = { ...DEFAULTS.vendedor, ciudad: 'Cali', correo: 'a@a.com' };
  assert.deepEqual(camposVendedorFaltantes(v), ['nombreCompleto', 'documentoNumero', 'telefono']);
});

test('camposVendedorFaltantes: [] cuando está completo', () => {
  assert.deepEqual(camposVendedorFaltantes(VENDEDOR_COMPLETO), []);
});

// ─── Sustitución de cada dato ───────────────────────────────────────────────────────────────────

test('etiquetaDocumento: cc→"C.C.", nit→"NIT", cualquier otra cosa (incluido vacío)→"documento"', () => {
  assert.equal(etiquetaDocumento({ ...DEFAULTS.vendedor, documentoTipo: 'cc' }), 'C.C.');
  assert.equal(etiquetaDocumento({ ...DEFAULTS.vendedor, documentoTipo: 'nit' }), 'NIT');
  assert.equal(etiquetaDocumento({ ...DEFAULTS.vendedor, documentoTipo: '' }), 'documento');
  assert.equal(etiquetaDocumento({ ...DEFAULTS.vendedor, documentoTipo: 'basura' }), 'documento');
});

test('etiquetaTipoPersona: natural/juridica se traducen; cualquier otra cosa cae al genérico', () => {
  assert.equal(etiquetaTipoPersona({ ...DEFAULTS.vendedor, tipoPersona: 'natural' }), 'persona natural');
  assert.equal(etiquetaTipoPersona({ ...DEFAULTS.vendedor, tipoPersona: 'juridica' }), 'persona jurídica');
  assert.equal(etiquetaTipoPersona({ ...DEFAULTS.vendedor, tipoPersona: '' }), 'persona o sociedad');
});

test('nombreParaMostrar: usa el nombre COMERCIAL si existe, si no el nombre completo', () => {
  assert.equal(nombreParaMostrar(VENDEDOR_COMPLETO), 'La Tienda de Ana');
  assert.equal(nombreParaMostrar({ ...VENDEDOR_COMPLETO, nombreComercial: '' }), 'Ana María Rodríguez');
});

test('lineaVendedor: sustituye nombre · documento · ciudad', () => {
  assert.equal(lineaVendedor(VENDEDOR_COMPLETO), 'Vende La Tienda de Ana · C.C. 1.234.567.890 · Medellín');
});

test('lineaVendedor modo "publico": null si falta algo requerido (nunca un hueco al comprador)', () => {
  assert.equal(lineaVendedor({ ...VENDEDOR_COMPLETO, ciudad: '' }, 'publico'), null);
});

test('lineaVendedor modo "editor": marca «[dato pendiente]» en vez de null', () => {
  const linea = lineaVendedor({ ...VENDEDOR_COMPLETO, ciudad: '' }, 'editor');
  assert.match(linea!, /\[dato pendiente\]/);
  assert.match(linea!, /La Tienda de Ana/);
});

function textoCompleto(secciones: SeccionLegal[]): string {
  return secciones.map((s) => `${s.titulo}\n${s.parrafos.join('\n')}`).join('\n');
}

test('terminosYCondiciones: todos los datos del vendedor aparecen sustituidos en el texto', () => {
  const texto = textoCompleto(terminosYCondiciones(VENDEDOR_COMPLETO, CAP_TODO));
  for (const valor of [
    VENDEDOR_COMPLETO.nombreCompleto, VENDEDOR_COMPLETO.documentoNumero, VENDEDOR_COMPLETO.correo,
    VENDEDOR_COMPLETO.telefono, VENDEDOR_COMPLETO.nombreComercial, VENDEDOR_COMPLETO.municipioDespacho,
    VENDEDOR_COMPLETO.transportadoras,
  ]) {
    assert.ok(texto.includes(valor), `falta sustituir «${valor}» en Términos y condiciones`);
  }
});

test('politicaDeDatosPersonales / avisoDePrivacidadCorto: sustituyen identidad y contacto', () => {
  const texto = textoCompleto(politicaDeDatosPersonales(VENDEDOR_COMPLETO));
  assert.ok(texto.includes(VENDEDOR_COMPLETO.nombreCompleto));
  assert.ok(texto.includes(VENDEDOR_COMPLETO.correo));
  assert.ok(texto.includes(VENDEDOR_COMPLETO.telefono));
  const aviso = avisoDePrivacidadCorto(VENDEDOR_COMPLETO);
  assert.ok(aviso.includes(VENDEDOR_COMPLETO.nombreCompleto));
  assert.ok(aviso.includes(VENDEDOR_COMPLETO.correo));
});

test('enviosYDevoluciones: sustituye despacho, transportadora y la ventana de cambios configurada', () => {
  const texto = textoCompleto(enviosYDevoluciones(VENDEDOR_COMPLETO, CAP_TODO));
  assert.ok(texto.includes(VENDEDOR_COMPLETO.municipioDespacho));
  assert.ok(texto.includes(VENDEDOR_COMPLETO.transportadoras));
  assert.ok(texto.includes(`${VENDEDOR_COMPLETO.ventanaCambiosDias} días`));
});

test('cookies: sustituye correo y nombre, sin inventar analítica que la tienda no tiene', () => {
  const texto = textoCompleto(cookies(VENDEDOR_COMPLETO));
  assert.ok(texto.includes(VENDEDOR_COMPLETO.correo));
  assert.ok(/no usamos cookies de publicidad/i.test(texto));
});

// ─── Fallbacks genéricos — ningún dato inventado cuando un campo opcional-dentro-de-completo falta ─

test('sin nombreComercial: las plantillas usan nombreCompleto, sin inventar una marca', () => {
  const v: VendedorContent = { ...VENDEDOR_COMPLETO, nombreComercial: '' };
  const texto = textoCompleto(terminosYCondiciones(v, CAP_TODO));
  assert.ok(texto.includes('Ana María Rodríguez'));
  assert.ok(!texto.includes('«»')); // ninguna marca vacía entre comillas
});

test('sin municipioDespacho: cae a la ciudad del vendedor, no a un municipio inventado', () => {
  const v: VendedorContent = { ...VENDEDOR_COMPLETO, municipioDespacho: '' };
  const texto = textoCompleto(terminosYCondiciones(v, CAP_TODO));
  assert.ok(texto.includes(`desde ${v.ciudad}`));
});

test('sin transportadoras: frase genérica, nunca el nombre de una empresa no confirmada', () => {
  const v: VendedorContent = { ...VENDEDOR_COMPLETO, transportadoras: '' };
  const texto = textoCompleto(terminosYCondiciones(v, CAP_TODO));
  assert.ok(texto.includes('la transportadora que mejor cubra tu zona'));
});

test('sin diasPreparacionHabiles: "en pocos días hábiles", sin comprometer un número', () => {
  const v: VendedorContent = { ...VENDEDOR_COMPLETO, diasPreparacionHabiles: '' };
  const texto = textoCompleto(enviosYDevoluciones(v, CAP_TODO));
  assert.ok(texto.includes('en pocos días hábiles'));
});

test('sin ventanaCambiosDias: la sección dice que hoy no se ofrecen cambios por gusto', () => {
  const v: VendedorContent = { ...VENDEDOR_COMPLETO, ventanaCambiosDias: '' };
  const seccion = enviosYDevoluciones(v, CAP_TODO).find((s) => s.id === 'cambios-por-gusto')!;
  assert.match(seccion.parrafos.join(' '), /no ofrecemos cambios por gusto/i);
});

test('sin horarioAtencion: la línea de horario se omite entera (no un "Horario: " colgando)', () => {
  const v: VendedorContent = { ...VENDEDOR_COMPLETO, horarioAtencion: '' };
  const texto = textoCompleto(terminosYCondiciones(v, CAP_TODO));
  assert.ok(!texto.includes('Horario de atención: .'));
  assert.ok(!/Horario de atención:\s*\./.test(texto));
});

test('sin direccion: cae a la frase "la dirección que te indicamos al contactarnos"', () => {
  const v: VendedorContent = { ...VENDEDOR_COMPLETO, direccion: '' };
  const texto = textoCompleto(terminosYCondiciones(v, CAP_TODO));
  assert.ok(texto.includes('la dirección que te indicamos al contactarnos'));
});

// ─── Cláusulas condicionales según capacidad ───────────────────────────────────────────────────────

test('Términos: la cláusula de suscripciones SÓLO aparece con la capacidad encendida', () => {
  const conSuscripciones = terminosYCondiciones(VENDEDOR_COMPLETO, { suscripciones: true, contraentrega: false });
  const sinSuscripciones = terminosYCondiciones(VENDEDOR_COMPLETO, { suscripciones: false, contraentrega: false });
  assert.ok(conSuscripciones.some((s) => s.id === 'suscripciones'));
  assert.ok(!sinSuscripciones.some((s) => s.id === 'suscripciones'));
});

test('Términos: sin la cláusula de suscripciones, la numeración de las secciones siguientes se corre', () => {
  const con = terminosYCondiciones(VENDEDOR_COMPLETO, { suscripciones: true, contraentrega: false });
  const sin = terminosYCondiciones(VENDEDOR_COMPLETO, { suscripciones: false, contraentrega: false });
  const pqrCon = con.find((s) => s.id === 'pqr')!;
  const pqrSin = sin.find((s) => s.id === 'pqr')!;
  assert.ok(pqrCon.titulo.startsWith('14.'));
  assert.ok(pqrSin.titulo.startsWith('13.'));
});

test('Términos: la mención de contraentrega sólo aparece con esa capacidad encendida', () => {
  const con = textoCompleto(terminosYCondiciones(VENDEDOR_COMPLETO, { suscripciones: false, contraentrega: true }));
  const sin = textoCompleto(terminosYCondiciones(VENDEDOR_COMPLETO, { suscripciones: false, contraentrega: false }));
  assert.ok(/contra entrega/i.test(con));
  assert.ok(!/contra entrega/i.test(sin));
});

test('Envíos: la advertencia de "no aplica a contraentrega" sólo aparece con esa capacidad', () => {
  const con = textoCompleto(enviosYDevoluciones(VENDEDOR_COMPLETO, { suscripciones: false, contraentrega: true }));
  const sin = textoCompleto(enviosYDevoluciones(VENDEDOR_COMPLETO, { suscripciones: false, contraentrega: false }));
  assert.ok(con.includes('no tienen reversión por esta vía'));
  assert.ok(!sin.includes('no tienen reversión por esta vía'));
});

// ─── Ningún término de rubro en la base ────────────────────────────────────────────────────────────
// El texto de origen se escribió para una finca de café (Jofamugo/Nayoli) y este slice lo exige
// generalizado: ningún término de ESE rubro puede sobrevivir en la plantilla fija (lo sustituible
// es el DATO del vendedor, no el texto). Mismo mecanismo que `site-content-defaults.test.ts`
// (TERMINOS_PROHIBIDOS), acotado a lo que de verdad delataría un rubro — "producto"/"empaque" son
// genéricos y se quedan afuera a propósito.
const TERMINOS_PROHIBIDOS = /caf[eé]|nayoli|jofamugo|neider|cundinamarca|\bgrano|molid|tueste|tosta|finca|cafetal|chamisas/i;

test('ningún término de café/Jofamugo/Nayoli sobrevive en ninguna de las cuatro plantillas (capacidades ON)', () => {
  const todo = [
    ...terminosYCondiciones(VENDEDOR_COMPLETO, CAP_TODO),
    ...politicaDeDatosPersonales(VENDEDOR_COMPLETO),
    ...enviosYDevoluciones(VENDEDOR_COMPLETO, CAP_TODO),
    ...cookies(VENDEDOR_COMPLETO),
  ];
  const ofensores = todo.filter((s) => TERMINOS_PROHIBIDOS.test(`${s.titulo} ${s.parrafos.join(' ')}`));
  assert.deepEqual(ofensores.map((s) => s.id), []);
  assert.ok(!TERMINOS_PROHIBIDOS.test(avisoDePrivacidadCorto(VENDEDOR_COMPLETO)));
});

test('ningún término de rubro sobrevive tampoco con las capacidades apagadas (el camino corto)', () => {
  const todo = [
    ...terminosYCondiciones(VENDEDOR_COMPLETO, CAP_NADA),
    ...enviosYDevoluciones(VENDEDOR_COMPLETO, CAP_NADA),
  ];
  const ofensores = todo.filter((s) => TERMINOS_PROHIBIDOS.test(`${s.titulo} ${s.parrafos.join(' ')}`));
  assert.deepEqual(ofensores.map((s) => s.id), []);
});
