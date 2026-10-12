import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';
import { DEFAULTS, type SiteContentData } from '@/lib/config/site-content-defaults';
import EstadoPedido from './EstadoPedido';

// COMPRA-LINEAS-ONIX-CHAMISAS-1 — render EN MEMORIA de cada composición de «confirmación»
// (`content.compra.confirmacion`), en cada estado, con contenido pasado a mano. Byte-identidad de
// la común (sin elegir nada) antes y después de este slice: el bloque «Número de orden» debe seguir
// siendo EXACTAMENTE el de siempre (`bg-[var(--sf-superficie)] rounded-2xl p-5 mb-4`).

function conCompra(confirmacion: string): SiteContentData {
  // `as` deliberado: el test ejercita a propósito valores FUERA del set cerrado ('algo-que-no-
  // existe') para probar que `composicionConfirmacion` los absorbe — el tipo de `SiteContentData`
  // no admite eso, pero en runtime (una fila de la base, o datos sintéticos de este test) sí puede
  // llegar cualquier string.
  return { ...DEFAULTS, compra: { ...DEFAULTS.compra, confirmacion: confirmacion as SiteContentData['compra']['confirmacion'] } };
}

const RESUMEN = {
  items: [{ nombre: 'Café en grano', cantidad: 1, subtotal: 45000 }],
  subtotal: 45000,
  envio: 8000,
  total: 53000,
};

function render(confirmacion: string, estado: Parameters<typeof EstadoPedido>[0]['estado'] = 'manual') {
  return renderToStaticMarkup(
    React.createElement(SiteContentProvider, {
      value: conCompra(confirmacion),
      children: React.createElement(EstadoPedido, {
        estado,
        metodo: 'nequi',
        numeroOrden: 'CN-123456',
        correo: 'cliente@ejemplo.com',
        nombre: 'Valentina',
        resumen: RESUMEN,
        acciones: [],
      }),
    }),
  );
}

// El `<style>` de las animaciones (§ EstadoPedido.tsx) se renderiza SIEMPRE, con las TRES clases en
// su texto CSS — así que buscar el nombre de la clase a secas da un falso positivo incluso cuando
// NINGÚN elemento la usa. Lo que importa es si la clase está APLICADA (`class="…nombre…"`), no si
// su regla existe en la hoja.
function sinHojaDeEstilo(html: string): string {
  return html.replace(/<style>[\s\S]*?<\/style>/, '');
}

test('confirmacion AUSENTE/"comun": el bloque "Número de orden" es BYTE-IDÉNTICO al de siempre (superficie neutra, sin muescas ni sticker)', () => {
  const html = sinHojaDeEstilo(render('comun'));
  assert.ok(html.includes('bg-[var(--sf-superficie)] rounded-2xl p-5 mb-4'), 'debe seguir siendo el bloque neutro de siempre');
  assert.ok(!html.includes('compra-boleto'), 'sin la clase de animación del Boleto');
  assert.ok(!html.includes('¡Pagado!') && !html.includes('En espera') && !html.includes('Guardado'), 'sin sticker de la Lámina');
  assert.ok(html.includes('CN-123456'));
});

test('un valor basura/desconocido en `compra.confirmacion` TAMBIÉN cae a la común — nunca revienta', () => {
  const html = sinHojaDeEstilo(render('algo-que-no-existe'));
  assert.ok(html.includes('bg-[var(--sf-superficie)] rounded-2xl p-5 mb-4'));
});

test('confirmacion "boleto" (Onix): el bloque va en el acento de la tienda, con las DOS muescas y las filas FECHA/MÉTODO/TOTAL', () => {
  const html = sinHojaDeEstilo(render('boleto'));
  assert.ok(html.includes('bg-[var(--sf-acento)]'), 'el bloque pinta con el acento, no la superficie neutra');
  // Las dos muescas laterales (círculos del color de página "perforando" el borde).
  assert.equal((html.match(/rounded-full bg-\[var\(--sf-fondo\)\]/g) ?? []).length, 2);
  assert.ok(html.includes('Fecha'));
  assert.ok(html.includes('Método'));
  assert.ok(html.includes('Nequi'), 'la fila Método usa el nombre llano del método, no el verbo del botón');
  assert.ok(html.includes('Total'));
  assert.ok(html.includes('font-playfair text-3xl'), 'el número de pedido va en serif grande');
});

test('confirmacion "boleto" en PENDIENTE: lleva el filete que se llena en bucle; en otro estado no', () => {
  const pendiente = sinHojaDeEstilo(render('boleto', 'pendiente'));
  const aprobado = sinHojaDeEstilo(render('boleto', 'aprobado'));
  assert.ok(pendiente.includes('compra-boleto__filete-pendiente'));
  assert.ok(!aprobado.includes('compra-boleto__filete-pendiente'));
});

test('confirmacion "lamina" (Las Chamisas): tarjeta de álbum con borde punteado, franja de tejido y sticker de estado inclinado', () => {
  const html = sinHojaDeEstilo(render('lamina', 'aprobado'));
  assert.ok(html.includes('border-dashed'), 'el borde punteado de la lámina');
  assert.ok(html.includes('repeating-linear-gradient'), 'la franja de tejido arriba');
  assert.ok(html.includes('¡Pagado!'), 'el sticker del estado aprobado');
  assert.ok(html.includes('compra-lamina__sticker'), 'la clase de animación "se pega"');
  assert.ok(html.includes('-rotate-6'), 'el sticker va inclinado');
});

test('confirmacion "lamina": el sticker cambia de palabra con el estado, sin tocar el resto del bloque', () => {
  const pendiente = render('lamina', 'pendiente');
  const rechazado = render('lamina', 'rechazado');
  assert.ok(pendiente.includes('En espera'));
  assert.ok(rechazado.includes('Sin pagar'));
});

test('sin numeroOrden (estado "sin_referencia"), ninguna composición muestra el bloque de orden', () => {
  for (const confirmacion of ['comun', 'boleto', 'lamina']) {
    const html = renderToStaticMarkup(
      React.createElement(SiteContentProvider, {
        value: conCompra(confirmacion),
        children: React.createElement(EstadoPedido, {
          estado: 'sin_referencia', metodo: null, numeroOrden: null, acciones: [],
        }),
      }),
    );
    assert.ok(!html.includes('Número de orden'));
  }
});
