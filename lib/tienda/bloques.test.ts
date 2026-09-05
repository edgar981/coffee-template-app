import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bloquesResueltos } from './bloques';
import { SECCIONES_TIENDA } from '@/components/admin/tienda-secciones';

// LA RED DE SEGURIDAD (§ directiva 1): sin `bloques` declarados, TODA sección resuelve a UN bloque
// `seccion` con TODAS sus imágenes y campos → la cáscara la dibuja como antes. Se afirma para las
// SIETE secciones para que la migración a bloques no pueda romper una no migrada por accidente.

test('sin `bloques` → UN bloque `seccion` con todas las imágenes y campos (red de seguridad)', () => {
  for (const config of SECCIONES_TIENDA) {
    const bloques = bloquesResueltos(config);
    assert.equal(bloques.length, 1, `${config.seccion}: un solo bloque`);
    assert.equal(bloques[0].tipo, 'seccion');
    assert.deepEqual(bloques[0].imagenes, config.imagenes, `${config.seccion}: todas las imágenes`);
    assert.deepEqual(bloques[0].campos, config.campos, `${config.seccion}: todos los campos`);
  }
});

test('un bloque `seccion` DECLARADO resuelve los NOMBRES a sus descriptores, en orden', () => {
  const base = SECCIONES_TIENDA.find(s => s.seccion === 'presentaciones')!;
  const config = { ...base, bloques: [{ tipo: 'seccion' as const, imagenes: ['imagen1'], campos: ['label1', 'copy1'] }] };
  const [b] = bloquesResueltos(config);
  assert.equal(b.tipo, 'seccion');
  assert.deepEqual(b.imagenes.map(i => i.name), ['imagen1']);
  assert.deepEqual(b.campos.map(c => c.name), ['label1', 'copy1']);
  // Los descriptores son los REALES del config (no copias vacías).
  assert.equal(b.campos[0].label, 'Nombre');
});

test('un bloque sin `campos`/`imagenes` declarados resuelve a listas vacías (no lanza)', () => {
  const base = SECCIONES_TIENDA.find(s => s.seccion === 'subscriptionCTA')!;
  const config = { ...base, bloques: [{ tipo: 'seccion' as const }] };
  const [b] = bloquesResueltos(config);
  assert.deepEqual(b.imagenes, []);
  assert.deepEqual(b.campos, []);
});
