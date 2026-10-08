import { test } from 'node:test';
import assert from 'node:assert/strict';

import { esRutaActiva, claseSubrayadoActivoDelTema, claseSubrayadoActivoPropio } from './nav-activo';

// ── esRutaActiva ─────────────────────────────────────────────────────────────────────────────────

test('match exacto: la página actual activa su propio ítem', () => {
  assert.equal(esRutaActiva('/tienda', '/tienda'), true);
});

test('subruta: /tienda/algo activa el ítem /tienda', () => {
  assert.equal(esRutaActiva('/tienda/algo', '/tienda'), true);
});

test('subruta profunda: /tienda/categoria/producto también activa /tienda', () => {
  assert.equal(esRutaActiva('/tienda/categoria/producto', '/tienda'), true);
});

test('una ruta DISTINTA que no es subruta no activa', () => {
  assert.equal(esRutaActiva('/nosotros', '/tienda'), false);
});

test('REGRESIÓN: un path que comparte PREFIJO LITERAL pero no es subruta real NO activa (el bug de `startsWith` crudo)', () => {
  // '/tienda-outlet'.startsWith('/tienda') sería true con la regla vieja — el visitante no está
  // en "Tienda", está en una ruta distinta que sólo comparte las primeras letras.
  assert.equal(esRutaActiva('/tienda-outlet', '/tienda'), false);
});

test('la HOME (/) nunca activa un ítem de menú real', () => {
  assert.equal(esRutaActiva('/', '/tienda'), false);
  assert.equal(esRutaActiva('/', '/suscripciones'), false);
  assert.equal(esRutaActiva('/', '/nosotros'), false);
});

test('GUARDA: si algún día un ítem declarara path "/", sólo matchea la home exacta — nunca activa de más por ser prefijo de TODO pathname', () => {
  assert.equal(esRutaActiva('/', '/'), true);
  assert.equal(esRutaActiva('/tienda', '/'), false);
});

// ── claseSubrayadoActivoDelTema — el tema CON subrayado al hover (CORTE) deja el suyo FIJO ────────

test('activo + tema con subrayado → fuerza el mismo mecanismo (after:scale-x-100)', () => {
  assert.equal(claseSubrayadoActivoDelTema(true, true), 'after:scale-x-100');
});

test('activo + tema SIN subrayado → no toca ese mecanismo (lo cubre la línea propia, abajo)', () => {
  assert.equal(claseSubrayadoActivoDelTema(true, false), '');
});

test('inactivo, con o sin subrayado del tema → nunca fuerza nada', () => {
  assert.equal(claseSubrayadoActivoDelTema(false, true), '');
  assert.equal(claseSubrayadoActivoDelTema(false, false), '');
});

// ── claseSubrayadoActivoPropio — el resto del catálogo gana su propia línea fija ───────────────────

test('activo + tema SIN subrayado → línea fija, en el color heredado (bg-current, sin token nuevo)', () => {
  const clase = claseSubrayadoActivoPropio(true, false);
  assert.match(clase, /after:bg-current/);
  assert.doesNotMatch(clase, /scale-x/, 'no reusa el mecanismo de hover — es una línea SIEMPRE visible, no animada');
});

test('activo + tema CON subrayado → vacío: ese caso lo cubre claseSubrayadoActivoDelTema, no esta función', () => {
  assert.equal(claseSubrayadoActivoPropio(true, true), '');
});

test('inactivo, con o sin subrayado del tema → nunca pinta línea', () => {
  assert.equal(claseSubrayadoActivoPropio(false, false), '');
  assert.equal(claseSubrayadoActivoPropio(false, true), '');
});

// ── Las dos funciones de subrayado son MUTUAMENTE EXCLUYENTES para cualquier combinación ─────────

test('invariante: nunca las dos clases de subrayado activo a la vez', () => {
  for (const activo of [true, false]) {
    for (const subrayadoDelTema of [true, false]) {
      const a = claseSubrayadoActivoDelTema(activo, subrayadoDelTema);
      const b = claseSubrayadoActivoPropio(activo, subrayadoDelTema);
      assert.ok(a === '' || b === '', `activo=${activo} subrayadoDelTema=${subrayadoDelTema} dieron las dos no-vacías`);
    }
  }
});
