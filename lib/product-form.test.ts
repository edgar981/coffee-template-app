import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  puedeGuardarProducto, faltanObligatorios, obligatoriosFaltantes,
  CAMPOS_OBLIGATORIOS_PRODUCTO, accionEstadoProducto, alternativaAlEliminar,
} from '@duna/core/product-form';
import { EMPTY_PRODUCT_FORM } from '@/constants/product';
import type { ProductForm } from '@/types/product';

// El formulario de producto se puede guardar con SOLO los tres campos marcados
// con `*`. Estos tests existen porque el predicado vivía inline en el JSX del
// botón, sin cobertura: cualquier requisito extra que se colara ahí bloquearía
// el ALTA sin romper la edición —que llega con todo poblado— y pasaría los
// smoke tests, que históricamente se hicieron sobre editar.

/** Lo mínimo con lo que un alta debe poder guardarse. */
const MINIMO: Pick<ProductForm, 'nombre' | 'categoria' | 'precio'> =
  { nombre: 'Café QA', categoria: 'cafe_grano', precio: '35000' };

// ─── El caso que importa: CREAR ──────────────────────────────────────────────

test('CREAR: con los tres obligatorios y NADA más, se puede guardar', () => {
  assert.equal(puedeGuardarProducto(MINIMO, false), true);
});

test('CREAR: la imagen NO es obligatoria — el alta arranca sin portada', () => {
  // El endpoint tampoco la exige (`imagen: body.imagen || ''`). Si algún día
  // alguien la mete en el predicado, este test cae antes que el operador.
  assert.equal(puedeGuardarProducto({ ...MINIMO }, false), true);
  assert.deepEqual([...CAMPOS_OBLIGATORIOS_PRODUCTO], ['nombre', 'categoria', 'precio']);
  assert.ok(!CAMPOS_OBLIGATORIOS_PRODUCTO.includes('imagen' as never));
});

test('CREAR: el formulario vacío NO se puede guardar', () => {
  assert.equal(puedeGuardarProducto(EMPTY_PRODUCT_FORM, false), false);
});

test('CREAR: falta cualquiera de los tres → bloqueado, uno por uno', () => {
  for (const campo of CAMPOS_OBLIGATORIOS_PRODUCTO) {
    const sinEse = { ...MINIMO, [campo]: '' };
    assert.equal(puedeGuardarProducto(sinEse, false), false, `debería bloquear sin ${campo}`);
  }
});

test('un valor de solo espacios no cuenta como lleno', () => {
  assert.equal(puedeGuardarProducto({ ...MINIMO, nombre: '   ' }, false), false);
});

test('precio "0" es un valor, no un vacío', () => {
  // `!'0'` es false en JS, pero conviene fijarlo: un producto gratis o de
  // cortesía no puede quedar bloqueado por una comprobación de falsy.
  assert.equal(puedeGuardarProducto({ ...MINIMO, precio: '0' }, false), true);
});

// ─── EDITAR: mismo predicado, y por eso enmascaraba el problema ──────────────

test('EDITAR: un producto poblado siempre cumple, aunque el predicado pida de más', () => {
  const editado: typeof MINIMO =
    { nombre: 'Café Nayoli — Molido 500 g', categoria: 'cafe_molido', precio: '35000' };
  assert.equal(puedeGuardarProducto(editado, false), true);
});

// ─── Estado de guardado ──────────────────────────────────────────────────────

test('mientras se guarda queda bloqueado, aunque los campos estén completos', () => {
  assert.equal(puedeGuardarProducto(MINIMO, true), false);
});

test('al terminar (con éxito o error) vuelve a habilitarse', () => {
  assert.equal(puedeGuardarProducto(MINIMO, false), true);
});

// ─── faltanObligatorios, por separado ────────────────────────────────────────

test('faltanObligatorios distingue completo de incompleto', () => {
  assert.equal(faltanObligatorios(MINIMO), false);
  assert.equal(faltanObligatorios({ ...MINIMO, categoria: '' }), true);
});

// ─── obligatoriosFaltantes — lo que se le dice al operador ───────────────────
// El aviso bajo el botón existe porque un botón muerto sin explicación no
// distingue "te falta un campo" de "la app está rota".

test('nombra el único campo que falta', () => {
  assert.deepEqual(obligatoriosFaltantes({ ...MINIMO, categoria: '' }), ['categoría']);
});

test('nombra varios en el orden del formulario, no en el de escritura', () => {
  assert.deepEqual(
    obligatoriosFaltantes({ nombre: '', categoria: '', precio: '' }),
    ['nombre', 'categoría', 'precio'],
  );
  assert.deepEqual(obligatoriosFaltantes({ ...MINIMO, nombre: '', precio: '' }), ['nombre', 'precio']);
});

test('con todo lleno no hay nada que avisar', () => {
  assert.deepEqual(obligatoriosFaltantes(MINIMO), []);
});

test('las etiquetas son las que ve el operador, con tilde', () => {
  // "categoria" es la key; "categoría" es lo que se lee en pantalla.
  assert.ok(obligatoriosFaltantes(EMPTY_PRODUCT_FORM).includes('categoría'));
});

test('el aviso y el botón nunca se contradicen', () => {
  // Invariante: hay aviso si y solo si el guardado está bloqueado por campos.
  const casos = [
    MINIMO,
    { ...MINIMO, nombre: '' },
    { ...MINIMO, categoria: '' as typeof MINIMO.categoria },
    { ...MINIMO, precio: '' },
    EMPTY_PRODUCT_FORM,
  ];
  for (const form of casos) {
    assert.equal(
      obligatoriosFaltantes(form).length > 0,
      !puedeGuardarProducto(form, false),
      `desincronizados para ${JSON.stringify(form.nombre)}/${JSON.stringify(form.categoria)}`,
    );
  }
});

// ─── La alternativa de estado del diálogo de borrado ─────────────────────────
// Existía en una sola dirección: "Desactivar" cuando el producto estaba activo y
// NADA cuando estaba inactivo. Como el modal tampoco tiene control de `activo`,
// un producto desactivado quedaba atrapado y la única salida era la base. Lo
// encontró el owner el 2026-08-04 desactivando un producto para probar el PATCH
// parcial y descubriendo que no podía devolverlo.

test('activo → se ofrece Desactivar, y manda activo:false', () => {
  const accion = accionEstadoProducto({ activo: true });
  assert.equal(accion?.label, 'Desactivar');
  assert.equal(accion?.activo, false);
});

test('inactivo → se ofrece Activar, y manda activo:true (EL INVERSO QUE FALTABA)', () => {
  const accion = accionEstadoProducto({ activo: false });
  assert.equal(accion?.label, 'Activar');
  assert.equal(accion?.activo, true);
});

test('EL INVARIANTE: la acción resuelta es siempre el inverso del estado actual', () => {
  // Lo que hay que garantizar no es el texto de cada botón sino que nunca se
  // ofrezca el estado en el que el producto YA está — ofrecerlo es lo que deja a
  // alguien sin salida, y no rompe ninguna pantalla mientras pasa.
  for (const activo of [true, false]) {
    const accion = accionEstadoProducto({ activo });
    assert.equal(accion?.activo, !activo, `no es el inverso para activo:${activo}`);
  }
});

test('ningún estado se queda sin salida: los dos resuelven una acción', () => {
  for (const activo of [true, false]) {
    assert.ok(accionEstadoProducto({ activo }), `sin acción para activo:${activo}`);
  }
});

// ─── Cada dirección por su puerta ────────────────────────────────────────────
// Resolver el par no es lo mismo que ofrecerlo en cualquier lado. Activar vive en
// el badge "Inactivo" de la card; el flujo de ELIMINAR sólo ofrece desactivar.
// El primer intento puso las dos detrás del ícono de basura, y eso viola la regla
// del repo de que un affordance promete su acción: una papelera que además activa
// promete una cosa y esconde la contraria.

test('EL INVARIANTE NUEVO: del flujo de eliminar NUNCA sale una activación', () => {
  for (const producto of [{ activo: true }, { activo: false }, null, undefined]) {
    const accion = alternativaAlEliminar(producto);
    assert.notEqual(accion?.activo, true, `el borrado ofreció activar para ${JSON.stringify(producto)}`);
  }
});

test('producto ACTIVO: el borrado sigue ofreciendo Desactivar (el flujo no se tocó)', () => {
  const accion = alternativaAlEliminar({ activo: true });
  assert.equal(accion?.label, 'Desactivar');
  assert.equal(accion?.activo, false);
});

test('producto INACTIVO: el borrado no ofrece alternativa — esa manija es del badge', () => {
  assert.equal(alternativaAlEliminar({ activo: false }), undefined);
  // Y la acción SÍ existe: lo que cambió es la puerta, no la disponibilidad.
  assert.equal(accionEstadoProducto({ activo: false })?.label, 'Activar');
});

test('las dos superficies coinciden en el verbo cuando ambas ofrecen algo', () => {
  // Se derivan de la misma función justamente para que no puedan divergir: si
  // alguien reescribe una de las dos a mano, esto se cae.
  const desdeElBorrado = alternativaAlEliminar({ activo: true });
  const desdeElEstado  = accionEstadoProducto({ activo: true });
  assert.deepEqual(desdeElBorrado, desdeElEstado);
});

test('sin producto no hay acción — el diálogo cerrado no ofrece nada', () => {
  assert.equal(accionEstadoProducto(null), undefined);
  assert.equal(accionEstadoProducto(undefined), undefined);
});

test('cada dirección trae su propio toast, y no se repiten', () => {
  const a = accionEstadoProducto({ activo: true })!;
  const b = accionEstadoProducto({ activo: false })!;
  assert.notEqual(a.successMessage, b.successMessage);
  assert.match(a.successMessage, /desactivado/i);
  assert.match(b.successMessage, /activado/i);
});
