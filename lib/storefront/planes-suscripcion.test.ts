import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  planesDeSuscripcion,
  planesDelTeaser,
  opcionesDestaque,
  gridColsPlanes,
  gridColsTeaser,
  type PlanSuscripcion,
} from './planes-suscripcion';
import { DEFAULTS, type SuscripcionPlanesContent } from '../config/site-content-defaults';

// § Backlog #49 — los planes de suscripción pasaron a ser DATO. Este archivo probaba dos cosas
// DISTINTAS bajo el mismo `describe` implícito: la MIGRACIÓN (que mudar el contenido de
// `lib/mock/subscriptions.ts`/`constants/subscription-steps.ts` a `DEFAULTS` no perdiera nada) y la
// CONDUCTA del resolver (cardinalidad, compactación de beneficios, la regla "sin nombre no se
// muestra", los recortes del teaser). Las pruebas de conducta SIGUEN ACÁ, abajo — no dependen de qué
// texto traigan los defaults.
//
// LAS DOS PRUEBAS "BYTE-IDÉNTICO" (planes y pasos) SE RETIRARON en CONTENIDO-NEUTRALIZAR-CIERRE-1.
// Eran el GUARD de esa migración: comparaban `planesDeSuscripcion(DEFAULTS.suscripcionPlanes)` contra
// una copia verbatim de los dos módulos retirados, para que mover el contenido no cambiara ni una
// palabra. Esa migración YA TERMINÓ (los dos módulos no existen desde hace rato) y el guard cumplió su
// función. Mantenerlo vivo hoy afirmaría lo CONTRARIO de lo que este slice decide a propósito: que los
// defaults de `DEFAULTS.suscripcionPlanes`/`suscripcionPasos` siguen siendo el contenido de un cliente
// (Café Nayoli) para siempre. La propiedad que hoy importa es la inversa —que los defaults NO son de
// ningún cliente— y esa vive en `lib/config/site-content-defaults.test.ts`, no acá.

test('REGLA ÚNICA (FIX A): un plan sin nombre NO se muestra — TAMBIÉN el slot 1, y TAMBIÉN si es el destacado', () => {
  // Slot 1 (antes forzado por `req`) sin nombre → NO se muestra. Con destacadoSlot=1 tampoco.
  const p1 = planesDeSuscripcion({ ...DEFAULTS.suscripcionPlanes, destacadoSlot: '1', nombre1: '' });
  assert.deepEqual(p1.map(p => p.slot), [2, 3], 'el plan 1 destacado sin nombre se filtra igual que uno opcional');
  assert.ok(p1.every(p => !p.destacado), 'y no queda ningún destacado colgando');
});

test('cardinalidad: planes 2-4 sólo con nombre (como Presentaciones); el piso lo da el resolver', () => {
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
//
// DERIVADO de DEFAULTS (§ CONTENIDO-NEUTRALIZAR-3): antes comparaba contra los nombres LITERALES
// ('Plan 250 g'/'Plan 500 g'/'Plan Familiar'), una segunda declaración del mismo contenido que
// `site-content-defaults.ts` — la misma falla que este repo ya pagó cuatro veces (§ CLAUDE.md,
// "documentar el criterio"). Lo que esta prueba afirma no es CUÁLES son los nombres, sino que
// `opcionesDestaque` los REFLEJA: exactamente 4 opciones (Ninguno + los 3 planes CON nombre, sin un
// 4º fantasma — el plan 4 nace vacío), en orden de slot, y el label es el nombre CONFIGURADO tal
// cual — no el fallback `Plan ${slot}` (que sólo aparece si el nombre viniera vacío). Eso sigue
// siendo una afirmación real aunque los nombres cambien: si `opcionesDestaque` alguna vez cayera al
// fallback en vez de pasar el nombre, o si el plan 4 (sin nombre) colara una opción de más, esta
// prueba lo atrapa igual.
test('destaque: las opciones son "Ninguno" + los planes que existen (con su nombre configurado, no el fallback)', () => {
  const { nombre1, nombre2, nombre3 } = DEFAULTS.suscripcionPlanes;
  const opts = opcionesDestaque(DEFAULTS.suscripcionPlanes);
  assert.deepEqual(opts, [
    { value: '',  label: 'Ninguno' },
    { value: '1', label: nombre1 },
    { value: '2', label: nombre2 },
    { value: '3', label: nombre3 },
  ], 'con 3 planes: Ninguno + los 3 nombres configurados, en orden de slot, NO un 4º fantasma');
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
