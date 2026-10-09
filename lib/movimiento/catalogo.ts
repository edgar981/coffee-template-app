// EL REGISTRO DE MOVIMIENTO (§ MOVIMIENTO-MARCO-GSAP-1) — el catálogo con NOMBRE de cada animación
// aprobada para la tienda, sobre GSAP. Módulo PURO (sin DOM, sin 'use client'): lo prueba capa 1
// y lo leen tanto el motor (`components/storefront/movimiento/`) como el eje `animacion` de una
// sección (`lib/config/secciones-instancias.ts`, `lib/config/site-content-schema.ts`).
//
// ORIGEN: el prototipo aprobado por el owner (`docs/movimiento/catalogo-movimiento.html`,
// 2026-10-08 — «Me gustaron todas las animaciones») y el censo `GSAP-MARCO-CENSO-1`
// (`docs/movimiento/GSAP-MARCO-CENSO-1.md`). Cada id (`T01`…) es el mismo del prototipo — el
// mismo código que usó el owner para aprobar, no uno inventado acá.
//
// DOS NIVELES DE VOCABULARIO, A PROPÓSITO (decisión del owner sobre el censo, pregunta-owner-2):
//  · INTERNO — las CUATRO CLASES de `DUNA-MOVIMIENTO.md` (ticker/scrub/revelado/estatico): lo que
//    `npm run censar:movimiento` mide en ejecución y lo que el motor de este archivo implementa.
//  · EXTERNO — el `nombre` de abajo, en palabras llanas ("Aparece por líneas"): lo que el owner ve
//    en el selector del editor (el día que exista, § punto 4 del spec — NO ESTE SLICE).
// Las dos capas NO se fusionan: `clases` (interno) y `nombre`/`descripcion` (externo) son campos
// separados del MISMO registro, nunca una traducción aparte que pueda desalinearse (§ CLAUDE.md,
// "cuando dos declaraciones describen el mismo conjunto, o una DERIVA de la otra o hay un TEST").
//
// `implementada: false` NO es "no existe": es "está en el catálogo, con su nombre y su clase
// medida, pero el motor de ESTE slice no la construye todavía" — el catálogo cubre TODO el
// prototipo (19 animaciones) aunque sólo 11 (las ESENCIALES que el spec lista) tengan motor.
//
// `ClaseMovimiento` se IMPORTA de `./clasificar` (§ ARNES-CENSO-MOVIMIENTO-1, el arnés que mide
// estas clases en ejecución) y se ACOTA con `Exclude<…, 'estatico'>` — nunca se redeclara el union
// de cuatro strings a mano acá. Las dos declaraciones describen el MISMO concepto (el vocabulario
// de `DUNA-MOVIMIENTO.md`), y una segunda copia independiente es exactamente la trampa que
// `CATEGORIAS ≠ CATEGORIA_LABELS` (§ CLAUDE.md) ya pagó: una DERIVA de la otra, nunca dos fuentes.
import type { ClaseMovimiento as ClaseMovimientoMedida } from './clasificar';

/** Las TRES clases que una entrada del catálogo puede DECLARAR sobre sí misma — el vocabulario
 *  INTERNO de `DUNA-MOVIMIENTO.md`, medible con `censar:movimiento`. Un elemento puede declarar
 *  más de una a la vez (el marquee del hero: ticker en el eje horizontal, revelado en el vertical
 *  — § "Un elemento puede ser dos cosas a la vez", DUNA-MOVIMIENTO.md). `estatico` NO aparece acá:
 *  es la AUSENCIA de las otras tres (`clasificar.ts` la usa para REPORTAR un elemento que no se
 *  mueve; ninguna entrada de este catálogo existe para no moverse), así que se EXCLUYE del tipo en
 *  vez de permitir un valor que ninguna entrada real usaría. */
export type ClaseMovimiento = Exclude<ClaseMovimientoMedida, 'estatico'>;

/** Nivel de curaduría — MISMO vocabulario que el prototipo (las tres fichas de cabecera:
 *  "Esencial · Editorial · Firma"), no una escala inventada acá. */
export type NivelMovimiento = 'esencial' | 'editorial' | 'firma';

/** A qué TIPO DE ELEMENTO aplica — el vocabulario que el punto 4 del spec declara para el eje
 *  `animacion` por tipo de sección ("texto, imagen, tarjetas, cifras, sección, hero"). */
export type ElementoMovimiento = 'texto' | 'imagen' | 'tarjetas' | 'cifras' | 'seccion' | 'hero';

export interface MovimientoDef {
  /** El id del prototipo (`T01`…) — ESTABLE: es lo que un valor guardado de `animacion` persiste,
   *  y lo que `npm run censar:movimiento` podría citar el día que esta herramienta reporte en
   *  estos mismos términos (pregunta-owner-2 del censo, capa de presentación aparte). */
  id: string;
  /** El nombre en palabras llanas — el vocabulario EXTERNO (ver el docstring de cabecera). Nunca
   *  el id crudo, nunca jerga de GSAP ("ScrollTrigger con scrub"). */
  nombre: string;
  nivel: NivelMovimiento;
  aplicaA: ElementoMovimiento;
  /** Vocabulario INTERNO (§ DUNA-MOVIMIENTO.md) — puede llevar más de una clase; vacío es un caso
   *  que este catálogo no tiene hoy (todas las 19 entradas declaran al menos una). */
  clases: readonly ClaseMovimiento[];
  /** Una frase corta en el vocabulario interno — lo que `censar-movimiento` reportaría de este
   *  elemento, no una descripción de marketing. */
  descripcion: string;
  /** ¿El motor de `components/storefront/movimiento/` la implementa hoy? Ver el docstring de
   *  cabecera — `false` es catálogo sin motor, no ausencia. */
  implementada: boolean;
}

// ─── EL CATÁLOGO — LAS 19 DEL PROTOTIPO, EN SU ORDEN ────────────────────────────────────────────

export const CATALOGO_MOVIMIENTO: readonly MovimientoDef[] = [
  // ── Texto ──
  {
    id: 'T01', nombre: 'Aparece por líneas', nivel: 'esencial', aplicaA: 'texto',
    clases: ['revelado'],
    descripcion: 'Cada línea del texto revela al entrar al 82% del viewport, en cascada (0.12s por línea); no vuelve a moverse.',
    implementada: true,
  },
  {
    id: 'T02', nombre: 'Palabra por palabra', nivel: 'esencial', aplicaA: 'texto',
    clases: ['revelado'],
    descripcion: 'Cada palabra revela en cascada (0.07s) al entrar al viewport. El lector de pantalla oye la frase entera (aclaración del owner: entra al catálogo).',
    implementada: true,
  },
  {
    id: 'T03', nombre: 'Letra a letra', nivel: 'editorial', aplicaA: 'texto',
    clases: ['revelado'],
    descripcion: 'Cada letra revela en cascada (0.05s), con una rotación leve al asentar. Para títulos cortos (aclaración del owner: entra al catálogo).',
    implementada: true,
  },
  {
    id: 'T04', nombre: 'Palabra resaltada', nivel: 'esencial', aplicaA: 'texto',
    clases: ['revelado'],
    descripcion: 'El bloque revela de una vez y, encima, una palabra marcada por quien diseña la tienda rellena su subrayado con el color de acento.',
    implementada: true,
  },
  {
    id: 'T05', nombre: 'Por bloque', nivel: 'esencial', aplicaA: 'texto',
    clases: ['revelado'],
    descripcion: 'El bloque entero revela de una sola vez, subiendo un poco mientras funde opacidad. La opción más tranquila para texto largo.',
    implementada: true,
  },
  // § MOVIMIENTO-NIVEL-EDITORIAL-1 — T06 cambió su `aplicaA` de 'texto' a 'imagen': en el prototipo
  // el título gigante se desliza SOBRE UNA FOTO (`.gigante-zona.foto`, § catalogo-movimiento.html),
  // y el spec de este slice lo pide explícito para "banner/imagen con texto" — los dos tipos cuyo
  // `animacionElemento` ya es 'imagen' (§ DESCRIPTOR_INSTANCIA, secciones-instancias.ts). Queda en
  // su posición original del array (agrupado con T01-T05 en la lectura humana del catálogo, que
  // sigue el orden del prototipo) — `aplicaA` es el único campo que decide el filtro real.
  {
    id: 'T06', nombre: 'Tipografía gigante que cruza', nivel: 'editorial', aplicaA: 'imagen',
    clases: ['scrub'],
    descripcion: 'El título se desliza de lado SOBRE la foto, atado a la posición de scroll mientras la sección pasa por el viewport — avanza y retrocede si el visitante retrocede.',
    implementada: true,
  },
  // ── Imagen ──
  {
    id: 'I01', nombre: 'Máscara que se abre', nivel: 'esencial', aplicaA: 'imagen',
    clases: ['revelado'],
    descripcion: 'La foto se descubre de abajo hacia arriba (clip-path) al entrar al viewport; una sola vez.',
    implementada: true,
  },
  {
    id: 'I02', nombre: 'Escala suave', nivel: 'esencial', aplicaA: 'imagen',
    clases: ['revelado'],
    descripcion: 'La foto entra más grande (escala 1.18) y se asienta a su tamaño real al entrar al viewport; una sola vez.',
    implementada: true,
  },
  {
    id: 'I03', nombre: 'Parallax', nivel: 'esencial', aplicaA: 'imagen',
    clases: ['scrub'],
    descripcion: 'La foto se traslada verticalmente atada a la posición de scroll de su marco — más despacio que la página, no una vez y listo.',
    implementada: true,
  },
  // ── Tarjetas y cifras ──
  {
    id: 'C01', nombre: 'Tarjetas escalonadas', nivel: 'esencial', aplicaA: 'tarjetas',
    clases: ['revelado'],
    descripcion: 'Las tarjetas entran una tras otra (stagger 0.12s) al entrar al viewport; una sola vez.',
    implementada: true,
  },
  {
    id: 'C02', nombre: 'Elevar al pasar el mouse', nivel: 'esencial', aplicaA: 'tarjetas',
    clases: [],
    descripcion: 'Interacción de puntero (pointerenter/leave), no una de las cuatro clases de scroll/tiempo: cada tarjeta se eleva y rota levemente al pasar el mouse, y vuelve al soltar.',
    implementada: true,
  },
  {
    id: 'N01', nombre: 'Cifras que cuentan', nivel: 'esencial', aplicaA: 'cifras',
    clases: ['revelado'],
    descripcion: 'Revelado con componente TEMPORAL (§ DUNA-MOVIMIENTO.md): al entrar al viewport, cada número cuenta desde cero hasta su valor (1.4s) y una línea bajo él crece en paralelo.',
    implementada: true,
  },
  // ── Secciones (narrativa, pin + scrub) ──
  // § MOVIMIENTO-NIVEL-EDITORIAL-1 — S01 SIN pin: el fondo de la sección entera transiciona de
  // forma CONTINUA (scrub puro, sin capítulos discretos con umbral propio) entre tres colores de la
  // paleta (fondo→acento→tostado) mientras la sección cruza el viewport — simplificación deliberada
  // frente al prototipo (que fija el color al cruzar el 55% de CADA sub-bloque "capitulo"): este
  // catálogo no tiene un tipo con sub-bloques de capítulo, así que "el capítulo" lo hace la sección
  // ENTERA cambiando de color a su propio paso. Con VARIAS instancias consecutivas que lo usen, el
  // recorrido se lee como una secuencia de capítulos — sin pin ni estado compartido entre ellas (§
  // DUNA-MOVIMIENTO.md, la sección de este slice, para el porqué completo). Sólo ofrecido hoy en
  // "texto" (§ InstanciaEditorForm.tsx) — ver el comentario de `InstanciaDescriptor.animacionElemento`.
  {
    id: 'S01', nombre: 'Capítulos de color', nivel: 'editorial', aplicaA: 'seccion',
    clases: ['scrub'],
    descripcion: 'El fondo de la sección transiciona entre tres colores de la paleta (fondo→acento→tostado), atado a la posición de scroll mientras la sección cruza el viewport — sin pin.',
    implementada: true,
  },
  // S02 es el motor de la sección "proceso" (§ secciones-instancias.ts, DESCRIPTOR_INSTANCIA.proceso)
  // — NO se ofrece vía «Animación»: el tipo nace CON esta animación incorporada, no como una opción
  // entre varias (no declara `animacionElemento`). El objeto es un círculo cuyo color/escala/rotación
  // tween de forma CONTINUA a lo largo de TODO el recorrido pineado (de la paleta: acento→tinta,
  // nunca fijo), y al llegar al ÚLTIMO paso aparece una taza — generaliza a cualquier N de 3 a 6
  // pasos sin ramas por paso (simplificación frente al prototipo, que anima 5 etapas con nombre
  // fijo: cereza/grano/pergamino/tostado/taza — ver DUNA-MOVIMIENTO.md para el porqué).
  {
    id: 'S02', nombre: 'Del fruto a la taza', nivel: 'editorial', aplicaA: 'seccion',
    clases: ['scrub'],
    descripcion: 'La sección se pinea; un objeto cambia de color y escala (de la paleta) mientras recorre los pasos atado al progreso de scroll, y revela una taza en el último paso.',
    implementada: true,
  },
  // S03 es un MODO de "collage" (`disposicion: 'horizontal'`, § secciones-instancias.ts), no una
  // opción de «Animación»: elegir esa disposición reemplaza el mosaico grande+chicas por la tira
  // horizontal pineada — mismo criterio que `modo` en "video" (un campo que cambia la FORMA de la
  // sección, no su animación de entrada). Ver Collage.tsx.
  {
    id: 'S03', nombre: 'Galería horizontal', nivel: 'editorial', aplicaA: 'seccion',
    clases: ['scrub'],
    descripcion: 'La sección se pinea y las fotos se deslizan de lado atadas al progreso de scroll vertical.',
    implementada: true,
  },
  // ── Héroes (firma, pin + scrub narrativo) — § MOVIMIENTO-NIVEL-FIRMA-1: las tres ganan motor Y
  // pasan a ser COMPOSICIONES DEL HERO (`hero.variante`: 'grano'/'cereza'/'paisaje'), no un eje
  // `animacion` sobre una zona — ver `HeroGrano.tsx`/`HeroCereza.tsx`/`HeroPaisaje.tsx`
  // (`components/storefront/home/`). `clases` suma 'revelado' a las tres (además de 'scrub'): cada
  // una tiene un tramo con un ESTADO FINAL claro que "reproducir una vez" puede mostrar en el
  // editor («▶ Ver animación», § el spec) — `forzar=true` salta el `ScrollTrigger`/pin y corre el
  // timeline entero una sola vez, igual que T01-T06.
  {
    id: 'H01', nombre: 'El grano cae en la taza', nivel: 'firma', aplicaA: 'hero',
    clases: ['scrub', 'revelado'],
    descripcion: 'El hero se pinea; un grano cae y se tuesta (de acento a tinta, la paleta) atado al progreso de scroll, hasta fundirse en el café con un repique en la superficie.',
    implementada: true,
  },
  {
    id: 'H02', nombre: 'La cereza se expande', nivel: 'firma', aplicaA: 'hero',
    clases: ['scrub', 'revelado'],
    descripcion: 'El hero se pinea; una cereza se acerca y crece hasta cubrir la pantalla, atada al progreso de scroll — transición al resto de la página.',
    implementada: true,
  },
  {
    id: 'H03', nombre: 'Paisaje en capas', nivel: 'editorial', aplicaA: 'hero',
    clases: ['scrub', 'revelado'],
    descripcion: 'Las capas del paisaje (la foto/video de fondo, o la ilustración por capas sin ella) se trasladan a velocidades distintas atadas al scroll.',
    implementada: true,
  },
  // ── Cierre ──
  {
    id: 'CTA01', nombre: 'Vapor que forma el llamado', nivel: 'firma', aplicaA: 'seccion',
    clases: ['scrub', 'revelado'],
    descripcion: 'El trazo del vapor se dibuja atado al scroll (scrub) y, al completar, la frase y el botón revelan (una sola vez). Nace incorporado en el tipo "cierre", como S02 en "proceso".',
    implementada: true,
  },
] as const;

/** El valor que significa «Ninguna» — la AUSENCIA de animación, nunca una entrada del catálogo.
 *  Es el canónico de todo eje `animacion` de sección: ausente, vacío o basura resuelven acá. */
export const MOVIMIENTO_NINGUNA = '';

const POR_ID = new Map(CATALOGO_MOVIMIENTO.map((d) => [d.id, d] as const));

/** El set CERRADO de valores válidos para un eje `animacion` de sección — «Ninguna» MÁS cada id
 *  del catálogo (implementada o no: elegir una todavía-sin-motor no es basura, es una elección
 *  válida que el motor ignora hasta que la construya — ver `motorDisponible`). Para el
 *  `EscalarInstanciaDef`/`VariantesDef` de quien declare el eje (mismo contrato que cualquier
 *  escalar clampado del REGISTRY). */
export const CLAVES_ANIMACION: readonly string[] = [MOVIMIENTO_NINGUNA, ...CATALOGO_MOVIMIENTO.map((d) => d.id)];

/** La definición del catálogo para un id, o `undefined` si no existe (incluye `''`/basura). */
export function movimientoPorId(id: string): MovimientoDef | undefined {
  return POR_ID.get(id);
}

/** ¿Es un valor de `animacion` reconocible — «Ninguna» o un id real del catálogo? SOFT, como
 *  cualquier validador de este repo: no lanza, sólo informa. */
export function esMovimientoId(v: unknown): v is string {
  return typeof v === 'string' && (v === MOVIMIENTO_NINGUNA || POR_ID.has(v));
}

/** ¿El motor de `components/storefront/movimiento/` sabe animar este id HOY? `MOVIMIENTO_NINGUNA`
 *  nunca está "disponible" — no es una animación que animar, es la ausencia de una. */
export function motorDisponible(id: string): boolean {
  return id !== MOVIMIENTO_NINGUNA && !!POR_ID.get(id)?.implementada;
}

// § MOVIMIENTO-EDITOR-EXPOSICION-1 — el catálogo FILTRADO que el selector del editor ofrece para UN
// `elemento` (texto/imagen/tarjetas/cifras/sección/hero): sólo las entradas CON MOTOR
// (`implementada:true`) — una tarjeta "con una mini animación en loop" no puede dibujar el loop de
// algo que el motor todavía no construye (§ `DUNA-MOVIMIENTO.md`, "implementada:false… el catálogo
// puede nombrar una animación antes de construirla"). Preserva el orden de `CATALOGO_MOVIMIENTO`
// (agrupado por elemento desde que se escribió, § el comentario de ese array) — nunca reordena.
export function catalogoMovimientoDeElemento(elemento: ElementoMovimiento): readonly MovimientoDef[] {
  return CATALOGO_MOVIMIENTO.filter((d) => d.aplicaA === elemento && d.implementada);
}

/** ¿Tiene sentido «reproducir una vez» este id? Sólo los de clase `revelado` — un `scrub` (I03,
 *  continuo, atado a la posición de scroll) o una interacción de puntero sin tween de entrada (C02,
 *  `clases: []`) no tienen un estado final al que llegar de un solo play. FUENTE ÚNICA de este
 *  criterio: `useMovimiento.ts` (`reproducir()`) y el botón «Ver animación» del editor lo consultan
 *  a ÉSTA, nunca repiten `.clases.includes('revelado')` cada uno por su cuenta. */
export function puedeReproducirUnaVez(id: string): boolean {
  return !!movimientoPorId(id)?.clases.includes('revelado');
}
