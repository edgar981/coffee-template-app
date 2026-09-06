import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  planesDeSuscripcion,
  pasosDeSuscripcion,
  planesDelTeaser,
  opcionesDestaque,
  gridColsPlanes,
  gridColsTeaser,
  type PlanSuscripcion,
} from './planes-suscripcion';
import { DEFAULTS, type SuscripcionPlanesContent } from '../config/site-content-defaults';

// § Backlog #49 — los planes de suscripción pasan a ser DATO. El invariante que MANDA es
// BYTE-IDÉNTICO: los defaults resueltos deben reproducir los `SUBSCRIPTION_PLANS`/`SUBSCRIPTION_STEPS`
// que hoy vive en el mock/constante (retirados en esta tanda). Se capturan sus valores como FIXTURE y
// se comparan contra lo que `planesDeSuscripcion`/`pasosDeSuscripcion` derivan de `DEFAULTS`. Si un
// default se desvía, este test cae — es la red que impide romper Nayoli sin darse cuenta.

// FIXTURE: los `SUBSCRIPTION_PLANS` de hoy (verbatim del `lib/mock/subscriptions.ts` retirado).
const PLANES_VIEJOS = [
  { nombre: 'Plan 250 g', descripcion: 'Una bolsa de 250 g cada mes',
    beneficios: ['Grano o molido, como prefieras', 'El mismo café de nuestra finca en Supatá', 'Tostado fresco en tandas semanales'], popular: false },
  { nombre: 'Plan 500 g', descripcion: 'Una bolsa de 500 g cada mes',
    beneficios: ['Grano o molido, como prefieras', 'El mismo café de nuestra finca en Supatá', 'Tostado fresco en tandas semanales'], popular: true },
  { nombre: 'Plan Familiar', descripcion: 'Dos bolsas de 500 g cada mes',
    beneficios: ['Grano o molido, como prefieras', 'Ideal para el hogar o la oficina', 'Tostado fresco en tandas semanales'], popular: false },
];

// FIXTURE: los `SUBSCRIPTION_STEPS` de hoy (verbatim del `constants/subscription-steps.ts` retirado).
const PASOS_VIEJOS = [
  { label: 'Elige tu plan', descripcion: 'Selecciona la frecuencia y cantidad que mejor se adapte a ti.' },
  { label: 'Elige grano o molido', descripcion: 'Siempre el mismo café de nuestra finca — tú eliges cómo lo prefieres.' },
  { label: 'Tostamos fresco', descripcion: 'Tostamos tu café en tandas semanales, días antes del envío.' },
  { label: 'Recíbelo en casa', descripcion: 'Enviamos tu café fresco a todo el país.' },
];

test('BYTE-IDÉNTICO: los planes derivados de los DEFAULTS reproducen los SUBSCRIPTION_PLANS de hoy', () => {
  const planes = planesDeSuscripcion(DEFAULTS.suscripcionPlanes);
  assert.equal(planes.length, PLANES_VIEJOS.length, 'Nayoli tiene 3 planes (el 4º slot vacío se filtra)');
  planes.forEach((p, i) => {
    assert.equal(p.nombre, PLANES_VIEJOS[i].nombre);
    assert.equal(p.descripcion, PLANES_VIEJOS[i].descripcion);
    assert.deepEqual(p.beneficios, PLANES_VIEJOS[i].beneficios, 'los 3 beneficios, sin el 4º vacío');
    assert.equal(p.destacado, PLANES_VIEJOS[i].popular, 'destacadoSlot=2 reproduce el `popular` del Plan 500 g');
    assert.equal(p.precio, '', 'Nayoli no lleva precio (vacío → el componente lo omite)');
  });
});

test('BYTE-IDÉNTICO: los pasos derivados reproducen los SUBSCRIPTION_STEPS de hoy', () => {
  const pasos = pasosDeSuscripcion(DEFAULTS.suscripcionPasos);
  assert.deepEqual(pasos, PASOS_VIEJOS);
});

test('cardinalidad: plan 1 SIEMPRE; planes 2-4 sólo con nombre (como Presentaciones)', () => {
  // Sólo el slot 1 con nombre → un solo plan.
  const unSolo: SuscripcionPlanesContent = {
    ...DEFAULTS.suscripcionPlanes,
    nombre2: '', nombre3: '', nombre4: '',
  };
  const planes = planesDeSuscripcion(unSolo);
  assert.equal(planes.length, 1);
  assert.equal(planes[0].slot, 1);

  // Slot 3 lleno FUERA DE ORDEN (slot 2 vacío): el slot se PRESERVA a través del filtro.
  const fueraDeOrden: SuscripcionPlanesContent = {
    ...DEFAULTS.suscripcionPlanes,
    nombre2: '', nombre3: 'Plan Grande', nombre4: '',
  };
  const p2 = planesDeSuscripcion(fueraDeOrden);
  assert.deepEqual(p2.map(p => p.slot), [1, 3], 'plan 1 + el slot 3, sin el 2');
});

test('beneficios: se COMPACTAN los vacíos (el 4º slot no aparece; un hueco interior se cierra)', () => {
  const conHueco: SuscripcionPlanesContent = {
    ...DEFAULTS.suscripcionPlanes,
    ben1_1: 'A', ben1_2: '', ben1_3: 'C', ben1_4: '',
  };
  assert.deepEqual(planesDeSuscripcion(conHueco)[0].beneficios, ['A', 'C']);
});

test('destacadoSlot: vacío = ninguno destacado; un slot inválido no destaca nada', () => {
  const ninguno = planesDeSuscripcion({ ...DEFAULTS.suscripcionPlanes, destacadoSlot: '' });
  assert.ok(ninguno.every(p => !p.destacado));
  const invalido = planesDeSuscripcion({ ...DEFAULTS.suscripcionPlanes, destacadoSlot: '9' });
  assert.ok(invalido.every(p => !p.destacado));
});

// El recorte del teaser (§ d): con planes ≤ cap va byte-idéntico; si sobra Y el destacado queda fuera,
// el destacado se incluye (reemplaza al último) — un anzuelo no puede esconder el plan que se empuja.
const plan = (slot: number, destacado = false): PlanSuscripcion =>
  ({ slot, nombre: `Plan ${slot}`, descripcion: '', precio: '', beneficios: [], destacado });

test('teaser: planes ≤ cap → TODOS en orden natural (byte-idéntico)', () => {
  const tres = [plan(1), plan(2, true), plan(3)];
  assert.deepEqual(planesDelTeaser(tres, 3), tres);
});

test('teaser: destacado FUERA del recorte → se incluye reemplazando al último', () => {
  const cuatro = [plan(1), plan(2), plan(3), plan(4, true)];
  const recorte = planesDelTeaser(cuatro, 3);
  assert.deepEqual(recorte.map(p => p.slot), [1, 2, 4], 'el destacado (4) reemplaza al último (3)');
  assert.ok(recorte.some(p => p.destacado), 'el destacado quedó incluido');
});

test('teaser: destacado YA dentro del recorte → recorte natural, sin reemplazo', () => {
  const cuatro = [plan(1), plan(2, true), plan(3), plan(4)];
  assert.deepEqual(planesDelTeaser(cuatro, 3).map(p => p.slot), [1, 2, 3]);
});

// El select de destaque (§ FIX 2): opciones derivadas de los planes que EXISTEN, no del tope.
test('destaque: las opciones son "Ninguno" + los planes que existen (con su nombre)', () => {
  const opts = opcionesDestaque(DEFAULTS.suscripcionPlanes);
  assert.deepEqual(opts, [
    { value: '',  label: 'Ninguno' },
    { value: '1', label: 'Plan 250 g' },
    { value: '2', label: 'Plan 500 g' },
    { value: '3', label: 'Plan Familiar' },
  ], 'con 3 planes: Ninguno + los 3, NO un 4º fantasma');
});

test('destaque: al agregar el 4º plan, aparece en la lista', () => {
  const opts = opcionesDestaque({ ...DEFAULTS.suscripcionPlanes, nombre4: 'Plan Oficina' });
  assert.deepEqual(opts.map(o => o.value), ['', '1', '2', '3', '4']);
  assert.equal(opts[4].label, 'Plan Oficina');
});

test('destaque COLGANDO: si el destacado apunta a un plan vaciado, se muestra "vacío" (no se pierde en silencio)', () => {
  // destacadoSlot='3' pero el plan 3 se vació (nombre3 → '') → el plan 3 ya no existe.
  const opts = opcionesDestaque({ ...DEFAULTS.suscripcionPlanes, destacadoSlot: '3', nombre3: '' });
  // Ninguno + plan 1 + plan 2 + la opción colgante del 3.
  assert.deepEqual(opts.map(o => o.value), ['', '1', '2', '3']);
  assert.match(opts[3].label, /vacío/, 'el slot 3 colgante se marca "vacío", no se omite');
  // Y la tienda NO destaca una tarjeta que no está: ningún plan visible tiene slot 3.
  const planes = planesDeSuscripcion({ ...DEFAULTS.suscripcionPlanes, destacadoSlot: '3', nombre3: '' });
  assert.ok(planes.every(p => !p.destacado), 'ningún plan visible queda destacado');
});

test('destaque: un destacado VÁLIDO no agrega opción colgante', () => {
  const opts = opcionesDestaque({ ...DEFAULTS.suscripcionPlanes, destacadoSlot: '2' });
  assert.deepEqual(opts.map(o => o.value), ['', '1', '2', '3']); // sin colgante
});

test('grids: lookups LITERALES por conteo (byte-idéntico Nayoli con 3)', () => {
  assert.equal(gridColsPlanes(1), 'md:grid-cols-1');
  assert.equal(gridColsPlanes(2), 'md:grid-cols-2');
  assert.equal(gridColsPlanes(3), 'md:grid-cols-3'); // Nayoli
  assert.equal(gridColsPlanes(4), 'md:grid-cols-2'); // 2×2
  assert.equal(gridColsTeaser(3), 'sm:grid-cols-3'); // Nayoli, byte-idéntico
});
