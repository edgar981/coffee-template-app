import { test } from 'node:test';
import assert from 'node:assert/strict';
import { grupoDeTarjeta, slotOpcional, slotVacio } from './puente-tarjetas';
import { SECCIONES_TIENDA } from '@/components/admin/tienda-secciones';
import { tarjetasDePresentaciones } from '@/lib/storefront/presentaciones';
import { DEFAULTS } from '@/lib/config/site-content-defaults';

// Capa 1 del mapeo SLOT → grupo del formulario (el puente vista→formulario, § Backlog #46). Afirma
// que el slot de una tarjeta clicada en la vista lleva a su grupo "Tarjeta N" real del descriptor —
// incluidos los slots opcionales (3-4), que llevan el sufijo "(opcional)"—.

const PRESENTACIONES = SECCIONES_TIENDA.find(s => s.seccion === 'presentaciones')!;

test('cada slot mapea a su grupo "Tarjeta N" del descriptor (fuente única, incluye el sufijo opcional)', () => {
  assert.equal(grupoDeTarjeta(PRESENTACIONES, 1), 'Tarjeta 1');
  assert.equal(grupoDeTarjeta(PRESENTACIONES, 2), 'Tarjeta 2');
  assert.equal(grupoDeTarjeta(PRESENTACIONES, 3), 'Tarjeta 3 (opcional)');
  assert.equal(grupoDeTarjeta(PRESENTACIONES, 4), 'Tarjeta 4 (opcional)');
});

test('un slot fuera de rango → null (el puente no salta a ningún grupo)', () => {
  assert.equal(grupoDeTarjeta(PRESENTACIONES, 5), null);
  assert.equal(grupoDeTarjeta(PRESENTACIONES, 0), null);
});

test('el grupo sale del DESCRIPTOR, no de un literal: coincide con el `grupo` del campo label del slot', () => {
  // Si alguien renombra el grupo en el descriptor, este mapeo lo sigue sin tocar el puente.
  for (const slot of [1, 2, 3, 4]) {
    const esperado = PRESENTACIONES.campos.find(c => c.name === `label${slot}`)?.grupo ?? null;
    assert.equal(grupoDeTarjeta(PRESENTACIONES, slot), esperado);
  }
});

// ── Colapso de grupos opcionales vacíos (Defecto 2) ───────────────────────────────────────────────
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

test('INVARIANTE puente↔colapso: toda tarjeta VISIBLE está en un slot NO colapsable (nunca vacío)', () => {
  // Un slot colapsado no registra su grupo → no tendría destino de scroll. La garantía es que un slot
  // que produce tarjeta visible nunca está vacío (visible = label O imagen; vacío = ambos, y más, en
  // blanco). Se prueba en varias configuraciones, incluidas las de relleno fuera de orden.
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
