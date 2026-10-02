import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fotoHover } from './foto-hover';

// ─── fotoHover — frente/atrás derivados de galeriaCompleta, sin duplicar el cálculo ────────────────

test('fotoHover: portada + una adicional → frente=portada, atras=la adicional', () => {
  const r = fotoHover({ imagen: '/a.webp', imagenes: ['/b.webp'] });
  assert.deepEqual(r, { frente: '/a.webp', atras: '/b.webp' });
});

test('fotoHover: portada + varias adicionales → atras es la PRIMERA, no la última', () => {
  const r = fotoHover({ imagen: '/a.webp', imagenes: ['/b.webp', '/c.webp', '/d.webp'] });
  assert.deepEqual(r, { frente: '/a.webp', atras: '/b.webp' });
});

test('fotoHover: sin adicionales → atras es null (nunca undefined)', () => {
  const r = fotoHover({ imagen: '/a.webp', imagenes: [] });
  assert.deepEqual(r, { frente: '/a.webp', atras: null });
  assert.equal(r.atras, null);
});

test('fotoHover: sin imagenes declarado (undefined) → atras null, igual que []', () => {
  const r = fotoHover({ imagen: '/a.webp' });
  assert.deepEqual(r, { frente: '/a.webp', atras: null });
});

test('fotoHover: la portada duplicada dentro de imagenes[] no cuenta como segunda foto (dedupe de galeriaCompleta)', () => {
  // El caso real del seed de Nayoli (§ CLAUDE.md, "Galería de producto"): imagenes trae la MISMA
  // URL que imagen. galeriaCompleta la dedupea a longitud 1, así que no hay "foto de atrás".
  const r = fotoHover({ imagen: '/a.webp', imagenes: ['/a.webp'] });
  assert.deepEqual(r, { frente: '/a.webp', atras: null });
});

test('fotoHover: portada duplicada seguida de una adicional REAL → atras es la real, no la duplicada', () => {
  const r = fotoHover({ imagen: '/a.webp', imagenes: ['/a.webp', '/b.webp'] });
  assert.deepEqual(r, { frente: '/a.webp', atras: '/b.webp' });
});

test('fotoHover: sin portada, con adicionales → frente toma la primera adicional (shift), atras la segunda', () => {
  const r = fotoHover({ imagen: '', imagenes: ['/b.webp', '/c.webp'] });
  assert.deepEqual(r, { frente: '/b.webp', atras: '/c.webp' });
});

test('fotoHover: sin ninguna foto → frente undefined, atras null', () => {
  const r = fotoHover({});
  assert.deepEqual(r, { frente: undefined, atras: null });
});

test('fotoHover: imagen null, imagenes null → igual que el caso vacío', () => {
  const r = fotoHover({ imagen: null, imagenes: null });
  assert.deepEqual(r, { frente: undefined, atras: null });
});
