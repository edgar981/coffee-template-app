import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bloquesResueltos } from './bloques';
import { SECCIONES_TIENDA } from '@/components/admin/tienda-secciones';

// LA RED DE SEGURIDAD (§ directiva 1): sin `bloques` declarados, TODA sección resuelve a UN bloque
// `seccion` con TODAS sus imágenes y campos → la cáscara la dibuja como antes. Se afirma para las
// SIETE secciones para que la migración a bloques no pueda romper una no migrada por accidente.

test('sin `bloques` → UN bloque `seccion` con todas las imágenes y campos (red de seguridad)', () => {
  for (const config of SECCIONES_TIENDA) {
    if (config.bloques) continue; // las que declaran bloques se prueban aparte
    const bloques = bloquesResueltos(config);
    assert.equal(bloques.length, 1, `${config.seccion}: un solo bloque`);
    const b = bloques[0];
    assert.equal(b.tipo, 'seccion');
    if (b.tipo !== 'seccion') throw new Error('narrow');
    assert.deepEqual(b.imagenes, config.imagenes, `${config.seccion}: todas las imágenes`);
    assert.deepEqual(b.campos, config.campos, `${config.seccion}: todos los campos`);
  }
});

test('un bloque `seccion` DECLARADO resuelve los NOMBRES a sus descriptores, en orden', () => {
  const base = SECCIONES_TIENDA.find(s => s.seccion === 'subscriptionCTA')!;
  const config = { ...base, bloques: [{ tipo: 'seccion' as const, campos: ['titulo', 'eyebrow'] }] };
  const [b] = bloquesResueltos(config);
  assert.equal(b.tipo, 'seccion');
  if (b.tipo !== 'seccion') throw new Error('narrow');
  assert.deepEqual(b.campos.map(c => c.name), ['titulo', 'eyebrow']);
  assert.equal(b.campos[0].label, 'Título'); // el descriptor REAL, no una copia vacía
});

test('un bloque sin `campos`/`imagenes` declarados resuelve a listas vacías (no lanza)', () => {
  const base = SECCIONES_TIENDA.find(s => s.seccion === 'subscriptionCTA')!;
  const config = { ...base, bloques: [{ tipo: 'seccion' as const }] };
  const [b] = bloquesResueltos(config);
  assert.equal(b.tipo, 'seccion');
  if (b.tipo !== 'seccion') throw new Error('narrow');
  assert.deepEqual(b.imagenes, []);
  assert.deepEqual(b.campos, []);
});

// ── Presentaciones EN BLOQUES: encabezado + 4 tarjetas por slot ────────────────────────────────────
test('Presentaciones resuelve a un encabezado + 4 tarjetas; cada tarjeta trae su imagen y sus campos', () => {
  const config = SECCIONES_TIENDA.find(s => s.seccion === 'presentaciones')!;
  const bloques = bloquesResueltos(config);
  assert.equal(bloques.length, 5); // encabezado + 4
  assert.equal(bloques[0].tipo, 'seccion');

  const tarjetas = bloques.filter(b => b.tipo === 'tarjeta');
  assert.equal(tarjetas.length, 4);
  for (let i = 0; i < 4; i++) {
    const t = tarjetas[i];
    if (t.tipo !== 'tarjeta') throw new Error('narrow');
    assert.equal(t.slot, i + 1);
    assert.equal(t.imagen?.name, `imagen${i + 1}`);
    assert.deepEqual(t.campos.map(c => c.name), [`label${i + 1}`, `copy${i + 1}`, `categoria${i + 1}`]);
    assert.equal(t.opcional, i + 1 >= 3); // 1-2 requeridas, 3-4 opcionales
  }
});

test('BrandStory resuelve a un COLLAGE (4 imágenes) + un bloque de texto', () => {
  const config = SECCIONES_TIENDA.find(s => s.seccion === 'brandStory')!;
  const bloques = bloquesResueltos(config);
  const collage = bloques.find(b => b.tipo === 'collage');
  assert.ok(collage);
  if (collage?.tipo !== 'collage') throw new Error('narrow');
  assert.deepEqual(collage.imagenes.map(i => i.name), ['imagen1', 'imagen2', 'imagen3', 'imagen4']);
});

test('Suscripción resuelve a una LISTA sobre bullet1..4', () => {
  const config = SECCIONES_TIENDA.find(s => s.seccion === 'subscriptionCTA')!;
  const lista = bloquesResueltos(config).find(b => b.tipo === 'lista');
  assert.ok(lista);
  if (lista?.tipo !== 'lista') throw new Error('narrow');
  assert.deepEqual(lista.slots, ['bullet1', 'bullet2', 'bullet3', 'bullet4']);
  assert.equal(lista.itemLabel, 'beneficio');
});
