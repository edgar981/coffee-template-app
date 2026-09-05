import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bloqueDeTarjeta, slotOpcional, slotVacio } from './puente-tarjetas';
import { SECCIONES_TIENDA } from '@/components/admin/tienda-secciones';
import { tarjetasDePresentaciones } from '@/lib/storefront/presentaciones';
import { DEFAULTS } from '@/lib/config/site-content-defaults';

// Capa 1 del mapeo SLOT → BLOQUE-tarjeta (el puente vista→formulario, § Backlog #46). Afirma que el
// slot de una tarjeta clicada en la vista lleva a su bloque real del descriptor, POR SLOT (no por
// posición), y que el invariante puente↔pieza-opcional se sostiene incluso con relleno fuera de orden.

const PRESENTACIONES = SECCIONES_TIENDA.find(s => s.seccion === 'presentaciones')!;

test('cada slot mapea a su BLOQUE-tarjeta del descriptor (fuente única, por slot)', () => {
  for (const slot of [1, 2, 3, 4]) {
    const b = bloqueDeTarjeta(PRESENTACIONES, slot);
    assert.equal(b?.slot, slot);
    assert.equal(b?.titulo, `Tarjeta ${slot}`);
  }
});

test('un slot fuera de rango → null (el puente no salta a ningún bloque)', () => {
  assert.equal(bloqueDeTarjeta(PRESENTACIONES, 5), null);
  assert.equal(bloqueDeTarjeta(PRESENTACIONES, 0), null);
});

test('una sección SIN bloques-tarjeta → null (el puente no aplica)', () => {
  const hero = SECCIONES_TIENDA.find(s => s.seccion === 'hero')!;
  assert.equal(bloqueDeTarjeta(hero, 1), null);
});

// ── El invariante puente↔pieza-opcional ───────────────────────────────────────────────────────────
const base = DEFAULTS.presentaciones;

test('slotOpcional: 1-2 requeridos (false), 3-4 opcionales (true)', () => {
  assert.equal(slotOpcional(PRESENTACIONES, 1), false);
  assert.equal(slotOpcional(PRESENTACIONES, 2), false);
  assert.equal(slotOpcional(PRESENTACIONES, 3), true);
  assert.equal(slotOpcional(PRESENTACIONES, 4), true);
});

const comoForm = (o: unknown) => o as Record<string, unknown>;

test('slotVacio: todo en blanco → vacío; cualquier campo con algo → no vacío', () => {
  const vacio = { ...base, label3: '', copy3: '', categoria3: '', imagen3: '', label4: '', copy4: '', categoria4: '', imagen4: '' };
  assert.equal(slotVacio(comoForm(vacio), 3), true);
  assert.equal(slotVacio(comoForm(vacio), 4), true);
  assert.equal(slotVacio(comoForm({ ...vacio, copy3: 'algo' }), 3), false);      // sólo descripción → no vacío
  assert.equal(slotVacio(comoForm({ ...vacio, imagen4: '/x.webp' }), 4), false); // sólo imagen → no vacío
  assert.equal(slotVacio(comoForm(base), 1), false); // los requeridos traen defaults → nunca vacíos
});

test('INVARIANTE puente↔pieza-opcional: toda tarjeta VISIBLE tiene su bloque montado y expandido', () => {
  // Una pieza opcional COLAPSADA (detrás de "+ Agregar tarjeta") no monta su bloque → no tendría
  // destino de scroll. La garantía es que un slot que produce tarjeta VISIBLE nunca es colapsable
  // (visible = label O imagen; colapsable = opcional Y vacío = ambos, y más, en blanco). Se prueba en
  // varias configuraciones, INCLUIDA la de relleno fuera de orden (slot 4 lleno con el 3 vacío).
  const configs = [
    base,
    { ...base, label3: 'Tortas', imagen3: '' },                       // opcional visible sólo por título
    { ...base, label3: '', imagen3: '', label4: 'Postres', imagen4: '/p.webp' }, // slot 4 lleno, 3 vacío
    { ...base, label3: 'A', imagen3: '/a.webp', label4: 'B', imagen4: '/b.webp' }, // las 4
  ];
  for (const form of configs) {
    for (const t of tarjetasDePresentaciones(form)) {
      const colapsable = slotOpcional(PRESENTACIONES, t.slot) && slotVacio(comoForm(form), t.slot);
      assert.equal(colapsable, false, `slot visible ${t.slot} no debe ser colapsable`);
    }
  }
});
