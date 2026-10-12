import { test } from 'node:test';
import assert from 'node:assert/strict';

import { aplicaAComposicion, particionarBloques, nombresDelBloque, tituloPlegado } from './editor-composicion-campos';
import { SECCIONES_TIENDA } from '@/components/admin/tienda-secciones';
import { bloquesResueltos } from '@/lib/tienda/bloques';

// ─── aplicaAComposicion ─────────────────────────────────────────────────────────────────────────────

test('aplicaAComposicion: sin `composiciones` declarado, aplica a CUALQUIER composición (el default)', () => {
  assert.equal(aplicaAComposicion({ composiciones: undefined }, 'taquilla'), true);
  assert.equal(aplicaAComposicion(undefined, 'taquilla'), true);
});

test('aplicaAComposicion: con `composiciones`, sólo aplica a las nombradas', () => {
  const campo = { composiciones: ['tarjetas'] };
  assert.equal(aplicaAComposicion(campo, 'tarjetas'), true);
  assert.equal(aplicaAComposicion(campo, 'taquilla'), false);
});

test('aplicaAComposicion: sin composición activa (la sección no declara `composiciones`), todo aplica', () => {
  assert.equal(aplicaAComposicion({ composiciones: ['tarjetas'] }, undefined), true);
});

// ─── particionarBloques: el caso que motivó el slice — Planes bajo Taquilla ────────────────────────
// § EDITOR-COMPOSICION-CAMPOS-1 — el hallazgo S1 de la auditoría del 2026-10-12: bajo «Taquilla» el
// panel seguía mostrando el formulario entero de «Tarjetas» (Encabezado, Planes, los 4 planes), y el
// owner no encontraba el texto que acababa de clickear en el lienzo (la Taquilla).

const SUSCRIPCION_PLANES = SECCIONES_TIENDA.find((s) => s.seccion === 'suscripcionPlanes')!;

test('suscripcionPlanes bajo "taquilla": arriba sólo los campos de Taquilla, nunca los de Tarjetas', () => {
  const bloques = bloquesResueltos(SUSCRIPCION_PLANES);
  const { visibles } = particionarBloques(bloques, SUSCRIPCION_PLANES, 'taquilla');
  const nombresVisibles = new Set(visibles.flatMap(nombresDelBloque));

  // Los campos de "Tarjetas" (el defecto reportado) NO deben aparecer arriba.
  for (const n of ['eyebrow', 'titulo', 'tituloEnfasis', 'subtitulo', 'planesTitulo', 'ctaLabel', 'nombre1', 'descripcion1', 'ben1_1']) {
    assert.ok(!nombresVisibles.has(n), `"${n}" (de Tarjetas) no debería estar visible bajo Taquilla`);
  }
  // Los campos propios de Taquilla (incluidos los textos nuevos del item 3) SÍ deben estar.
  for (const n of ['maxBolsas', 'frecuencia1', 'credito1Etiqueta', 'taquillaKicker', 'taquillaCtaLabel', 'taquillaAviso']) {
    assert.ok(nombresVisibles.has(n), `"${n}" (de Taquilla) debería estar visible bajo Taquilla`);
  }
});

test('suscripcionPlanes bajo "tarjetas": arriba sólo los campos de Tarjetas, nunca los de Taquilla', () => {
  const bloques = bloquesResueltos(SUSCRIPCION_PLANES);
  const { visibles } = particionarBloques(bloques, SUSCRIPCION_PLANES, 'tarjetas');
  const nombresVisibles = new Set(visibles.flatMap(nombresDelBloque));

  for (const n of ['maxBolsas', 'frecuencia1', 'credito1Etiqueta', 'taquillaKicker', 'taquillaCtaLabel']) {
    assert.ok(!nombresVisibles.has(n), `"${n}" (de Taquilla) no debería estar visible bajo Tarjetas`);
  }
  for (const n of ['eyebrow', 'titulo', 'planesTitulo', 'nombre1', 'descripcion1']) {
    assert.ok(nombresVisibles.has(n), `"${n}" (de Tarjetas) debería estar visible bajo Tarjetas`);
  }
});

test('suscripcionPlanes bajo "taquilla": el grupo plegado conserva TODOS los campos de Tarjetas — nada se pierde', () => {
  const bloques = bloquesResueltos(SUSCRIPCION_PLANES);
  const { plegados } = particionarBloques(bloques, SUSCRIPCION_PLANES, 'taquilla');
  const nombresPlegados = new Set(plegados.flatMap((g) => [
    ...g.campos.map((c) => c.name),
    ...g.imagenes.map((i) => i.name),
    ...g.bloques.flatMap(nombresDelBloque),
  ]));
  for (const n of ['eyebrow', 'titulo', 'tituloEnfasis', 'subtitulo', 'planesTitulo', 'ctaLabel', 'destacadoSlot', 'nombre1', 'descripcion1', 'precio1', 'ben1_1']) {
    assert.ok(nombresPlegados.has(n), `"${n}" debería quedar plegado (no perdido) bajo Taquilla`);
  }
  // Y el grupo plegado describe la composición "tarjetas", para el título «Sólo con…».
  assert.ok(plegados.some((g) => g.composiciones.includes('tarjetas')));
});

// ─── El recorrido general (item 1 del spec): ningún campo declarado se pierde, para TODA sección
//     con `composiciones`, bajo CUALQUIER valor de esa composición ─────────────────────────────────

const SECCIONES_CON_COMPOSICION = SECCIONES_TIENDA.filter((c) => c.composiciones && c.composiciones.length > 0);

test('hay al menos una sección con composiciones declaradas, para que este recorrido mida algo real', () => {
  assert.ok(SECCIONES_CON_COMPOSICION.length >= 5);
});

for (const config of SECCIONES_CON_COMPOSICION) {
  for (const opcion of config.composiciones!) {
    test(`particionarBloques no pierde ningún campo: ${config.seccion} · ${opcion.value}`, () => {
      const bloques = bloquesResueltos(config);
      const { visibles, plegados } = particionarBloques(bloques, config, opcion.value);
      const nombresVisibles = new Set(visibles.flatMap(nombresDelBloque));
      const nombresPlegados = new Set(plegados.flatMap((g) => [
        ...g.campos.map((c) => c.name),
        ...g.imagenes.map((i) => i.name),
        ...g.bloques.flatMap(nombresDelBloque),
      ]));
      // Todo campo/imagen declarado en la sección (salvo `seccionCruzada`, que vive en su propio
      // grupo aparte de `TiendaSeccionEditor.tsx` y nunca pasa por `bloquesResueltos`/esta función)
      // debe aparecer visible O plegado — nunca desaparecer sin rastro.
      const declarados = [
        ...config.campos.filter((c) => !c.seccionCruzada).map((c) => c.name),
        ...config.imagenes.map((i) => i.name),
      ];
      for (const nombre of declarados) {
        assert.ok(
          nombresVisibles.has(nombre) || nombresPlegados.has(nombre),
          `${config.seccion}.${nombre} desaparece bajo "${opcion.value}" — ni visible ni plegado`,
        );
      }
    });
  }
}

// ─── S2 de la auditoría: la zona «Encabezado» de Taquilla ya NO nombra campos que no renderiza ────

test('S2 cerrado: la zona "Encabezado" de suscripcionPlanes·taquilla no nombra ningún campo de Tarjetas', () => {
  const opcionTaquilla = SUSCRIPCION_PLANES.composiciones!.find((o) => o.value === 'taquilla')!;
  const zonaEncabezado = opcionTaquilla.zonas.find((z) => z.label === 'Encabezado')!;
  for (const n of ['eyebrow', 'titulo', 'tituloEnfasis', 'subtitulo']) {
    assert.ok(!zonaEncabezado.campos.includes(n), `la zona Encabezado de Taquilla no debería nombrar "${n}" (es de Tarjetas)`);
  }
});

// ─── tituloPlegado ──────────────────────────────────────────────────────────────────────────────────

test('tituloPlegado: una composición', () => {
  const opciones = [{ value: 'taquilla', label: 'Taquilla', zonas: [] }];
  assert.equal(tituloPlegado(['taquilla'], opciones), 'Sólo con la composición «Taquilla»');
});

test('tituloPlegado: dos composiciones', () => {
  const opciones = [
    { value: 'mosaico', label: 'Mosaico', zonas: [] },
    { value: 'indice', label: 'Índice', zonas: [] },
  ];
  assert.equal(tituloPlegado(['mosaico', 'indice'], opciones), 'Sólo con las composiciones «Mosaico» y «Índice»');
});

test('tituloPlegado: cae al VALOR crudo si no encuentra el label (no debería pasar en producción, pero no debe tirar)', () => {
  assert.equal(tituloPlegado(['x'], []), 'Sólo con la composición «x»');
});
