import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from './fixtures';
import { siteContentEditableSchema } from '../../lib/config/site-content-schema';
import { guardarBorrador, publicarSeccion, descartarSeccion } from '../../lib/config/site-content-write';
import { publicarVariasSecciones, descartarVariasSecciones } from '../../app/api/site-content/route';
import { readSiteContent, readSiteContentParaEditor } from '../../lib/config/site-content-read';
import { BANDA_IDS } from '../../lib/config/site-content-defaults';

// EL VIAJE DE PUNTA A PUNTA de las SECCIONES AGREGADAS del home (§ SECCIONES-INSTANCIAS-1):
// guardar → el ROUTE lo pasa por `siteContentEditableSchema` (como `orden-secciones.test.ts`/
// `presentaciones-viaje.test.ts`) → `guardarBorrador` → publicar/descartar (`publicarSeccion`/
// `descartarSeccion('seccionesHome')`, key-agnósticas — NO pasan por el REGISTRY) → y el storefront
// lo lee por `readSiteContent`, exactamente como `app/(storefront)/page.tsx`.
//
// `seccionesHome` es clave META (fuera del REGISTRY, `SeccionKey` la excluye) — un test que llamara
// a `publicarSeccion('seccionesHome')` sin pasar antes por el schema real NO afirmaría que el PUT
// del route de verdad acepta esta clave; por eso éste, como los otros viajes de esta carpeta, pasa
// por el schema primero.

beforeEach(async () => { await prisma.siteContent.deleteMany({}); });
after(async () => { await prisma.siteContent.deleteMany({}); await prisma.$disconnect(); });

/** Simula EXACTAMENTE el PUT de `/api/site-content`: parsea el body con el schema real. */
async function guardarComoElRoute(data: Record<string, unknown>) {
  const parsed = siteContentEditableSchema.parse(data);
  await guardarBorrador(parsed);
}

test('crear una instancia, guardar y publicar: el storefront la ve resuelta, y su id entra a `orden` al final', async () => {
  await guardarComoElRoute({
    seccionesHome: { 'inst:a': { tipo: 'texto', titulo: 'Mi sección nueva', texto: 'cuerpo' } },
  });
  await publicarSeccion('seccionesHome');

  const publicado = await readSiteContent();
  assert.equal(Object.keys(publicado.seccionesHome).length, 1);
  assert.deepEqual(publicado.seccionesHome['inst:a'], {
    tipo: 'texto',
    antetitulo: '',
    titulo: 'Mi sección nueva',
    texto: 'cuerpo',
    ctaLabel: '',
    ctaDestino: '',
    alineacion: 'centro',
    // § MOVIMIENTO-MARCO-GSAP-1 — DEVIATION (fuera de `touches:`): este fixture literal quedó
    // desactualizado por el eje `animacion` nuevo de "texto" (§ lib/config/secciones-instancias.ts),
    // igual que el equivalente en capa 1 (lib/config/secciones-instancias.test.ts). Se corrige acá
    // porque es la MISMA clase de actualización mecánica, no una decisión de producto.
    animacion: '',
    visible: true,
  });
  // Nunca se publicó `orden` explícitamente -> el resolver la agrega AL FINAL de las 9 bandas.
  assert.deepEqual(publicado.orden, [...BANDA_IDS, 'inst:a']);
});

// ─── EL OJO (§ SECCIONES-INSTANCIAS-VIVO-1) — EL VIAJE COMPLETO DE `visible` ─────────────────────
//
// El schema puede declarar `visible` y el resolver puede resolverlo correctamente SIN que eso
// pruebe que el viaje real (el PUT que valida con el schema real → el borrador en la base → publicar
// → el storefront releyendo) lo conserve de punta a punta — exactamente la razón por la que esta
// carpeta existe (§ el docstring de cabecera de este archivo). Por eso va por `guardarComoElRoute`
// (el schema real) como el resto de los tests de aquí, nunca construyendo el objeto a mano.

test('ocultar una instancia (`visible:false`) en borrador y publicar: el storefront la relee oculta — el ojo sobrevive el viaje completo', async () => {
  await guardarComoElRoute({ seccionesHome: { 'inst:a': { tipo: 'texto', titulo: 'T', visible: false } } });
  await publicarSeccion('seccionesHome');

  const publicado = await readSiteContent();
  assert.equal((publicado.seccionesHome['inst:a'] as { visible: boolean }).visible, false);
});

test('una instancia creada SIN decir `visible` nace visible (true) tras el viaje completo', async () => {
  await guardarComoElRoute({ seccionesHome: { 'inst:a': { tipo: 'texto', titulo: 'T' } } });
  await publicarSeccion('seccionesHome');

  const publicado = await readSiteContent();
  assert.equal((publicado.seccionesHome['inst:a'] as { visible: boolean }).visible, true);
});

test('re-mostrar una instancia ya oculta: `visible:true` explícito también sobrevive el viaje', async () => {
  await guardarComoElRoute({ seccionesHome: { 'inst:a': { tipo: 'texto', titulo: 'T', visible: false } } });
  await publicarSeccion('seccionesHome');

  await guardarComoElRoute({ seccionesHome: { 'inst:a': { tipo: 'texto', titulo: 'T', visible: true } } });
  await publicarSeccion('seccionesHome');

  const publicado = await readSiteContent();
  assert.equal((publicado.seccionesHome['inst:a'] as { visible: boolean }).visible, true);
});

test('una instancia Y un orden que la posiciona EN MEDIO de las bandas: el storefront la monta exactamente ahí', async () => {
  const ordenConInstancia = ['hero', 'inst:a', 'marquesina', 'trustBadges', 'featured', 'brandStory', 'origen', 'presentaciones', 'subscriptionCTA', 'testimonials'];
  await guardarComoElRoute({
    seccionesHome: { 'inst:a': { tipo: 'banner', titulo: 'Banner de medio' } },
    orden: ordenConInstancia,
  });
  await publicarVariasSecciones(['seccionesHome', 'orden']);

  const publicado = await readSiteContent();
  assert.deepEqual(publicado.orden, ordenConInstancia);
  assert.equal((publicado.seccionesHome['inst:a'] as { titulo: string }).titulo, 'Banner de medio');
});

test('descartar una instancia en borrador: el storefront sigue sin ella (nunca se publicó)', async () => {
  await guardarComoElRoute({ seccionesHome: { 'inst:a': { tipo: 'texto', titulo: 'Nunca publicada' } } });
  await descartarSeccion('seccionesHome');

  const publicado = await readSiteContent();
  assert.deepEqual(publicado.seccionesHome, {});
  assert.deepEqual(publicado.orden, [...BANDA_IDS]);
});

test('descartar DESPUÉS de publicar: lo ya publicado sobrevive, sólo el borrador posterior se limpia', async () => {
  await guardarComoElRoute({ seccionesHome: { 'inst:a': { tipo: 'texto', titulo: 'V1 publicada' } } });
  await publicarSeccion('seccionesHome');

  await guardarComoElRoute({ seccionesHome: { 'inst:a': { tipo: 'texto', titulo: 'V2 en borrador, nunca publicada' } } });
  await descartarSeccion('seccionesHome');

  const publicado = await readSiteContent();
  assert.equal((publicado.seccionesHome['inst:a'] as { titulo: string }).titulo, 'V1 publicada');
});

test('un id en seccionesHome SIN el prefijo de instancia (escrito directo, saltando el schema) se descarta al leer — el resolver es SOFT', async () => {
  // Simula basura llegando por otra vía (un dato viejo, una corrección a mano) — el schema del PUT
  // rechazaría esto, pero `resolverSeccionesHome` es la última red SOFT.
  await prisma.siteContent.create({ data: { id: 'default', content: { seccionesHome: { 'sin-prefijo': { tipo: 'texto', titulo: 'x' } } } } });
  const publicado = await readSiteContent();
  assert.deepEqual(publicado.seccionesHome, {});
});

test('el PUT real rechaza un `orden` que mezcla una banda, una instancia con prefijo válido, y una cadena inventada', async () => {
  assert.throws(() => siteContentEditableSchema.parse({ orden: ['hero', 'inst:a', 'no-es-ni-banda-ni-instancia'] }));
  // La MISMA lista SIN la cadena inventada sí sobrevive.
  const parsed = siteContentEditableSchema.parse({ orden: ['hero', 'inst:a'] });
  assert.deepEqual(parsed.orden, ['hero', 'inst:a']);
});

test('el GET del editor (readSiteContentParaEditor) marca sinPublicar.seccionesHome cuando hay un borrador pendiente', async () => {
  await guardarComoElRoute({ seccionesHome: { 'inst:a': { tipo: 'texto', titulo: 'x' } } });
  const { sinPublicar } = await readSiteContentParaEditor();
  assert.equal(sinPublicar.seccionesHome, true);

  await publicarSeccion('seccionesHome');
  const { sinPublicar: despues } = await readSiteContentParaEditor();
  assert.equal(despues.seccionesHome, false);
});

test('una imagen de instancia reemplazada en BORRADOR pero aún PUBLICADA no se borra (mismo contrato que las secciones del REGISTRY)', async () => {
  await guardarComoElRoute({ seccionesHome: { 'inst:a': { tipo: 'banner', titulo: 'B', imagen: 'https://blob/A.jpg' } } });
  await publicarSeccion('seccionesHome');

  // Un segundo guardado reemplaza la imagen SÓLO en el borrador — lo publicado sigue con la vieja.
  const { blobsABorrar } = await guardarBorrador(
    siteContentEditableSchema.parse({ seccionesHome: { 'inst:a': { tipo: 'banner', titulo: 'B', imagen: 'https://blob/X.jpg' } } }),
  );
  assert.deepEqual(blobsABorrar, [], 'A sigue publicada; X es la del borrador — ninguna de las dos es huérfana todavía');

  const publicado = await readSiteContent();
  assert.equal((publicado.seccionesHome['inst:a'] as { imagen: string }).imagen, 'https://blob/A.jpg');
});

test('PUBLICAR una imagen de instancia nueva deja la VIEJA huérfana (ya sin referencias) — SÍ se borra', async () => {
  await guardarComoElRoute({ seccionesHome: { 'inst:a': { tipo: 'banner', titulo: 'B', imagen: 'https://blob/A.jpg' } } });
  await publicarSeccion('seccionesHome');
  await guardarComoElRoute({ seccionesHome: { 'inst:a': { tipo: 'banner', titulo: 'B', imagen: 'https://blob/X.jpg' } } });

  const { blobsABorrar } = await publicarSeccion('seccionesHome');
  assert.deepEqual(blobsABorrar, ['https://blob/A.jpg']);
});

// ─── § SECCIONES-TIPOS-2 — EL VIAJE COMPLETO DE LOS TRES TIPOS REPEATER ─────────────────────────
//
// `site-content-schema.test.ts` ya afirma que el schema real acepta los tres (preguntas/columnas/
// filas) con sus `items`, y `secciones-instancias.test.ts` que el resolver los resuelve bien — pero
// eso no prueba que el VIAJE real (PUT con el schema real → borrador en la base → publicar →
// releer con `readSiteContent`) los conserve de punta a punta. Un sólo tipo representativo
// (`columnas`, el único con `min`/`max` del editor Y con imagen por ítem) cubre la cadena completa;
// los otros dos ya están cubiertos campo-a-campo por el schema y el resolver.

test('crear una instancia "columnas" con dos ítems (uno con imagen, uno sin), publicar: el storefront la relee con sus items intactos', async () => {
  await guardarComoElRoute({
    seccionesHome: {
      'inst:col': {
        tipo: 'columnas',
        titulo: 'Nuestras categorías',
        items: [
          { imagen: 'https://blob/col-a.jpg', titulo: 'Categoría A', texto: 'Cuerpo A', enlace: '/tienda' },
          { imagen: '', titulo: 'Categoría B', texto: '', enlace: '' },
        ],
      },
    },
  });
  await publicarSeccion('seccionesHome');

  const publicado = await readSiteContent();
  const col = publicado.seccionesHome['inst:col'] as unknown as { titulo: string; items: Record<string, string>[] };
  assert.equal(col.titulo, 'Nuestras categorías');
  assert.deepEqual(col.items, [
    { imagen: 'https://blob/col-a.jpg', titulo: 'Categoría A', texto: 'Cuerpo A', enlace: '/tienda' },
    { imagen: '', titulo: 'Categoría B', texto: '', enlace: '' },
  ]);
});

test('"columnas" — ocultar con `visible:false` sobrevive el viaje completo, igual que los tipos de campos planos', async () => {
  await guardarComoElRoute({
    seccionesHome: { 'inst:col': { tipo: 'columnas', visible: false, items: [{ titulo: 'A' }, { titulo: 'B' }] } },
  });
  await publicarSeccion('seccionesHome');

  const publicado = await readSiteContent();
  assert.equal((publicado.seccionesHome['inst:col'] as { visible: boolean }).visible, false);
});

test('"columnas" — reemplazar la imagen de UN ítem en el borrador deja la vieja PUBLICADA, no huérfana todavía', async () => {
  await guardarComoElRoute({
    seccionesHome: { 'inst:col': { tipo: 'columnas', items: [{ imagen: 'https://blob/A.jpg', titulo: 'A' }, { titulo: 'B' }] } },
  });
  await publicarSeccion('seccionesHome');

  const { blobsABorrar } = await guardarBorrador(
    siteContentEditableSchema.parse({
      seccionesHome: { 'inst:col': { tipo: 'columnas', items: [{ imagen: 'https://blob/X.jpg', titulo: 'A' }, { titulo: 'B' }] } },
    }),
  );
  assert.deepEqual(blobsABorrar, [], 'A sigue publicada; X es sólo del borrador');

  const publicado = await readSiteContent();
  assert.equal((publicado.seccionesHome['inst:col'] as { items: { imagen: string }[] }).items[0].imagen, 'https://blob/A.jpg');
});

test('"columnas" — PUBLICAR la imagen nueva de un ítem deja la VIEJA huérfana (nadie más la referencia) — SÍ se borra', async () => {
  await guardarComoElRoute({
    seccionesHome: { 'inst:col': { tipo: 'columnas', items: [{ imagen: 'https://blob/A.jpg', titulo: 'A' }, { titulo: 'B' }] } },
  });
  await publicarSeccion('seccionesHome');
  await guardarComoElRoute({
    seccionesHome: { 'inst:col': { tipo: 'columnas', items: [{ imagen: 'https://blob/X.jpg', titulo: 'A' }, { titulo: 'B' }] } },
  });

  const { blobsABorrar } = await publicarSeccion('seccionesHome');
  assert.deepEqual(blobsABorrar, ['https://blob/A.jpg']);
});

// ─── § SECCIONES-TIPOS-3 — EL VIAJE COMPLETO DE "collage" y "video" ─────────────────────────────

test('crear una instancia "collage" con tres ítems (uno video, dos foto), publicar: el storefront la relee con sus items intactos', async () => {
  await guardarComoElRoute({
    seccionesHome: {
      'inst:mosaico': {
        tipo: 'collage',
        titulo: 'La finca',
        disposicion: 'cuatro',
        lado: 'derecha',
        items: [
          { url: 'https://blob/grande.mp4', tipo: 'video', poster: 'https://blob/grande-poster.jpg', enlace: '/tienda', leyenda: 'La cosecha' },
          { url: 'https://blob/chica-a.jpg', leyenda: 'Secado' },
          { url: 'https://blob/chica-b.jpg', leyenda: 'Empaque' },
        ],
      },
    },
  });
  await publicarSeccion('seccionesHome');

  const publicado = await readSiteContent();
  const col = publicado.seccionesHome['inst:mosaico'] as unknown as {
    titulo: string; disposicion: string; lado: string; items: Record<string, string>[];
  };
  assert.equal(col.titulo, 'La finca');
  assert.equal(col.disposicion, 'cuatro');
  assert.equal(col.lado, 'derecha');
  assert.deepEqual(col.items, [
    { url: 'https://blob/grande.mp4', tipo: 'video', poster: 'https://blob/grande-poster.jpg', enlace: '/tienda', leyenda: 'La cosecha' },
    { url: 'https://blob/chica-a.jpg', tipo: '', poster: '', enlace: '', leyenda: 'Secado' },
    { url: 'https://blob/chica-b.jpg', tipo: '', poster: '', enlace: '', leyenda: 'Empaque' },
  ]);
});

test('"collage" — PUBLICAR el video nuevo de un ítem deja el video Y el póster VIEJOS huérfanos — SÍ se borran los dos', async () => {
  await guardarComoElRoute({
    seccionesHome: {
      'inst:mosaico': {
        tipo: 'collage',
        items: [
          { url: 'https://blob/A.mp4', tipo: 'video', poster: 'https://blob/A-poster.jpg', leyenda: 'A' },
          { url: 'https://blob/B.jpg', leyenda: 'B' },
          { url: 'https://blob/C.jpg', leyenda: 'C' },
        ],
      },
    },
  });
  await publicarSeccion('seccionesHome');
  await guardarComoElRoute({
    seccionesHome: {
      'inst:mosaico': {
        tipo: 'collage',
        items: [
          { url: 'https://blob/X.mp4', tipo: 'video', poster: 'https://blob/X-poster.jpg', leyenda: 'A' },
          { url: 'https://blob/B.jpg', leyenda: 'B' },
          { url: 'https://blob/C.jpg', leyenda: 'C' },
        ],
      },
    },
  });

  const { blobsABorrar } = await publicarSeccion('seccionesHome');
  assert.deepEqual(blobsABorrar.sort(), ['https://blob/A-poster.jpg', 'https://blob/A.mp4']);
});

test('crear una instancia "video" (modo fondo, con video+póster), publicar: el storefront la relee intacta', async () => {
  await guardarComoElRoute({
    seccionesHome: {
      'inst:v': {
        tipo: 'video', titulo: 'Mira cómo trabajamos', texto: 'Un vistazo detrás de cámaras',
        ctaLabel: 'Ver más', ctaDestino: '/tienda', imagen: 'https://blob/v.mp4', poster: 'https://blob/p.jpg', modo: 'fondo',
      },
    },
  });
  await publicarSeccion('seccionesHome');

  const publicado = await readSiteContent();
  assert.deepEqual(publicado.seccionesHome['inst:v'], {
    tipo: 'video', titulo: 'Mira cómo trabajamos', texto: 'Un vistazo detrás de cámaras',
    ctaLabel: 'Ver más', ctaDestino: '/tienda', imagen: 'https://blob/v.mp4', poster: 'https://blob/p.jpg', modo: 'fondo',
    // § MOVIMIENTO-EDITOR-EXPOSICION-1 — DEVIATION (fuera de `touches:`): MISMA actualización
    // mecánica que ya hizo MOVIMIENTO-MARCO-GSAP-1 para "texto" más arriba en este archivo (ver su
    // comentario): el eje `animacion` nuevo de "video" (§ lib/config/secciones-instancias.ts) deja
    // este fixture literal desactualizado. Visto fallar con el campo ausente antes de este cambio.
    animacion: '',
    visible: true,
  });
});

test('"video" — PUBLICAR el par video+póster nuevo deja los DOS viejos huérfanos — SÍ se borran', async () => {
  await guardarComoElRoute({
    seccionesHome: { 'inst:v': { tipo: 'video', imagen: 'https://blob/A.mp4', poster: 'https://blob/A-poster.jpg' } },
  });
  await publicarSeccion('seccionesHome');
  await guardarComoElRoute({
    seccionesHome: { 'inst:v': { tipo: 'video', imagen: 'https://blob/X.mp4', poster: 'https://blob/X-poster.jpg' } },
  });

  const { blobsABorrar } = await publicarSeccion('seccionesHome');
  assert.deepEqual(blobsABorrar.sort(), ['https://blob/A-poster.jpg', 'https://blob/A.mp4']);
});

test('"video" — ocultar con `visible:false` sobrevive el viaje completo, igual que los demás tipos', async () => {
  await guardarComoElRoute({
    seccionesHome: { 'inst:v': { tipo: 'video', visible: false } },
  });
  await publicarSeccion('seccionesHome');

  const publicado = await readSiteContent();
  assert.equal((publicado.seccionesHome['inst:v'] as { visible: boolean }).visible, false);
});

// ─── § SECCIONES-CARRUSEL-1 — EL VIAJE COMPLETO DE "carrusel" ───────────────────────────────────

test('crear una instancia "carrusel" con título de cabecera, alto, autoplay y tres diapositivas (una con imagen), publicar: el storefront la relee con todo intacto', async () => {
  await guardarComoElRoute({
    seccionesHome: {
      'inst:car': {
        tipo: 'carrusel',
        titulo: 'Nuestras colecciones',
        alto: 'pantalla',
        autoplay: true,
        items: [
          { imagen: 'https://blob/slide-a.jpg', titulo: 'Primera', texto: 'Cuerpo A', ctaLabel: 'Ver', ctaDestino: '/tienda' },
          { imagen: '', titulo: 'Segunda', texto: '', ctaLabel: '', ctaDestino: '' },
          { imagen: 'https://blob/slide-c.jpg', titulo: 'Tercera', texto: 'Cuerpo C', ctaLabel: '', ctaDestino: '' },
        ],
      },
    },
  });
  await publicarSeccion('seccionesHome');

  const publicado = await readSiteContent();
  const car = publicado.seccionesHome['inst:car'] as unknown as {
    titulo: string; alto: string; autoplay: boolean; items: Record<string, string>[];
  };
  assert.equal(car.titulo, 'Nuestras colecciones');
  assert.equal(car.alto, 'pantalla');
  assert.equal(car.autoplay, true);
  assert.deepEqual(car.items, [
    { imagen: 'https://blob/slide-a.jpg', titulo: 'Primera', texto: 'Cuerpo A', ctaLabel: 'Ver', ctaDestino: '/tienda' },
    { imagen: '', titulo: 'Segunda', texto: '', ctaLabel: '', ctaDestino: '' },
    { imagen: 'https://blob/slide-c.jpg', titulo: 'Tercera', texto: 'Cuerpo C', ctaLabel: '', ctaDestino: '' },
  ]);
});

test('"carrusel" — sin decir nada, nace con `autoplay:false` y SIN `titulo` de cabecera tras el viaje completo', async () => {
  await guardarComoElRoute({
    seccionesHome: { 'inst:car': { tipo: 'carrusel', items: [{ titulo: 'A' }, { titulo: 'B' }] } },
  });
  await publicarSeccion('seccionesHome');

  const publicado = await readSiteContent();
  const car = publicado.seccionesHome['inst:car'] as unknown as { titulo: string; autoplay: boolean };
  assert.equal(car.autoplay, false);
  assert.equal(car.titulo, '');
});

test('"carrusel" — ocultar con `visible:false` sobrevive el viaje completo, igual que los demás tipos', async () => {
  await guardarComoElRoute({
    seccionesHome: { 'inst:car': { tipo: 'carrusel', visible: false, items: [{ titulo: 'A' }, { titulo: 'B' }] } },
  });
  await publicarSeccion('seccionesHome');

  const publicado = await readSiteContent();
  assert.equal((publicado.seccionesHome['inst:car'] as { visible: boolean }).visible, false);
});

test('"carrusel" — reemplazar la imagen de UNA diapositiva en el borrador deja la vieja PUBLICADA, no huérfana todavía', async () => {
  await guardarComoElRoute({
    seccionesHome: { 'inst:car': { tipo: 'carrusel', items: [{ imagen: 'https://blob/A.jpg', titulo: 'A' }, { titulo: 'B' }] } },
  });
  await publicarSeccion('seccionesHome');

  const { blobsABorrar } = await guardarBorrador(
    siteContentEditableSchema.parse({
      seccionesHome: { 'inst:car': { tipo: 'carrusel', items: [{ imagen: 'https://blob/X.jpg', titulo: 'A' }, { titulo: 'B' }] } },
    }),
  );
  assert.deepEqual(blobsABorrar, [], 'A sigue publicada; X es sólo del borrador');

  const publicado = await readSiteContent();
  assert.equal((publicado.seccionesHome['inst:car'] as { items: { imagen: string }[] }).items[0].imagen, 'https://blob/A.jpg');
});

test('"carrusel" — PUBLICAR la imagen nueva de una diapositiva deja la VIEJA huérfana (ya sin referencias) — SÍ se borra', async () => {
  await guardarComoElRoute({
    seccionesHome: { 'inst:car': { tipo: 'carrusel', items: [{ imagen: 'https://blob/A.jpg', titulo: 'A' }, { titulo: 'B' }] } },
  });
  await publicarSeccion('seccionesHome');
  await guardarComoElRoute({
    seccionesHome: { 'inst:car': { tipo: 'carrusel', items: [{ imagen: 'https://blob/X.jpg', titulo: 'A' }, { titulo: 'B' }] } },
  });

  const { blobsABorrar } = await publicarSeccion('seccionesHome');
  assert.deepEqual(blobsABorrar, ['https://blob/A.jpg']);
});

// ─── § MOVIMIENTO-NIVEL-EDITORIAL-1 — EL VIAJE COMPLETO DE "proceso" ("Del fruto a la taza") ────

test('crear una instancia "proceso" con título de cabecera y cinco pasos (uno con foto), publicar: el storefront la relee con todo intacto', async () => {
  await guardarComoElRoute({
    seccionesHome: {
      'inst:proc': {
        tipo: 'proceso',
        titulo: 'Del fruto a la taza',
        items: [
          { etiqueta: '01 · Cosecha', titulo: 'Sólo frutos maduros', texto: 'Recogemos a mano.', imagen: 'https://blob/paso-1.jpg' },
          { etiqueta: '02 · Despulpado', titulo: 'El mismo día', texto: 'Quitamos la pulpa.', imagen: '' },
          { etiqueta: '03 · Secado', titulo: 'Al sol', texto: 'Quince días.', imagen: '' },
          { etiqueta: '04 · Tostión', titulo: 'Lotes pequeños', texto: 'Doce kilos por tanda.', imagen: '' },
          { etiqueta: '05 · Tu taza', titulo: 'Recién tostado', texto: 'Sale esta semana.', imagen: '' },
        ],
      },
    },
  });
  await publicarSeccion('seccionesHome');

  const publicado = await readSiteContent();
  const proc = publicado.seccionesHome['inst:proc'] as unknown as { titulo: string; items: Record<string, string>[] };
  assert.equal(proc.titulo, 'Del fruto a la taza');
  assert.equal(proc.items.length, 5);
  assert.equal(proc.items[0]!.imagen, 'https://blob/paso-1.jpg');
  assert.equal(proc.items[4]!.titulo, 'Recién tostado');
});

test('"proceso" — SIN `animacion`: un valor mandado en el borrador no sobrevive el viaje (el schema la descarta, el tipo nace con S02 incorporado)', async () => {
  await guardarComoElRoute({
    seccionesHome: { 'inst:proc': { tipo: 'proceso', titulo: 'T', animacion: 'T01', items: [{ titulo: 'A' }, { titulo: 'B' }, { titulo: 'C' }] } },
  });
  await publicarSeccion('seccionesHome');

  const publicado = await readSiteContent();
  assert.equal('animacion' in (publicado.seccionesHome['inst:proc'] as unknown as Record<string, unknown>), false);
});

test('"proceso" — ocultar con `visible:false` sobrevive el viaje completo, igual que los demás tipos', async () => {
  await guardarComoElRoute({
    seccionesHome: { 'inst:proc': { tipo: 'proceso', visible: false, items: [{ titulo: 'A' }, { titulo: 'B' }, { titulo: 'C' }] } },
  });
  await publicarSeccion('seccionesHome');

  const publicado = await readSiteContent();
  assert.equal((publicado.seccionesHome['inst:proc'] as { visible: boolean }).visible, false);
});

test('"proceso" — PUBLICAR la foto nueva de UN paso deja la VIEJA huérfana (ya sin referencias) — SÍ se borra', async () => {
  await guardarComoElRoute({
    seccionesHome: { 'inst:proc': { tipo: 'proceso', items: [{ imagen: 'https://blob/A.jpg', titulo: 'A' }, { titulo: 'B' }, { titulo: 'C' }] } },
  });
  await publicarSeccion('seccionesHome');
  await guardarComoElRoute({
    seccionesHome: { 'inst:proc': { tipo: 'proceso', items: [{ imagen: 'https://blob/X.jpg', titulo: 'A' }, { titulo: 'B' }, { titulo: 'C' }] } },
  });

  const { blobsABorrar } = await publicarSeccion('seccionesHome');
  assert.deepEqual(blobsABorrar, ['https://blob/A.jpg']);
});

// ─── § MOVIMIENTO-NIVEL-EDITORIAL-1 — "collage" en disposición HORIZONTAL (el modo de S03) ──────

test('"collage" — `disposicion:\'horizontal\'` sobrevive el viaje completo, ignorando `lado` (irrelevante en ese modo)', async () => {
  await guardarComoElRoute({
    seccionesHome: {
      'inst:gal': {
        tipo: 'collage',
        disposicion: 'horizontal',
        lado: 'derecha',
        items: [
          { url: 'https://blob/1.jpg', leyenda: 'Uno' },
          { url: 'https://blob/2.jpg', leyenda: 'Dos' },
          { url: 'https://blob/3.jpg', leyenda: 'Tres' },
        ],
      },
    },
  });
  await publicarSeccion('seccionesHome');

  const publicado = await readSiteContent();
  const gal = publicado.seccionesHome['inst:gal'] as unknown as { disposicion: string; items: Record<string, string>[] };
  assert.equal(gal.disposicion, 'horizontal');
  assert.equal(gal.items.length, 3);
});
