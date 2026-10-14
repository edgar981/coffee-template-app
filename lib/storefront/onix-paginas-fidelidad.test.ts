import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEFAULTS, type SiteContentData } from '../config/site-content-defaults';
import { SiteContentProvider } from '@/components/storefront/SiteContentProvider';
import Apertura from '@/components/storefront/tienda/Apertura';
import TiendaEncabezado from '@/components/storefront/tienda/TiendaEncabezado';
import TiendaCierre from '@/components/storefront/tienda/TiendaCierre';
import TiendaInterludio from '@/components/storefront/tienda/TiendaInterludio';
import CierreFraseYBoton from '@/components/storefront/tienda/CierreFraseYBoton';
import NosotrosHistoria from '@/components/storefront/nosotros/NosotrosHistoria';
import NosotrosCierre from '@/components/storefront/nosotros/NosotrosCierre';
import SuscripcionApertura from '@/components/storefront/suscripciones/SuscripcionApertura';
import SuscripcionCierre from '@/components/storefront/suscripciones/SuscripcionCierre';
import NosotrosApertura from '@/components/storefront/nosotros/NosotrosApertura';
import PreguntasFrecuentes from '@/components/storefront/PreguntasFrecuentes';
import SuscripcionTaquilla from '@/components/storefront/suscripciones/SuscripcionTaquilla';
import { CreditosFilas } from '@/components/storefront/tienda/TiendaCreditos';
import { CajonPanel, type CajonPanelProps } from '@/components/storefront/CartDrawer';
import type { Product } from '@/types/product';
import type { SuscripcionPlanesContent, VendedorContent } from '../config/site-content-defaults';

// § ONIX-PAGINAS-FIDELIDAD-1 — render EN MEMORIA (`renderToStaticMarkup`, sin red, sin DOM) con
// contenido de Onix pasado A MANO (nunca `.env`/una base). Dos preguntas:
// (1) ¿lo que arreglamos para fidelidad a la maqueta SIGUE arreglado? (título quieto, filetes de
//     tinta, Taquilla con presentación);
// (2) ¿lo que NO debía tocarse (las OTRAS composiciones que comparten los mismos archivos
//     compartidos — Apertura/InterludioPlano/CierreFraseYBoton/TiendaCreditos) sigue byte-idéntico?

function conSeccion<K extends keyof SiteContentData>(key: K, over: Partial<SiteContentData[K]>): SiteContentData {
  return { ...DEFAULTS, [key]: { ...DEFAULTS[key], ...over } };
}

// ─── (1) El título QUIETO — sin el marcador de movimiento ──────────────────────────────────────
//
// `Movimiento` (§ components/storefront/movimiento/Movimiento.tsx) monta un `<div>` wrapper propio
// SÓLO cuando `id` está presente; con `id` ausente devuelve `children` DIRECTO, sin nodo de más
// (su propio docstring: "sin un id, este componente no renderiza ningún nodo propio"). Por eso "el
// título no lleva el marcador de movimiento" es, en el HTML, exactamente UN `<div>` menos: el
// wrapper que `Apertura.tsx` ya NO pide (`Movimiento id={quieto ? undefined : 'T06'}`).

test('Apertura: quieto=true quita el wrapper de Movimiento T06 — un <div> menos, mismo título', () => {
  const props = { seccion: 'tiendaEncabezado', titulo: 'CADA MES', rotuloIzquierda: 'IZQ', rotuloDerecha: 'DER' };
  const conMovimiento = renderToStaticMarkup(React.createElement(Apertura, props));
  const quieto = renderToStaticMarkup(React.createElement(Apertura, { ...props, quieto: true }));

  const divsConMovimiento = (conMovimiento.match(/<div/g) ?? []).length;
  const divsQuieto = (quieto.match(/<div/g) ?? []).length;
  assert.equal(
    divsConMovimiento - divsQuieto, 1,
    'quieto debe tener EXACTAMENTE un <div> menos — el wrapper de Movimiento T06 desaparece',
  );
  assert.ok(conMovimiento.includes('CADA MES') && quieto.includes('CADA MES'), 'el título sigue presente en los dos modos');
  // El marcador de la posición ESTÁTICA (§ el spec item 1: "al ras de la izquierda, sangrando"):
  // letter-spacing -.01em y el ancho mobile 22vw sólo existen en el modo quieto.
  assert.ok(quieto.includes('tracking-[-0.01em]'), 'quieto lleva el letter-spacing de la maqueta');
  assert.ok(!conMovimiento.includes('tracking-[-0.01em]'), 'el modo con movimiento NO lleva ese ajuste — no es parte de su diseño');
});

test('SuscripcionApertura y NosotrosApertura: SIEMPRE quietos (sin "T06"/tracking de movimiento)', () => {
  const contenidoSus = conSeccion('suscripcionApertura', { visible: true, titulo: 'CADA MES' });
  const htmlSus = renderToStaticMarkup(
    React.createElement(SiteContentProvider, { value: contenidoSus, children: React.createElement(SuscripcionApertura) }),
  );
  const contenidoNos = conSeccion('nosotrosApertura', { visible: true, titulo: 'LA FINCA' });
  const htmlNos = renderToStaticMarkup(
    React.createElement(SiteContentProvider, { value: contenidoNos, children: React.createElement(NosotrosApertura) }),
  );
  assert.ok(htmlSus.includes('CADA MES') && htmlSus.includes('tracking-[-0.01em]'));
  assert.ok(htmlNos.includes('LA FINCA') && htmlNos.includes('tracking-[-0.01em]'));
  // Y LA MISMA ALTURA que /suscripciones (§ el spec item 1: "La /nosotros usa el mismo alto que
  // /suscripciones") — el literal `h-[70svh] min-h-[420px]` en los dos, no el default de /tienda
  // (85vh) que usaba antes.
  assert.ok(htmlSus.includes('h-[70svh]') && htmlSus.includes('min-h-[420px]'));
  assert.ok(htmlNos.includes('h-[70svh]') && htmlNos.includes('min-h-[420px]'));
});

test('TiendaEncabezado: la apertura de /tienda (variante "apertura") CONSERVA su movimiento tal cual', () => {
  const contenido = conSeccion('tiendaEncabezado', { variante: 'apertura', titulo: 'CAFÉ ONIX' });
  const html = renderToStaticMarkup(
    React.createElement(SiteContentProvider, { value: contenido, children: React.createElement<{ negocio?: string }>(TiendaEncabezado, { negocio: 'Onix' }) }),
  );
  assert.ok(html.includes('CAFÉ ONIX'));
  // Si /tienda hubiera quedado quieta por accidente, llevaría el tracking de la maqueta — y no es
  // el caso: "nadie lo pidió cambiar".
  assert.ok(!html.includes('tracking-[-0.01em]'), '/tienda NO debe llevar el ajuste de la maqueta quieta — conserva T06');
});

// ─── (2) Los filetes usan la TINTA (R1), nunca `--sf-linea` ────────────────────────────────────

function onixCatalog(): Product[] {
  const base = {
    costo: 0, sku: null, stock: 10, activo: true, disponible: true, moliendasOpciones: [] as never[], descripcion: '',
  };
  return [
    { ...base, id: 'p-grano-250', nombre: 'Café Onix — En grano 250 g', slug: 'onix-grano-250', categoria: 'Café en Grano', precio: 20000, peso_gramos: 250 },
    { ...base, id: 'p-grano-500', nombre: 'Café Onix — En grano 500 g', slug: 'onix-grano-500', categoria: 'Café en Grano', precio: 35000, peso_gramos: 500 },
    { ...base, id: 'p-molido-250', nombre: 'Café Onix — Molido 250 g', slug: 'onix-molido-250', categoria: 'Café Molido', precio: 20000, peso_gramos: 250 },
    { ...base, id: 'p-molido-500', nombre: 'Café Onix — Molido 500 g', slug: 'onix-molido-500', categoria: 'Café Molido', precio: 35000, peso_gramos: 500 },
  ] as Product[];
}

const PLANES_ONIX: SuscripcionPlanesContent = {
  ...DEFAULTS.suscripcionPlanes,
  frecuencia1: '15 días', frecuencia2: 'Mes', frecuencia3: '', frecuencia4: '',
};

test('SuscripcionTaquilla: los filetes son tinta al 15% — cero `--sf-linea` en todo el árbol', () => {
  const html = renderToStaticMarkup(
    React.createElement(SuscripcionTaquilla, { catalog: onixCatalog(), whatsapp: '573000000000', suscripcionPlanes: PLANES_ONIX }),
  );
  assert.ok(html.includes('var(--sf-tinta)'));
  assert.ok(!html.includes('var(--sf-linea)'), 'SuscripcionTaquilla no debe usar --sf-linea — invisible para Onix (R1 del informe)');
});

// ─── (5) § ONIX-TAQUILLA-SOLO-TABLA-1 — el comprador ve sólo rótulo + título + tabla + botón ──────
//
// El owner, mirando /suscripciones de Onix en el celular: "It's showing a lot of things that the
// customer doesn't have to know about. The customer would only need to concern about the table and
// the button." Los cinco interruptores nacen APAGADOS (§ DEFAULTS.suscripcionPlanes) — `PLANES_ONIX`
// (arriba) los hereda tal cual, así que es el caso por defecto, no un fixture aparte.

test('SuscripcionTaquilla, interruptores APAGADOS (el default): sin resumen, sin referencia, sin "Se envía", sin aviso, sin créditos — tabla y botón SÍ', () => {
  const html = renderToStaticMarkup(
    React.createElement(SuscripcionTaquilla, { catalog: onixCatalog(), whatsapp: '573000000000', suscripcionPlanes: PLANES_ONIX }),
  );
  // La tabla (los pesos del encabezado) y el botón de pedido siguen ahí.
  assert.ok(html.includes('250 g') && html.includes('500 g'), 'la tabla sigue mostrándose');
  assert.ok(html.includes('Pedir por WhatsApp'), 'el botón de pedido sigue mostrándose');
  // Lo demás, apagado de arranque, no debe aparecer.
  assert.ok(!html.includes('CAFÉ MOLIDO'), 'el resumen grande (la presentación en mayúscula) no debe mostrarse');
  assert.ok(!html.includes('Referencia:'), 'la referencia de precio no debe mostrarse');
  assert.ok(!html.includes('Se envía:'), 'la línea "Se envía" no debe mostrarse');
  assert.ok(!html.includes('No se cobra nada aquí'), 'el aviso no debe mostrarse');
  // credito1 por defecto es {etiqueta:'Pedido', valor:'Por WhatsApp'} — "Por WhatsApp" (con
  // mayúscula) no colisiona con el botón "Pedir por WhatsApp" (minúscula), case-sensitive.
  assert.ok(!html.includes('Pedido') && !html.includes('Por WhatsApp'), 'los créditos del trato no deben mostrarse');
});

test('SuscripcionTaquilla, los cinco interruptores ENCENDIDOS: resumen, referencia, "Se envía", aviso y créditos SÍ se muestran', () => {
  const planes: SuscripcionPlanesContent = {
    ...PLANES_ONIX,
    taquillaMostrarResumen: true, taquillaMostrarReferencia: true, taquillaMostrarSeEnvia: true,
    taquillaMostrarAviso: true, taquillaMostrarCreditos: true,
  };
  const html = renderToStaticMarkup(
    React.createElement(SuscripcionTaquilla, { catalog: onixCatalog(), whatsapp: '573000000000', suscripcionPlanes: planes }),
  );
  assert.ok(html.includes('CAFÉ MOLIDO'), 'el resumen grande debe mostrarse encendido');
  assert.ok(html.includes('Referencia:'), 'la referencia de precio debe mostrarse encendida');
  assert.ok(html.includes('Se envía:'), 'la línea "Se envía" debe mostrarse encendida');
  assert.ok(html.includes('No se cobra nada aquí'), 'el aviso debe mostrarse encendido');
  assert.ok(html.includes('Pedido') && html.includes('Por WhatsApp'), 'los créditos del trato deben mostrarse encendidos');
});

test('SuscripcionTaquilla: el mensaje de WhatsApp (href del botón) es IGUAL con los interruptores apagados o encendidos — el toggle es de vista, no del mensaje', () => {
  const htmlApagado = renderToStaticMarkup(
    React.createElement(SuscripcionTaquilla, { catalog: onixCatalog(), whatsapp: '573000000000', suscripcionPlanes: PLANES_ONIX }),
  );
  const planesEncendidos: SuscripcionPlanesContent = { ...PLANES_ONIX, taquillaMostrarSeEnvia: true };
  const htmlEncendido = renderToStaticMarkup(
    React.createElement(SuscripcionTaquilla, { catalog: onixCatalog(), whatsapp: '573000000000', suscripcionPlanes: planesEncendidos }),
  );
  const hrefDe = (html: string) => html.match(/href="([^"]*wa\.me[^"]*)"/)?.[1];
  const hrefApagado = hrefDe(htmlApagado);
  const hrefEncendido = hrefDe(htmlEncendido);
  assert.ok(hrefApagado, 'el botón de WhatsApp debe tener un href wa.me con el mensaje apagado');
  assert.ok(hrefApagado!.includes('molido'), 'el mensaje sigue llevando la molienda/presentación aunque "Se envía" esté apagado');
  assert.equal(hrefApagado, hrefEncendido, 'el mismo mensaje se arma con el toggle apagado o encendido — sólo cambia si se MUESTRA la línea "Se envía"');
});

test('PreguntasFrecuentes (variante letraPequena): rótulo + filetes de tinta, N+1 filetes para N preguntas', () => {
  const contenido = conSeccion('suscripcionFaq', {
    visible: true,
    variante: 'letraPequena',
    titulo: 'Antes de suscribirte',
    items: [
      { question: '¿Puedo pausar?', answer: 'Sí, cuando quieras.' },
      { question: '¿Hay compromiso?', answer: 'No, cancelas cuando quieras.' },
    ],
  });
  const html = renderToStaticMarkup(
    React.createElement(SiteContentProvider, { value: contenido, children: React.createElement(PreguntasFrecuentes) }),
  );
  assert.ok(html.includes('Letra pequeña'), 'lleva el rótulo fijo de la maqueta aprobada');
  assert.ok(!html.includes('var(--sf-linea)'), 'sin --sf-linea — R1');
  // R3: filete arriba de la primera Y abajo de cada una → para 2 preguntas, 3 ocurrencias del
  // filete de tinta (una por `border-t` inicial + dos `border-b`).
  const ocurrencias = (html.match(/var\(--sf-tinta\)\]\/15/g) ?? []).length;
  assert.equal(ocurrencias, 3, '2 filas ⇒ 3 filetes (arriba de la 1ª + abajo de cada una), no 1 (sólo entre filas)');
});

test('NosotrosHistoriaSinopsis: el filete vertical es tinta, no --sf-linea', () => {
  const contenido = conSeccion('nosotrosHistoria', { eyebrow: 'Sinopsis', parrafo1: 'La finca.', imagen: '', retratoNombre: '' });
  const html = renderToStaticMarkup(
    React.createElement(SiteContentProvider, { value: { ...contenido, nosotrosHistoria: { ...contenido.nosotrosHistoria, variante: 'sinopsis' } }, children: React.createElement(NosotrosHistoria) }),
  );
  assert.ok(html.includes('var(--sf-tinta)]/15'));
  assert.ok(!html.includes('var(--sf-linea)'));
});

test('CreditosFilas: R3 — filete arriba de la primera fila Y abajo de cada fila (N+1, no N-1)', () => {
  const filas = [
    { etiqueta: 'Pedido', valor: 'Por WhatsApp' },
    { etiqueta: 'Pago', valor: 'Se acuerda por chat' },
    { etiqueta: 'Envío', valor: 'A todo el país' },
  ];
  const html = renderToStaticMarkup(React.createElement(CreditosFilas, { filas }));
  const topes = (html.match(/border-t/g) ?? []).length;
  const bottoms = (html.match(/border-b/g) ?? []).length;
  assert.equal(topes, 1, 'un solo border-t — arriba de la PRIMERA fila');
  assert.equal(bottoms, 3, 'un border-b por CADA fila (3)');
});

// ─── (3) BYTE-IDENTIDAD de las composiciones de OTRAS tiendas que comparten archivo ────────────
//
// Las piezas compartidas (Apertura/InterludioPlano/CierreFraseYBoton/TiendaCreditos) alimentan
// VARIAS composiciones por dispatcher (§ REGISTRY.*.variantes). Esta tanda sólo tocó el contenido
// Y el estilo que esas piezas pintan — las composiciones CANÓNICAS de los mismos dispatchers, que
// NO montan esas piezas, tienen que seguir exactamente igual. Se verifica RENDERIZANDO cada
// canónica (Relato/Línea/Costura/Retrato/Tarjetas: contenido puro, sin red, seguro de renderizar
// en memoria) y confirmando que el HTML no lleva NINGUNA de las marcas nuevas de esta tanda
// (`tracking-[-0.01em]`, `rounded-[2px]`, `[text-shadow`, `22vw`, `var(--sf-tinta)]/65` del rol de
// texto secundario, `var(--sf-tinta)]/15` del filete). Dos composiciones (Actual/Láminas, de
// `TiendaCatalogo.tsx`) NO se renderizan acá — exigen el catálogo real vía red, fuera de lo que
// esta verificación en memoria puede ejercitar sin tocar una base — y se verifican por LECTURA DE
// FUENTE: ninguno de los DOS archivos que las implementan importa las piezas tocadas.

const MARCAS_DE_LA_TANDA = ['tracking-[-0.01em]', 'rounded-[2px]', '[text-shadow', '22vw', 'var(--sf-tinta)]/65', 'var(--sf-tinta)]/15'];

function sinMarcasDeLaTanda(html: string, nombre: string) {
  for (const marca of MARCAS_DE_LA_TANDA) {
    assert.ok(!html.includes(marca), `"${nombre}" no debería llevar la marca "${marca}" de ONIX-PAGINAS-FIDELIDAD-1 — no monta las piezas tocadas`);
  }
}

test('Relato (nosotrosHistoria canónica) — byte-identidad: no toca ninguna pieza de esta tanda', () => {
  const html = renderToStaticMarkup(
    React.createElement(SiteContentProvider, { value: DEFAULTS, children: React.createElement(NosotrosHistoria) }),
  );
  assert.equal(DEFAULTS.nosotrosHistoria.variante, 'relato', 'la canónica de DEFAULTS debe ser "relato" para que este render la ejercite');
  sinMarcasDeLaTanda(html, 'Relato');
});

test('Línea (nosotrosCierre canónica) — byte-identidad: no monta CierreFraseYBoton', () => {
  const html = renderToStaticMarkup(
    React.createElement(SiteContentProvider, { value: DEFAULTS, children: React.createElement(NosotrosCierre) }),
  );
  assert.equal(DEFAULTS.nosotrosCierre.variante, 'linea', 'la canónica de DEFAULTS debe ser "linea" para que este render la ejercite');
  sinMarcasDeLaTanda(html, 'Línea');
});

test('Costura (tiendaCierre canónica) — byte-identidad: no monta CierreFraseYBoton', () => {
  const html = renderToStaticMarkup(
    React.createElement(SiteContentProvider, { value: DEFAULTS, children: React.createElement(TiendaCierre) }),
  );
  assert.equal(DEFAULTS.tiendaCierre.variante, 'costura', 'la canónica de DEFAULTS debe ser "costura" para que este render la ejercite');
  sinMarcasDeLaTanda(html, 'Costura');
});

test('Retrato (tiendaInterludio canónica) — byte-identidad: no monta InterludioPlano', () => {
  const html = renderToStaticMarkup(
    React.createElement(SiteContentProvider, { value: DEFAULTS, children: React.createElement(TiendaInterludio) }),
  );
  assert.equal(DEFAULTS.tiendaInterludio.variante, 'retrato', 'la canónica de DEFAULTS debe ser "retrato" para que este render la ejercite');
  sinMarcasDeLaTanda(html, 'Retrato');
});

test('Tarjetas (suscripcionFaq canónica) — byte-identidad: no es la composición "letraPequena" tocada', () => {
  const html = renderToStaticMarkup(
    React.createElement(SiteContentProvider, { value: DEFAULTS, children: React.createElement(PreguntasFrecuentes) }),
  );
  assert.equal(DEFAULTS.suscripcionFaq.variante, 'tarjetas', 'la canónica de DEFAULTS debe ser "tarjetas" para que este render la ejercite');
  assert.ok(!html.includes('Letra pequeña'), 'el rótulo fijo es exclusivo de la composición "letraPequena"');
  sinMarcasDeLaTanda(html, 'Tarjetas (FAQ)');
});

test('Actual / Láminas (TiendaCatalogo.tsx, TiendaLaminas.tsx) — por LECTURA DE FUENTE: ninguna importa las piezas tocadas', () => {
  // Fuera del render en memoria a propósito (§ el comentario de arriba): las dos exigen el
  // catálogo real por red. Se verifica por texto-fuente que el archivo no las usa — así que, aunque
  // su variante canónica ('actual') NO sea 'laminas'/'taquilla', ninguna de las dos puede haber
  // empezado a invocar una pieza tocada sin que este grep lo note.
  for (const archivo of ['components/storefront/tienda/TiendaCatalogo.tsx', 'components/storefront/tienda/TiendaLaminas.tsx']) {
    const fuente = readFileSync(join(process.cwd(), archivo), 'utf8');
    for (const pieza of ['tienda/Apertura', 'tienda/InterludioPlano', 'tienda/CierreFraseYBoton']) {
      assert.ok(!fuente.includes(pieza), `${archivo} no debe importar ${pieza}`);
    }
  }
});

// ─── (4) § ONIX-CIERRE-Y-CURSOR-1 — la banda `--sf-papel` del cierre, y la regla global del cursor ─
//
// El owner, revisando lo construido (2026-10-12): el «+» de las preguntas de /suscripciones no
// mostraba la mano, y «¿Solo una bolsa?» (el cierre de /suscripciones) perdió el color de la
// maqueta aprobada. Dos defectos, dos pruebas distintas — ninguna puede verificar la otra.

test('CierreFraseYBoton: `bandaPapel` pinta `bg-[var(--sf-papel)]`; sin la prop (el caso de /tienda), no', () => {
  const base = { frase: 'FRASE', cta: null, preview: false, anchoClase: 'max-w-6xl', campoFrase: 'x.frase' };
  const conPapel = renderToStaticMarkup(React.createElement(CierreFraseYBoton, { ...base, bandaPapel: true }));
  const sinPapel = renderToStaticMarkup(React.createElement(CierreFraseYBoton, base));
  assert.ok(conPapel.includes('bg-[var(--sf-papel)]'), 'con bandaPapel debe llevar la banda de la maqueta de /suscripciones y /nosotros');
  assert.ok(!sinPapel.includes('bg-[var(--sf-papel)]'), 'sin bandaPapel — el caso de TiendaCierre, que no la pasa — no debe llevarla: su propia maqueta pide "banda crema" (el fondo de la página)');
  // La MEDIDA (clamp(48px,5cqi,64px) de la maqueta, vía el swap por breakpoint) no depende de la
  // banda: aplica a los TRES consumidores por igual.
  assert.ok(conPapel.includes('py-12 sm:py-16') && sinPapel.includes('py-12 sm:py-16'), 'el padding-block de la banda es independiente de bandaPapel');
});

test('BotonCierre: 46px de alto CENTRADO POR FLEX, 24px horizontal — nunca por `py-3`', () => {
  const html = renderToStaticMarkup(
    React.createElement(CierreFraseYBoton, {
      frase: 'FRASE', cta: { label: 'Ir a la tienda', href: '/suscripciones' }, preview: false, anchoClase: 'max-w-6xl', campoFrase: 'x.frase',
    }),
  );
  assert.ok(html.includes('min-h-[46px]'), 'el alto de 46px de `.btn-borde` en la maqueta');
  assert.ok(html.includes('inline-flex') && html.includes('items-center') && html.includes('justify-center'), 'centrado por flex, como la maqueta (`display:inline-flex;align-items:center`)');
  assert.ok(html.includes('px-6'), '24px horizontal — ya era correcto, se conserva');
  assert.ok(!html.includes('py-3'), 'el alto NO lo da un padding vertical (que no garantiza 46px a ningún tamaño de letra)');
});

test('SuscripcionCierre (Onix, "¿Solo una bolsa?"): pasa `bandaPapel` — su maqueta aprobada la pide', () => {
  const contenido = conSeccion('suscripcionCierre', { frase: '¿Solo una bolsa?', ctaLabel: '', ctaDestino: '' });
  const html = renderToStaticMarkup(
    React.createElement(SiteContentProvider, { value: contenido, children: React.createElement(SuscripcionCierre) }),
  );
  assert.ok(html.includes('¿Solo una bolsa?'));
  assert.ok(html.includes('bg-[var(--sf-papel)]'), 'el cierre de /suscripciones debe llevar la banda papel de la maqueta');
});

test('NosotrosCierre, variante «fraseYBoton» (Onix): pasa `bandaPapel` — misma maqueta que /suscripciones', () => {
  const contenido = conSeccion('nosotrosCierre', { titulo: 'Un solo café, de una sola finca.', variante: 'fraseYBoton', ctaLabel: '', ctaDestino: '' });
  const html = renderToStaticMarkup(
    React.createElement(SiteContentProvider, { value: contenido, children: React.createElement(NosotrosCierre) }),
  );
  assert.ok(html.includes('Un solo café, de una sola finca.'));
  assert.ok(html.includes('bg-[var(--sf-papel)]'), 'el cierre «fraseYBoton» de /nosotros debe llevar la misma banda papel');
});

test('TiendaCierre, variante «fraseYBoton» (Onix): NO lleva --sf-papel — su propia maqueta pide "banda crema"', () => {
  const contenido = conSeccion('tiendaCierre', { frase: 'EL MISMO CAFÉ, CADA MES.', variante: 'fraseYBoton', boton: '' });
  const html = renderToStaticMarkup(
    React.createElement(SiteContentProvider, { value: contenido, children: React.createElement(TiendaCierre) }),
  );
  assert.ok(html.includes('EL MISMO CAFÉ, CADA MES.'));
  // `.scratch/refero-paginas/r2-onix-tienda.md`, "5 · Cierre": "banda crema, como el contraste de
  // A24" — CREMA es el fondo de la página, no el gris `--papel` de la OTRA maqueta
  // (`.scratch/onix-paginas/onix-suscripciones-nosotros.html`). `TiendaCierre.tsx` está FUERA de
  // `touches:` de este slice y no se editó: no pasa `bandaPapel`, así que esto es una
  // CONSECUENCIA del default de la prop, no una rama nueva de código.
  assert.ok(!html.includes('bg-[var(--sf-papel)]'), '/tienda conserva su banda crema — revisada, no cambiada');
  // Las medidas SÍ son uniformes para los tres consumidores (ver el test de arriba).
  assert.ok(html.includes('py-12 sm:py-16') && html.includes('min-h-[46px]'));
});

test('Línea (nosotrosCierre canónica) y Costura (tiendaCierre canónica): siguen sin --sf-papel/min-h-[46px] — no montan CierreFraseYBoton', () => {
  // Gemelo de "Línea/Costura — byte-identidad" de arriba, con las DOS marcas nuevas de esta tanda
  // (ninguna de las dos pudo existir cuando se escribió `MARCAS_DE_LA_TANDA`, así que se afirma
  // acá en vez de ensanchar esa lista con marcas de OTRA tanda).
  const htmlLinea = renderToStaticMarkup(
    React.createElement(SiteContentProvider, { value: DEFAULTS, children: React.createElement(NosotrosCierre) }),
  );
  const htmlCostura = renderToStaticMarkup(
    React.createElement(SiteContentProvider, { value: DEFAULTS, children: React.createElement(TiendaCierre) }),
  );
  for (const [nombre, html] of [['Línea', htmlLinea], ['Costura', htmlCostura]] as const) {
    assert.ok(!html.includes('bg-[var(--sf-papel)]'), `"${nombre}" no monta CierreFraseYBoton`);
    assert.ok(!html.includes('min-h-[46px]'), `"${nombre}" tiene su propio botón, no el de la pieza compartida`);
  }
});

// ─── La regla del cursor y el token --sf-papel viven en app/globals.css — verificados por FUENTE ──
//
// Ninguna capa de este carril compila CSS (§ el comentario de cabecera, "renderToStaticMarkup...
// no evalúa color-mix()"), así que lo verificable sin navegador es que la DECLARACIÓN existe y
// dice lo que tiene que decir — mismo método que `lib/config/corte-marquesina-velo.test.ts` ya usa
// para `--sf-velo` (`leerDeclaracionCss`, fuera de `touches:` de este slice; acá se repite el
// patrón en vez de importarlo, porque ese archivo no está en la lista de tocados).

function leerGlobalsCss(): string {
  return readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8');
}

test('app/globals.css: --sf-papel existe y mezcla --sf-fondo hacia --sf-tinta, NUNCA hacia --sf-acento', () => {
  const css = leerGlobalsCss();
  const m = css.match(/--sf-papel:\s*([^;]+);/);
  assert.ok(m, '--sf-papel debe declararse en el bloque de tokens del storefront');
  const valor = m![1];
  assert.ok(valor.includes('color-mix(in oklab'), 'derivado por color-mix (como --sf-velo), no un hex que fijaría el gris a un solo tenant');
  assert.ok(valor.includes('var(--sf-fondo)') && valor.includes('var(--sf-tinta)'), 'mezcla fondo hacia tinta');
  // `--sf-superficie` (la RECETA de `lib/config/palette-derive.ts`) mezcla hacia el ACENTO — para
  // Onix/CORTE eso daría un tinte rosado (su acento es un rojo de acción, `#a70004`), no el gris
  // neutro de la maqueta. Es justo lo que --sf-papel existe para no heredar.
  assert.ok(!valor.includes('var(--sf-acento)'), 'nunca hacia el acento — ver el docstring del token en globals.css');
});

test('app/globals.css: la regla del cursor del storefront es el COMPLEMENTO exacto de la del admin (`html.admin`)', () => {
  const css = leerGlobalsCss();
  assert.ok(css.includes('html.admin button:not(:disabled)'), 'la regla del admin se queda intacta');
  assert.ok(css.includes('html:not(.admin) button:not(:disabled)'), 'el storefront necesita su espejo — su ausencia era "a propósito pospuesta", no decidida');
  assert.ok(css.includes('html:not(.admin) summary'), 'los resúmenes plegables entran también, aunque el storefront no monte ninguno todavía');
  assert.ok(css.includes('html:not(.admin) [role="button"]:not(:disabled)'));
});

// ─── § ONIX-TAQUILLA-FILETES-1 — el bloque «Envío a» del cajón «Créditos» lleva el filete superior
// de `.shipsel` (`.scratch/lanzamiento/maqueta-compra/compra.html:231`) ──────────────────────────
//
// Abría `COMPRA-ENVIO-CAJA-PUNTEADA-1` (§ DECISIONS.md, `COMPRA-LINEAS-FIDELIDAD-2`): el bloque
// nacía SIN el contorno de la maqueta. El fix es SÓLO para `esCreditos` (Onix) — Las Chamisas
// (`esAlbum`) usa `.ln-ch .shipsel`, una caja PUNTEADA distinta, que sigue abierta como su propio
// follow-up (no de este slice): la segunda mitad del test lo afirma, para que nadie le ponga este
// mismo filete a Chamisas por accidente.

const VENDEDOR_VACIO: VendedorContent = {
  visible: true, nombreCompleto: '', tipoPersona: '', documentoTipo: '', documentoNumero: '',
  nombreComercial: '', direccion: '', ciudad: '', correo: '', telefono: '', horarioAtencion: '',
  municipioDespacho: '', transportadoras: '', diasPreparacionHabiles: '', ventanaCambiosDias: '',
};

const ITEM_MUESTRA_ENVIO: CajonPanelProps['items'][number] = {
  key: 'muestra-1', id: 'prod-1', nombre: 'Café de muestra', imagen: '', precio: 35_000, quantity: 1,
};

function propsCajon(cajon: CajonPanelProps['cajon']): CajonPanelProps {
  return {
    cajon,
    carrito: { variante: 'anclado' },
    items: [ITEM_MUESTRA_ENVIO],
    departamento: null,
    carritoEnvio: { visible: false },
    coloresPorProducto: {},
    vendedor: VENDEDOR_VACIO,
    onClose: () => {},
    onUpdateQuantity: () => {},
    onRemoveItem: () => {},
    onDepartamentoChange: () => {},
  };
}

function bloqueEnvioA(html: string): string {
  const inicio = html.indexOf('Envío a');
  const inicioDiv = html.lastIndexOf('<div', inicio);
  const finDiv = html.indexOf('</select>', inicio);
  return html.slice(inicioDiv, finDiv);
}

test('CajonPanel, cajon="creditos" (Onix): el bloque "Envío a" lleva el filete superior de `.shipsel` — margen 16px/8px, padding 14px, border-top en --sf-linea', () => {
  const html = renderToStaticMarkup(React.createElement(CajonPanel, propsCajon('creditos')));
  const bloque = bloqueEnvioA(html);
  assert.ok(bloque.includes('Envío a'), 'el bloque "Envío a" debe existir bajo Créditos');
  assert.ok(bloque.includes('mt-4'), 'margin-top 16px (`.shipsel{margin:16px …}`)');
  assert.ok(bloque.includes('mb-2'), 'margin-bottom 8px (`.shipsel{margin:… 0 8px}`)');
  assert.ok(bloque.includes('pt-3.5'), 'padding-top 14px (`.shipsel{padding:14px 0}`)');
  assert.ok(bloque.includes('sf-divisor-t'), 'el filete usa la utilidad compartida de border-top, no un literal Tailwind');
  assert.ok(bloque.includes('border-[var(--sf-linea)]'), 'el color del filete es --sf-linea, como `.shipsel{border-top:1px solid var(--line)}`');
});

test('CajonPanel, cajon="album" (Las Chamisas): el bloque "Envío a" NO lleva este filete — su caja punteada (`.ln-ch .shipsel`) sigue como follow-up aparte', () => {
  const html = renderToStaticMarkup(React.createElement(CajonPanel, propsCajon('album')));
  const bloque = bloqueEnvioA(html);
  assert.ok(bloque.includes('Envío a'), 'el bloque "Envío a" también existe bajo Álbum');
  assert.ok(!bloque.includes('mt-4'), 'Las Chamisas no debe heredar el margen de Onix');
  assert.ok(!bloque.includes('sf-divisor-t'), 'Las Chamisas no debe heredar el filete de línea — necesita la caja punteada, no este fix');
});
