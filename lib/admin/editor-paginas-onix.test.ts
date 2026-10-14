import { test } from 'node:test';
import assert from 'node:assert/strict';

import { debeMostrarSelectorComposicion, estadoVisibilidadPagina } from './editor-paginas-onix';
import { SECCIONES_TIENDA } from '@/components/admin/tienda-secciones';
import { bloquesResueltos } from '@/lib/tienda/bloques';

// ─── Punto 1 (§ EDITOR-PAGINAS-ONIX-ARREGLOS-1): el selector sale de los DATOS, no de una lista ────

test('toda sección de SECCIONES_TIENDA con 2+ composiciones (salvo el hero) debe mostrar el selector', () => {
  for (const config of SECCIONES_TIENDA) {
    const esperado = config.seccion !== 'hero' && !!config.composiciones && config.composiciones.length > 1;
    assert.equal(
      debeMostrarSelectorComposicion(config),
      esperado,
      `${config.seccion}: se esperaba ${esperado} (composiciones: ${config.composiciones?.length ?? 0})`,
    );
  }
});

test('el hero NUNCA muestra este selector, aunque declare composiciones — usa su propio diálogo (ComposicionHero)', () => {
  const hero = SECCIONES_TIENDA.find((c) => c.seccion === 'hero');
  assert.ok(hero, 'el hero debería existir en SECCIONES_TIENDA');
  // Si el hero dejara de declarar 2+ composiciones este test dejaría de probar el caso que importa
  // (la exclusión A PESAR de que aplicaría la regla general) — se afirma la premisa, no se asume.
  assert.ok((hero!.composiciones?.length ?? 0) > 1, 'el hero debería declarar 2+ composiciones para que la exclusión sea real');
  assert.equal(debeMostrarSelectorComposicion(hero!), false);
});

// EL HUECO MEDIDO (§ EDITOR-PAGINAS-ONIX-ARREGLOS-1, el censo del orquestador): estas tres secciones
// declaraban `composiciones` y NINGÚN control las mostraba, porque la lista vieja de `seccion === …`
// en TiendaSeccionEditor.tsx nunca las nombró. Sin el fix, `debeMostrarSelectorComposicion` no
// existía — este test se escribió ANTES de verificar que pasa, para que quede registrado qué
// defecto cierra (y quedaría en rojo si alguien reintrodujera una lista a mano incompleta).
test('suscripcionPlanes, tiendaInterludio y tiendaCierre SÍ muestran el selector — el hueco que este slice cierra', () => {
  for (const seccion of ['suscripcionPlanes', 'tiendaInterludio', 'tiendaCierre'] as const) {
    const config = SECCIONES_TIENDA.find((c) => c.seccion === seccion);
    assert.ok(config, `${seccion} debería existir en SECCIONES_TIENDA`);
    assert.ok((config!.composiciones?.length ?? 0) > 1, `${seccion} debería declarar 2+ composiciones`);
    assert.equal(debeMostrarSelectorComposicion(config!), true, `${seccion} debería mostrar el selector`);
  }
});

test('una sección SIN composiciones no muestra el selector', () => {
  const sinComposiciones = SECCIONES_TIENDA.find((c) => !c.composiciones);
  assert.ok(sinComposiciones, 'debería existir al menos una sección sin composiciones para probar el caso negativo');
  assert.equal(debeMostrarSelectorComposicion(sinComposiciones!), false);
});

test('una composición de UNA sola opción (si existiera) no mostraría el selector — nada que elegir', () => {
  // Sintético: no depende de que exista hoy una sección con exactamente 1 composición (puede no
  // haber ninguna), pero el mecanismo tiene que rechazarla si alguna vez aparece.
  const sintetica = { seccion: 'brandStory', composiciones: [{ value: 'a', label: 'A', zonas: [] }] } as unknown as Parameters<typeof debeMostrarSelectorComposicion>[0];
  assert.equal(debeMostrarSelectorComposicion(sintetica), false);
});

// ─── Punto 4 (§ EDITOR-PAGINAS-ONIX-ARREGLOS-1): nosotrosFicha agrupa sus 3 cifras en tarjetas ─────
//
// MEDIDO antes de tocar nada: `nosotrosEscenas` (el repeater de 1-4 escenas) YA renderiza una tarjeta
// COLAPSADA por ítem, una sola abierta a la vez (`RepeaterEditor`, `useState<number|null>(null)`,
// idéntico mecanismo que "Preguntas frecuentes") — no tenía el defecto que el spec describía, y este
// slice NO le cambia nada. El defecto real estaba en `nosotrosFicha`: 7 campos PLANOS (no un
// repeater) que, SIN `bloques`, se dibujan los 7 en fila — el "wall of empty inputs" real.

test('nosotrosFicha agrupa sus 3 cifras en tarjetas (no 7 campos sueltos en fila) — re-medido contra 6 bloques tras § CHAMISAS-APERTURA-ALBUM-AJUSTES-1 (sumó el bloque "titulo"/"bajada" de la composición "etiqueta")', () => {
  const config = SECCIONES_TIENDA.find((c) => c.seccion === 'nosotrosFicha');
  assert.ok(config, 'nosotrosFicha debería existir en SECCIONES_TIENDA');
  const bloques = bloquesResueltos(config!);
  assert.equal(bloques.length, 6, 'un bloque seccion (eyebrow) + un bloque seccion (titulo/bajada, § CHAMISAS-APERTURA-ALBUM-AJUSTES-1) + 3 tarjetas (una por cifra) + un bloque seccion (tituloTarjeta/sello/notaPie)');
  assert.equal(bloques[0].tipo, 'seccion');
  assert.equal(bloques[5].tipo, 'seccion');
  const tarjetas = bloques.filter((b) => b.tipo === 'tarjeta');
  assert.equal(tarjetas.length, 3);
  for (let i = 0; i < 3; i++) {
    const t = tarjetas[i];
    if (t.tipo !== 'tarjeta') throw new Error('narrow');
    assert.equal(t.slot, i + 1);
    assert.equal(t.titulo, `Cifra ${i + 1}`);
    assert.deepEqual(t.campos.map((c) => c.name), [`cifra${i + 1}Numero`, `cifra${i + 1}Rotulo`]);
    // Ninguna de las tres es "opcional" en el sentido del puente (§ TiendaSeccionEditor.tsx,
    // `colapsado()`/`quitarTarjeta`): no hay botón "Quitar" — las cifras no se agregan/retiran como
    // tarjetas, cada CAMPO ya es opcional por su cuenta.
    assert.equal(t.opcional, false);
  }
});

test('nosotrosFicha: los 7 campos originales siguen TODOS cubiertos por algún bloque (ninguno se perdió al agrupar)', () => {
  const config = SECCIONES_TIENDA.find((c) => c.seccion === 'nosotrosFicha');
  assert.ok(config, 'nosotrosFicha debería existir en SECCIONES_TIENDA');
  const bloques = bloquesResueltos(config!);
  const cubiertos = new Set<string>();
  for (const b of bloques) {
    if (b.tipo === 'seccion' || b.tipo === 'tarjeta') for (const c of b.campos) cubiertos.add(c.name);
  }
  for (const c of config!.campos) {
    assert.ok(cubiertos.has(c.name), `${c.name} debería seguir cubierto por algún bloque`);
  }
  assert.equal(cubiertos.size, config!.campos.length, 'ningún nombre de campo duplicado entre bloques');
});

test('nosotrosEscenas (el repeater) YA colapsa por ítem — sin cambio de este slice, se afirma para que quede medido', () => {
  const config = SECCIONES_TIENDA.find((c) => c.seccion === 'nosotrosEscenas');
  assert.ok(config, 'nosotrosEscenas debería existir en SECCIONES_TIENDA');
  assert.ok(config!.repeater, 'nosotrosEscenas debería declarar repeater — es lo que le da la tarjeta colapsada vía RepeaterEditor');
  const principal = config!.repeater!.campos.find((c) => c.resumen === 'principal');
  assert.ok(principal, 'debería declarar un campo con resumen "principal" (el título de la tarjeta colapsada)');
  assert.equal(principal!.name, 'titulo');
});

// ─── Punto 6 (§ EDITOR-PAGINAS-ONIX-ARREGLOS-1): `null` (cargando) ≠ `false` (oculta) ───────────────
//
// EL DEFECTO MEDIDO: `TogglePagina.tsx` hacía `const on = visible === true`, que colapsa `null`
// (todavía no se sabe) al mismo lado que `false` (oculta) — mientras el fetch estaba en vuelo, el
// control afirmaba "Oculto" para una página que en realidad está encendida. Visto fallar contra la
// fórmula vieja antes de escribir la nueva (abajo, en el mismo test).

test('estadoVisibilidadPagina: null es "cargando", nunca "oculta" — el defecto que corrige esta función', () => {
  assert.equal(estadoVisibilidadPagina(null), 'cargando');
  // La fórmula VIEJA de `TogglePagina.tsx` (`const on = visible === true`) daba `on === false` para
  // `null` — EXACTAMENTE lo mismo que para una página realmente oculta (`visible === false`), así
  // que el control no podía distinguir "cargando" de "oculta" y afirmaba la segunda. La nueva
  // función SÍ distingue los dos: este assert es lo que habría fallado contra la fórmula vieja.
  const onConLaFormulaVieja = (null as boolean | null) === true; // false — igual que una página oculta
  assert.equal(onConLaFormulaVieja, false);
  assert.notEqual(estadoVisibilidadPagina(null), 'oculta');
});

test('estadoVisibilidadPagina: true es "visible", false es "oculta" — sin cambio para los dos casos conocidos', () => {
  assert.equal(estadoVisibilidadPagina(true), 'visible');
  assert.equal(estadoVisibilidadPagina(false), 'oculta');
});
