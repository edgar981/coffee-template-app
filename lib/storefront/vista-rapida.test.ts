import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  galeriaVistaRapida,
  moliendaInicialVistaRapida,
  clampCantidadVistaRapida,
  accionVistaRapida,
} from './vista-rapida';

// ─── galeriaVistaRapida — portada + adicionales, sin repetir (§ galeriaCompleta) ──────────────────

test('galeriaVistaRapida: portada primero, luego las adicionales', () => {
  const g = galeriaVistaRapida({ imagen: '/a.webp', imagenes: ['/b.webp', '/c.webp'] });
  assert.deepEqual(g, ['/a.webp', '/b.webp', '/c.webp']);
});

test('galeriaVistaRapida: la portada duplicada dentro de imagenes[] no se repite', () => {
  const g = galeriaVistaRapida({ imagen: '/a.webp', imagenes: ['/a.webp', '/b.webp'] });
  assert.deepEqual(g, ['/a.webp', '/b.webp']);
});

test('galeriaVistaRapida: sin portada ni adicionales → []', () => {
  assert.deepEqual(galeriaVistaRapida({ imagen: '', imagenes: [] }), []);
  assert.deepEqual(galeriaVistaRapida({}), []);
});

// ─── moliendaInicialVistaRapida — la primera DISPONIBLE, igual que la ficha ───────────────────────

test('moliendaInicialVistaRapida: sin opciones declaradas → null', () => {
  assert.equal(moliendaInicialVistaRapida(undefined), null);
  assert.equal(moliendaInicialVistaRapida([]), null);
});

test('moliendaInicialVistaRapida: una sola disponible → su nombre', () => {
  const opciones = [{ nombre: 'Grano entero', metodo: '', disponible: true }];
  assert.equal(moliendaInicialVistaRapida(opciones), 'Grano entero');
});

test('moliendaInicialVistaRapida: varias disponibles → la PRIMERA de la lista, no la primera disponible por índice arbitrario', () => {
  const opciones = [
    { nombre: 'Fina', metodo: '', disponible: false },
    { nombre: 'Media', metodo: '', disponible: true },
    { nombre: 'Gruesa', metodo: '', disponible: true },
  ];
  assert.equal(moliendaInicialVistaRapida(opciones), 'Media');
});

test('moliendaInicialVistaRapida: todas agotadas → null (nada que preseleccionar)', () => {
  const opciones = [{ nombre: 'Media', metodo: '', disponible: false }];
  assert.equal(moliendaInicialVistaRapida(opciones), null);
});

// ─── clampCantidadVistaRapida — SIEMPRE ≥ 1, acotada al tope ──────────────────────────────────────

test('clampCantidadVistaRapida: nunca baja de 1', () => {
  assert.equal(clampCantidadVistaRapida(0, 10), 1);
  assert.equal(clampCantidadVistaRapida(-5, 10), 1);
});

test('clampCantidadVistaRapida: nunca sube del tope', () => {
  assert.equal(clampCantidadVistaRapida(20, 10), 10);
});

test('clampCantidadVistaRapida: dentro del rango, pasa igual', () => {
  assert.equal(clampCantidadVistaRapida(5, 10), 5);
});

test('clampCantidadVistaRapida: un tope roto (0 o negativo) no deja la cantidad en 0 — el piso de 1 gana', () => {
  assert.equal(clampCantidadVistaRapida(5, 0), 1);
  assert.equal(clampCantidadVistaRapida(1, -3), 1);
});

// ─── accionVistaRapida — la MISMA regla que el servidor (moliendaAceptada) ────────────────────────

test('accionVistaRapida: sin opciones declaradas → siempre puede, con cualquier molienda', () => {
  assert.deepEqual(accionVistaRapida(undefined, null), { puede: true });
});

test('accionVistaRapida: modo "automática" (una disponible) con esa molienda elegida → puede', () => {
  const opciones = [{ nombre: 'Media', metodo: '', disponible: true }];
  assert.deepEqual(accionVistaRapida(opciones, 'Media'), { puede: true });
});

test('accionVistaRapida: modo "elección" (varias) SIN elegir (null) → no puede, con el mensaje de la ficha', () => {
  const opciones = [
    { nombre: 'Media', metodo: '', disponible: true },
    { nombre: 'Gruesa', metodo: '', disponible: true },
  ];
  assert.deepEqual(accionVistaRapida(opciones, null), { puede: false, mensajeError: 'Selecciona una molienda disponible' });
});

test('accionVistaRapida: molienda elegida que NO está disponible → no puede', () => {
  const opciones = [
    { nombre: 'Media', metodo: '', disponible: false },
    { nombre: 'Gruesa', metodo: '', disponible: true },
  ];
  assert.deepEqual(accionVistaRapida(opciones, 'Media'), { puede: false, mensajeError: 'Selecciona una molienda disponible' });
});

test('accionVistaRapida: modo "agotada" (declara opciones, ninguna disponible) → no puede con ninguna elección', () => {
  const opciones = [{ nombre: 'Media', metodo: '', disponible: false }];
  assert.deepEqual(accionVistaRapida(opciones, 'Media'), { puede: false, mensajeError: 'Selecciona una molienda disponible' });
  assert.deepEqual(accionVistaRapida(opciones, null), { puede: false, mensajeError: 'Selecciona una molienda disponible' });
});
