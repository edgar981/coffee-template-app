import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  problemaDeNuevaOrden, lineasConProducto, type ProductoParaLinea,
} from './nueva-orden';
import type { OrderForm } from '@/types/order';

// El catálogo mínimo: uno CON opciones de molienda y uno sin ellas. Es la
// distinción que la regla mira, y no hace falta nada más.
const CATALOGO: ProductoParaLinea[] = [
  { slug: 'molido-250', nombre: 'Nayoli Molido 250 g',
    moliendasOpciones: [{ nombre: 'Media', disponible: true }, { nombre: 'Fina', disponible: false }] },
  { slug: 'grano-500', nombre: 'Nayoli Grano 500 g', moliendasOpciones: [] },
];

const base: OrderForm = {
  cliente_nombre: 'Laura Cárdenas',
  cliente_email: '',
  cliente_telefono: '3001234567',
  canal: 'whatsapp',
  costo_envio: '0',
  direccion_entrega: '',
  ciudad_entrega: '',
  departamento: '',
  notas_internas: '',
  items: [{ slug: 'grano-500', cantidad: 1, molienda: '' }],
  metodoPagoPrevisto: '',
  pagoRecibido: false,
};

const form = (patch: Partial<OrderForm>): OrderForm => ({ ...base, ...patch });

test('un formulario completo no tiene problema', () => {
  assert.equal(problemaDeNuevaOrden(base, CATALOGO), null);
});

// ── El nombre ───────────────────────────────────────────────────────────────

test('sin nombre, el problema es el nombre', () => {
  const p = problemaDeNuevaOrden(form({ cliente_nombre: '' }), CATALOGO);
  assert.equal(p?.campo, 'cliente_nombre');
});

// LA DIVERGENCIA QUE ESTO CIERRA: el `disabled` del botón viejo miraba
// `!form.cliente_nombre` SIN trim, así que habilitaba el envío y el submit lo
// rechazaba con un toast. Con una sola fuente, las dos mitades dicen lo mismo.
test('un nombre de PUROS ESPACIOS no es un nombre', () => {
  const p = problemaDeNuevaOrden(form({ cliente_nombre: '   ' }), CATALOGO);
  assert.equal(p?.campo, 'cliente_nombre');
});

// ── El contacto: uno de los dos alcanza ─────────────────────────────────────

test('sin teléfono NI correo, falta el contacto', () => {
  const p = problemaDeNuevaOrden(form({ cliente_telefono: '', cliente_email: '' }), CATALOGO);
  assert.equal(p?.campo, 'contacto');
});

test('sólo el correo alcanza', () => {
  const p = problemaDeNuevaOrden(form({ cliente_telefono: '', cliente_email: 'l@ej.com' }), CATALOGO);
  assert.equal(p, null);
});

test('sólo el teléfono alcanza — es el caso NORMAL (los pedidos llegan por WhatsApp)', () => {
  const p = problemaDeNuevaOrden(form({ cliente_email: '', cliente_telefono: '3001234567' }), CATALOGO);
  assert.equal(p, null);
});

test('un contacto de puros espacios no es un contacto', () => {
  const p = problemaDeNuevaOrden(form({ cliente_telefono: '  ', cliente_email: ' ' }), CATALOGO);
  assert.equal(p?.campo, 'contacto');
});

// ── Las líneas ──────────────────────────────────────────────────────────────

test('una fila SIN producto elegido no cuenta como línea', () => {
  const f = form({ items: [{ slug: '', cantidad: 1, molienda: '' }] });
  assert.equal(lineasConProducto(f).length, 0);
  assert.equal(problemaDeNuevaOrden(f, CATALOGO)?.campo, 'items');
});

test('una fila vacía JUNTO a una llena no estorba — es la fila que el operador no llenó', () => {
  const f = form({ items: [
    { slug: 'grano-500', cantidad: 1, molienda: '' },
    { slug: '', cantidad: 1, molienda: '' },
  ] });
  assert.equal(problemaDeNuevaOrden(f, CATALOGO), null);
});

// ── La molienda: sólo si el producto la ofrece ──────────────────────────────

test('un producto CON opciones exige molienda, y el mensaje lo NOMBRA', () => {
  const f = form({ items: [{ slug: 'molido-250', cantidad: 1, molienda: '' }] });
  const p = problemaDeNuevaOrden(f, CATALOGO);
  assert.equal(p?.campo, 'molienda');
  assert.match(p!.mensaje, /Nayoli Molido 250 g/);
});

test('un producto SIN opciones no pide molienda', () => {
  const f = form({ items: [{ slug: 'grano-500', cantidad: 1, molienda: '' }] });
  assert.equal(problemaDeNuevaOrden(f, CATALOGO), null);
});

test('la molienda de la SEGUNDA línea también se mira', () => {
  const f = form({ items: [
    { slug: 'grano-500', cantidad: 1, molienda: '' },
    { slug: 'molido-250', cantidad: 2, molienda: '' },
  ] });
  assert.equal(problemaDeNuevaOrden(f, CATALOGO)?.campo, 'molienda');
});

// Un slug que el catálogo no conoce no puede exigir molienda: no se sabe si la
// ofrece. Lo rechaza el servidor, que es quien tiene el catálogo de verdad.
test('un producto desconocido no inventa una exigencia de molienda', () => {
  const f = form({ items: [{ slug: 'fantasma', cantidad: 1, molienda: '' }] });
  assert.equal(problemaDeNuevaOrden(f, CATALOGO), null);
});

// ── "El pago ya fue recibido" ───────────────────────────────────────────────

test('"ya pagado" SIN método es un pago sin instrumento', () => {
  const f = form({ pagoRecibido: true, metodoPagoPrevisto: '' });
  assert.equal(problemaDeNuevaOrden(f, CATALOGO)?.campo, 'metodoPagoPrevisto');
});

test('"ya pagado" CON método concreto pasa', () => {
  const f = form({ pagoRecibido: true, metodoPagoPrevisto: 'NEQUI' });
  assert.equal(problemaDeNuevaOrden(f, CATALOGO), null);
});

test('un método sin "ya pagado" es sólo la intención declarada, y pasa', () => {
  const f = form({ pagoRecibido: false, metodoPagoPrevisto: 'NEQUI' });
  assert.equal(problemaDeNuevaOrden(f, CATALOGO), null);
});

// ── El ORDEN de los chequeos es el del formulario ───────────────────────────
//
// Con TODO mal, lo que se reporta es lo primero que el operador va a encontrar
// yendo de arriba hacia abajo. Mandarlo al final del formulario y de vuelta
// arriba es lo que este orden evita.
test('con todo mal, gana el problema de más arriba', () => {
  const f = form({
    cliente_nombre: '', cliente_email: '', cliente_telefono: '',
    items: [{ slug: 'molido-250', cantidad: 1, molienda: '' }],
    pagoRecibido: true, metodoPagoPrevisto: '',
  });
  assert.equal(problemaDeNuevaOrden(f, CATALOGO)?.campo, 'cliente_nombre');
});

test('resuelto el nombre, aparece el contacto — y así hacia abajo', () => {
  const f = form({
    cliente_email: '', cliente_telefono: '',
    items: [{ slug: 'molido-250', cantidad: 1, molienda: '' }],
    pagoRecibido: true, metodoPagoPrevisto: '',
  });
  assert.equal(problemaDeNuevaOrden(f, CATALOGO)?.campo, 'contacto');
});
