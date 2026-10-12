import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { siguienteAbierta } from './letra-pequena';
import { DEFAULTS, type SiteContentData } from '../config/site-content-defaults';
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';
import PreguntasFrecuentes from '@/components/storefront/PreguntasFrecuentes';

// § ONIX-SUSCRIPCION-LETRA-CIERRE-1. Dos mitades: la regla PURA "una abierta a la vez" y la
// BYTE-IDENTIDAD de la composición canónica 'tarjetas' (que esta tanda NO toca) frente al render de
// la composición nueva 'letraPequena' — mismo método que `lib/storefront/suscripcion-taquilla.test.ts`:
// SSR a texto vía `renderToStaticMarkup`, sin jsdom (el repo no lo tiene).

// ─── siguienteAbierta — "una abierta a la vez" ─────────────────────────────────────────────────

test('siguienteAbierta: nada abierto, clic en N → abre N', () => {
  assert.equal(siguienteAbierta(null, 2), 2);
});

test('siguienteAbierta: clic en la YA abierta → la cierra (null)', () => {
  assert.equal(siguienteAbierta(1, 1), null);
});

test('siguienteAbierta: clic en OTRA distinta de la abierta → cambia a la clickeada, nunca las dos', () => {
  assert.equal(siguienteAbierta(0, 3), 3);
});

// ─── BYTE-IDENTIDAD: la composición 'tarjetas' (canónica) no cambió ────────────────────────────
//
// Reconstruye la JSX EXACTA que `PreguntasFrecuentes.tsx` montaba antes de este slice (la rama
// 'tarjetas', intacta) y la compara contra el componente real de HOY, con `variante: 'tarjetas'`
// explícito y con los DEFAULTS (que también resuelven a 'tarjetas', § DEFAULTS.suscripcionFaq).

function arbolDeAyer(titulo: string, items: { question: string; answer: string }[]) {
  return React.createElement(
    'section',
    { className: 'py-16 bg-[var(--sf-fondo)]' },
    React.createElement(
      'div',
      { className: 'max-w-2xl mx-auto px-4' },
      React.createElement('h2', { className: 'text-2xl font-playfair text-[var(--sf-tinta)] text-center mb-8' }, titulo),
      React.createElement(
        'div',
        { className: 'space-y-4' },
        items.map((faq, i) =>
          React.createElement(
            'div',
            { key: i, className: 'bg-[var(--sf-tarjeta)] rounded-2xl sf-borde border-[var(--sf-linea)] p-5' },
            React.createElement('p', { className: 'font-semibold text-[var(--sf-tinta)] text-sm mb-2' }, faq.question),
            React.createElement('p', { className: 'text-sm text-[var(--sf-texto)]' }, faq.answer),
          ),
        ),
      ),
    ),
  );
}

test("byte-identidad: con los DEFAULTS (items vacíos) PreguntasFrecuentes no renderiza nada — hide-on-empty, sin tocar", () => {
  const html = renderToStaticMarkup(
    React.createElement(SiteContentProvider, { value: DEFAULTS, children: React.createElement(PreguntasFrecuentes) }),
  );
  assert.equal(html, '');
});

test("byte-identidad: variante 'tarjetas' con items es IDÉNTICA al árbol de ayer (la rama que este slice no toca)", () => {
  const items = [
    { question: '¿Cómo pago?', answer: 'Te escribimos antes de cada envío.' },
    { question: '¿Puedo pausar?', answer: 'Sí, cuando quieras, con un mensaje.' },
  ];
  const content: SiteContentData = {
    ...DEFAULTS,
    suscripcionFaq: { ...DEFAULTS.suscripcionFaq, titulo: 'Preguntas frecuentes', items, variante: 'tarjetas' },
  };
  const viejo = renderToStaticMarkup(arbolDeAyer('Preguntas frecuentes', items));
  const nuevo = renderToStaticMarkup(
    React.createElement(SiteContentProvider, { value: content, children: React.createElement(PreguntasFrecuentes) }),
  );
  assert.equal(nuevo, viejo);
  assert.ok(viejo.length > 0, 'debe renderizar algo con items');
});

// ─── La composición 'letraPequena' — sólo una abierta a la vez, EN EL RENDER ───────────────────

function contenidoConVariante(variante: string, items: { question: string; answer: string }[]) {
  const content: SiteContentData = {
    ...DEFAULTS,
    suscripcionFaq: { ...DEFAULTS.suscripcionFaq, titulo: 'Antes de suscribirte', items, variante },
  };
  return React.createElement(SiteContentProvider, { value: content, children: React.createElement(PreguntasFrecuentes) });
}

test("letraPequena: la PRIMERA pregunta arranca abierta (aria-expanded=\"true\"), el resto cerradas", () => {
  const items = [
    { question: '¿Cómo pago?', answer: 'Te escribimos con el total antes de cada envío.' },
    { question: '¿A dónde envían?', answer: 'A todo el país.' },
    { question: '¿Puedo pausar?', answer: 'Sí, cuando quieras.' },
  ];
  const html = renderToStaticMarkup(contenidoConVariante('letraPequena', items));
  assert.ok(html.includes('aria-expanded="true"'), 'debe haber exactamente una pregunta abierta');
  // SÓLO UNA: un único match de aria-expanded="true" en todo el árbol.
  const abiertas = html.match(/aria-expanded="true"/g) ?? [];
  assert.equal(abiertas.length, 1, 'nunca dos preguntas abiertas a la vez');
  // La respuesta de la primera pregunta se renderiza; las de las otras dos, no (su `<div>` de panel
  // ni se monta, § PreguntasFrecuentes.tsx — "{abierto && (…)}").
  assert.ok(html.includes('Te escribimos con el total antes de cada envío.'));
  assert.ok(!html.includes('A todo el país.'));
  assert.ok(!html.includes('Sí, cuando quieras.'));
});

test("letraPequena: lleva el filete de tinta ARRIBA de la primera fila (§ ONIX-PAGINAS-FIDELIDAD-1, R1+R3 — ya NO es `border-[var(--sf-linea)]/15 first:border-t-0`, invisible para Onix y sólo ENTRE filas) y la columna de 720px", () => {
  const items = [{ question: '¿Cómo pago?', answer: 'Por chat.' }];
  const html = renderToStaticMarkup(contenidoConVariante('letraPequena', items));
  assert.ok(html.includes('border-t border-[var(--sf-tinta)]/15'), 'la primera fila lleva su PROPIO filete de arriba, de tinta');
  assert.ok(!html.includes('var(--sf-linea)'), 'R1: --sf-linea deriva casi invisible para Onix — ya no se usa acá');
  assert.ok(html.includes('max-w-[720px]'));
});

test("letraPequena: lleva el rótulo fijo «Letra pequeña» (§ ONIX-PAGINAS-FIDELIDAD-1, el spec item 5/punto 7)", () => {
  const items = [{ question: '¿Cómo pago?', answer: 'Por chat.' }];
  const html = renderToStaticMarkup(contenidoConVariante('letraPequena', items));
  assert.ok(html.includes('Letra pequeña'));
});

test("letraPequena: sin items (hide-on-empty) no renderiza nada, igual que 'tarjetas'", () => {
  const html = renderToStaticMarkup(contenidoConVariante('letraPequena', []));
  assert.equal(html, '');
});
