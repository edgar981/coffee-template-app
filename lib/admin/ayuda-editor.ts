import { SECCIONES_TIENDA } from '@/components/admin/tienda-secciones';
import { CATALOGO_INSTANCIAS } from '@/lib/config/secciones-instancias';

// EL CENTRO DE AYUDA del editor (§ EDITOR-AYUDA-1). Datos PUROS — sin React, sin 'use client' —
// mismo criterio que `tienda-secciones.ts`/`secciones-instancias.ts`: el contenido se prueba sin
// montar nada (`ayuda-editor.test.ts`), y los componentes (`components/admin/editor/AyudaCentro.tsx`)
// sólo lo RENDERIZAN.
//
// Pensado para quien YA recibió la capacitación y se olvidó un paso — no para quien nunca usó el
// editor. Por eso cada guía es corta y en el mismo tono que el resto del panel (tuteo, sin
// tecnicismos: nada de «iframe», «borrador JSON», «slug»).

export type TemaAyudaId =
  | 'primeros-pasos'
  | 'editar-textos'
  | 'fotos-videos'
  | 'secciones'
  | 'hero'
  | 'estilo'
  | 'cromo'
  | 'dispositivos'
  | 'publicar';

export interface PasoGuia {
  texto: string;
  /** Mini ilustración OPCIONAL (el spec: "pueden llevar una mini ilustración hecha con CSS/SVG…
   *  no capturas pesadas"): una cadena corta de 2-4 etiquetas que el centro de ayuda dibuja como
   *  pasos conectados, en el lenguaje visual del prototipo (`IlustracionAyuda.tsx`). No todo paso
   *  necesita una — la mayoría son sólo texto. */
  secuencia?: string[];
}

export interface GuiaAyuda {
  id: TemaAyudaId;
  titulo: string;
  /** Una línea: lo que responde la guía, para la fila de la lista y el resultado de búsqueda. */
  resumen: string;
  pasos: PasoGuia[];
  /** Para el buscador — además de `titulo`/`resumen`, que ya se buscan siempre. */
  palabrasClave: string[];
  /** Los niveles del panel cuyo «?» abre ESTA guía (§ `NIVELES_PANEL`, abajo). Vacío = esta guía
   *  sólo se llega desde la lista del centro de ayuda o el buscador, nunca desde un «?» suelto. */
  niveles: string[];
}

export interface PreguntaFrecuente {
  id: string;
  pregunta: string;
  respuesta: string;
  palabrasClave?: string[];
}

export interface AtajoTeclado {
  id: string;
  combinacion: string;
  accion: string;
}

// LOS NIVELES REALES DEL PANEL — derivados de las fuentes que YA existen, no una segunda lista a
// mano (§ CLAUDE.md, "cuando dos declaraciones describen el mismo conjunto, o una DERIVA de la
// otra o hay un TEST que las ata"). Las secciones de contenido vienen de `SECCIONES_TIENDA`
// (`.seccion`, la MISMA identidad que `TiendaPaginas.nivelActivo`/`TiendaSeccionEditor` usan hoy);
// el cromo (`CromoKey`, TiendaPaginas.tsx) y el nivel «elemento» del hero (`ZonaHeroKey`,
// TiendaSeccionEditor.tsx) son conjuntos FIJOS y chicos que ninguno de los dos archivos exporta —
// se repiten acá como literales, y el test de este módulo es lo que los mantiene honestos: si
// alguna vez se renombra una zona del hero o una clave de cromo sin actualizar esto, la guía
// correspondiente sigue apuntando a un nivel que ya no existe y el test lo delata.
const NIVELES_SECCIONES: readonly string[] = SECCIONES_TIENDA.map((c) => c.seccion);
const NIVELES_CROMO: readonly string[] = ['encabezado', 'menu', 'footer'];
const NIVELES_ELEMENTO_HERO: readonly string[] = ['titular', 'subtitulo', 'botones', 'indicador'];
const NIVELES_META: readonly string[] = ['inicio', 'estilo'];

/** Todo nivel del panel que un «?» puede nombrar — usado para VALIDAR (§ `ayuda-editor.test.ts`),
 *  nunca para decidir qué se muestra. */
export const NIVELES_PANEL: readonly string[] = [
  ...NIVELES_META,
  ...NIVELES_CROMO,
  ...NIVELES_ELEMENTO_HERO,
  ...NIVELES_SECCIONES,
];

// Las secciones de CONTENIDO que no son el hero caen todas bajo la guía genérica «Secciones» — no
// hay una guía propia por sección (serían ~14 guías casi idénticas). Se deriva de `SECCIONES_TIENDA`
// para que una sección nueva quede cubierta sola, sin tocar este archivo.
const NIVELES_SECCIONES_GENERICAS = NIVELES_SECCIONES.filter((s) => s !== 'hero');

// § MOVIMIENTO-NIVEL-FIRMA-1 — LA LISTA DE TIPOS de «Agregar sección» se DERIVA de
// `CATALOGO_INSTANCIAS` (`lib/config/secciones-instancias.ts`), nunca escrita a mano: estaba vencida
// —enumeraba sólo Texto/Imagen con texto/Banner/Preguntas/Columnas/Filas, perdiendo Collage, Video,
// Carrusel y Proceso en cuanto el catálogo creció— y una lista a mano vuelve a vencer la próxima vez
// que el catálogo gane un tipo (como "cierre", acá mismo). Ésta es la fuente ÚNICA (§ CLAUDE.md,
// "cuando dos declaraciones describen el mismo conjunto, o una DERIVA de la otra o hay un TEST").
const NOMBRES_TIPOS_INSTANCIA = CATALOGO_INSTANCIAS.map((c) => c.nombre).join(', ');

export const GUIAS_AYUDA: GuiaAyuda[] = [
  {
    id: 'primeros-pasos',
    titulo: 'Primeros pasos',
    resumen: 'Qué es este editor y cómo se guardan tus cambios.',
    palabrasClave: ['editor', 'empezar', 'borrador', 'guardar', 'publicado', 'deshacer'],
    niveles: [],
    pasos: [
      { texto: 'Este editor muestra tu tienda real: lo que ves a la derecha es la misma página que ve un cliente, sólo que con tus cambios en borrador.' },
      { texto: 'No hay botón de «Guardar»: cada cambio se guarda solo, unos segundos después de que dejas de escribir. Arriba a la derecha, el punto y el texto te dicen si ya se guardó.' },
      {
        texto: 'Guardado no es lo mismo que publicado. Lo que guardas queda en un borrador que sólo ves tú; tu tienda sigue mostrando lo último publicado hasta que tocas «Publicar».',
        secuencia: ['Editas', 'Se guarda solo', 'Publicas'],
      },
      { texto: '«Publicar» cuenta tus cambios pendientes y, al tocarlo, te los lista en palabras antes de confirmar nada. Ahí mismo puedes «Descartar todo» si te arrepientes.' },
      { texto: 'Si algo sale mal, Ctrl/Cmd+Z deshace el último paso — funciona arriba (en los controles) y también adentro de la página, mientras sigas en la misma sección y página.' },
    ],
  },
  {
    id: 'editar-textos',
    titulo: 'Editar textos',
    resumen: 'Toca cualquier texto de la página para cambiarlo.',
    palabrasClave: ['texto', 'escribir', 'titulo', 'párrafo', 'campo'],
    niveles: [],
    pasos: [
      {
        texto: 'Toca el texto que quieras cambiar directamente sobre la página — se abre un cuadro ahí mismo, sin moverte de lugar.',
        secuencia: ['Tocas el texto', 'Escribes', 'Tocas afuera'],
      },
      { texto: 'Escribe el texto nuevo. Mientras escribes, el cuadro crece solo para que veas todo lo que vas poniendo.' },
      { texto: 'Para terminar, toca afuera del cuadro — tu cambio queda en borrador, listo para publicar cuando quieras.' },
      { texto: '¿Te arrepentiste de la última palabra? Ctrl/Cmd+Z la deshace al toque, igual que en cualquier campo de texto.' },
    ],
  },
  {
    id: 'fotos-videos',
    titulo: 'Fotos y videos',
    resumen: 'Cambiar una imagen, subir un video y elegir qué parte de la foto se ve.',
    palabrasClave: ['foto', 'imagen', 'video', 'subir', 'poster', 'punto focal', 'formato'],
    niveles: [],
    pasos: [
      { texto: 'Toca la foto, o el botón «Cambiar» junto a ella, para elegir un archivo nuevo desde tu computador.' },
      { texto: 'Se aceptan fotos en JPG, PNG o WebP. Para video se aceptan MP4, WebM y también archivos .mov — un .mov se convierte solo a un formato que se ve en cualquier navegador.' },
      { texto: 'Un video necesita un «póster»: la imagen que se ve antes de que el video arranque. Puedes tomarla de un fotograma del propio video o subir una foto aparte.' },
      { texto: 'En la portada del hero puedes elegir el «Punto focal»: qué parte de la foto se mantiene siempre a la vista, aunque la pantalla sea angosta.' },
      { texto: 'Los videos pesan: para que carguen rápido en el teléfono de un cliente hay un tamaño máximo por video — si tu archivo es muy grande, el editor te lo va a decir antes de subirlo.' },
    ],
  },
  {
    id: 'secciones',
    titulo: 'Secciones',
    resumen: 'Ordenar, mostrar u ocultar, agregar, duplicar y eliminar secciones de la página.',
    palabrasClave: ['sección', 'orden', 'mover', 'ocultar', 'agregar', 'duplicar', 'eliminar', 'inicio'],
    niveles: ['inicio', ...NIVELES_SECCIONES_GENERICAS],
    pasos: [
      { texto: 'En «Inicio» ves todas las secciones de la página activa, en el mismo orden en que aparecen en la tienda.' },
      { texto: 'Para moverlas, arrastra el asa de puntos a la izquierda de cada fila — o, con el foco ahí, usa las flechas arriba/abajo del teclado.' },
      { texto: 'El ojo de cada fila la muestra u oculta en la tienda. Una sección oculta sigue acá, lista para volver a encenderla cuando quieras.' },
      { texto: `«Agregar sección» te deja elegir entre varios tipos — ${NOMBRES_TIPOS_INSTANCIA} — y la agrega al final. Después la puedes mover a donde quieras.` },
      { texto: 'Las secciones que agregaste tienen un menú «⋯» con Duplicar y Eliminar. Las secciones de siempre (como el hero o la historia) sólo se pueden ocultar, no eliminar: son parte de la base de tu tienda.' },
      { texto: 'Eliminar una sección agregada pide confirmación. Mientras no publiques ese cambio, sigues a tiempo de deshacerlo con Ctrl/Cmd+Z.' },
    ],
  },
  {
    id: 'hero',
    titulo: 'El hero',
    resumen: 'La portada de tu tienda: su composición, sus zonas y su fondo.',
    palabrasClave: ['hero', 'portada', 'titular', 'subtitulo', 'boton', 'composicion', 'alto', 'fondo', 'indicador'],
    niveles: ['hero', ...NIVELES_ELEMENTO_HERO],
    pasos: [
      { texto: 'El hero es lo primero que ve un cliente. Elige su «Composición» para cambiar cómo se reparte: con una tarjeta de producto, a pantalla completa, con una foto al costado, etc.' },
      { texto: 'Cada composición tiene sus propias zonas — Titular, Subtítulo, Botones, Indicador. Una zona vacía te ofrece «+ Agregar» en su lugar; una zona llena se toca para editarla.' },
      { texto: 'Si cambias de composición y una zona no tiene lugar en la nueva, su contenido se guarda — no se pierde. Vuelve a la composición anterior y ahí sigue.' },
      { texto: '«Alto» decide cuánto ocupa el hero en la pantalla: Justo, Alto o Pantalla completa. «Fondo» es la foto o el video detrás, con «Oscurecer» para que el texto se siga leyendo encima.' },
    ],
  },
  {
    id: 'estilo',
    titulo: 'Estilo',
    resumen: 'Los colores y las letras de toda tu tienda, de un solo lugar.',
    palabrasClave: ['estilo', 'color', 'colores', 'letra', 'letras', 'tipografia', 'forma', 'combinacion', 'tema'],
    niveles: ['estilo'],
    pasos: [
      { texto: '«Combinaciones» te da paletas y pares de letra ya armados — un clic recolorea toda la tienda.' },
      { texto: '«Base» es tu fondo y tu color de texto; «Acento de marca» es el color de tus botones y detalles. El resto de los colores se calculan solos a partir de estos dos.' },
      { texto: '«Letras» elige el par de tipografías (títulos y textos) de una colección ya pensada para que siempre se vean bien juntas.' },
      { texto: '«Forma» decide si los bordes de botones y tarjetas son rectos, mínimos o suaves.' },
      { texto: 'Esto es el estilo de TODA la tienda, no de una sección: tiene su propio borrador y su propio «Publicar», separado del resto.' },
    ],
  },
  {
    id: 'cromo',
    titulo: 'Encabezado, menú y pie',
    resumen: 'El logo, el menú de arriba y el pie de página, para toda la tienda.',
    palabrasClave: ['encabezado', 'menu', 'nav', 'pie', 'footer', 'logo'],
    niveles: [...NIVELES_CROMO],
    pasos: [
      { texto: 'El Encabezado es la franja de arriba: tu logo (o el nombre de tu tienda) y cómo se ve el menú.' },
      { texto: 'El Menú deja renombrar cada enlace y elegir a dónde va cada uno.' },
      { texto: 'El Pie tiene textos que se editan tocándolos directo en la página, igual que cualquier otro texto, además de interruptores — por ejemplo, para mostrar u ocultar el crédito «Hecho por Duna».' },
      { texto: 'Estas tres secciones se ven en TODAS las páginas: lo que cambias acá aparece en Inicio, Nosotros y Suscripciones por igual.' },
    ],
  },
  {
    id: 'dispositivos',
    titulo: 'Ver en el teléfono y tableta',
    resumen: 'Cómo se ve tu tienda en cada tamaño de pantalla, y cómo verla publicada.',
    palabrasClave: ['telefono', 'celular', 'tableta', 'tablet', 'escritorio', 'dispositivo', 'vista previa'],
    niveles: [],
    pasos: [
      { texto: 'Arriba, el grupo de tres íconos (pantalla, tableta, teléfono) cambia el ancho de la vista al de cada dispositivo. Tu elección se recuerda la próxima vez que abres el editor.' },
      { texto: 'Lo que ves en pantalla es tu borrador, en vivo: cada cambio aparece ahí apenas lo haces, sin tener que recargar nada.' },
      { texto: '«Vista previa» abre en una pestaña nueva la página YA PUBLICADA — así puedes comparar lo que estás armando contra lo que un cliente ve hoy mismo.' },
    ],
  },
  {
    id: 'publicar',
    titulo: 'Publicar',
    resumen: 'Qué hace «Publicar», qué lista te muestra antes, y cómo descartar.',
    palabrasClave: ['publicar', 'descartar', 'resumen', 'cambios pendientes'],
    niveles: [],
    pasos: [
      { texto: 'El botón «Publicar» aparece con un número: cuántos cambios tienes sin publicar. Si no tienes ninguno, el botón ni se muestra.' },
      { texto: 'Al tocarlo, se abre una lista en palabras de cada cambio — qué sección, qué campo, y si es nuevo o si cambió.' },
      { texto: 'Tocar cualquier fila de esa lista te lleva directo a ese cambio, para revisarlo antes de publicar.' },
      {
        texto: '«Publicar» hace que todos esos cambios se vean en la tienda real, al instante. «Descartar todo» los borra y vuelve a lo que ya estaba publicado.',
        secuencia: ['Revisas la lista', 'Publicas o descartas'],
      },
    ],
  },
];

export const PREGUNTAS_FRECUENTES: PreguntaFrecuente[] = [
  {
    id: 'publique-no-veo',
    pregunta: 'Publiqué y no veo el cambio',
    respuesta: 'Fíjate que estés mirando la misma página que editaste (arriba, el selector de página) y que hayas tocado «Publicar» — no alcanza con que el indicador diga «Guardado», eso sólo quiere decir que tu borrador se guardó. Si ya publicaste y sigues sin verlo, prueba recargar la página de tu tienda a mano: a veces el navegador muestra una versión que tenía guardada.',
    palabrasClave: ['publicar', 'no veo', 'cambio', 'cache'],
  },
  {
    id: 'cerre-sin-publicar',
    pregunta: 'Cerré sin publicar, ¿perdí todo?',
    respuesta: 'No. Todo lo que escribiste quedó guardado como borrador apenas dejaste de escribir, antes de que cerraras. La próxima vez que abras el editor tu borrador va a seguir ahí, esperando a que lo publiques o lo descartes.',
    palabrasClave: ['cerrar', 'perder', 'borrador'],
  },
  {
    id: 'sesion-cerrada',
    pregunta: 'Se me cerró la sesión mientras escribía',
    respuesta: 'El indicador de arriba va a decir «No se pudo guardar». El editor reintenta guardar solo cada pocos segundos; si el problema fue la sesión, vas a ver un enlace para volver a entrar. Inicia sesión de nuevo y vuelve al editor — lo último que alcanzaste a escribir sigue en el campo.',
    palabrasClave: ['sesion', 'guardar', 'error'],
  },
  {
    id: 'borre-sin-querer',
    pregunta: 'Borré algo sin querer',
    respuesta: 'Aprieta Ctrl/Cmd+Z enseguida — deshace el último paso, tanto si fue un texto como si fue quitar una zona del hero o eliminar una sección. Si ya eliminaste una sección agregada, la confirmación que te avisa antes de borrarla te lo recuerda: mientras no hayas publicado ese cambio, sigues a tiempo de deshacerlo.',
    palabrasClave: ['borrar', 'eliminar', 'deshacer', 'recuperar'],
  },
  {
    id: 'foto-cortada',
    pregunta: 'La foto se ve cortada',
    respuesta: 'En la portada del hero, usa «Punto focal» (junto a «Fondo») para elegir qué parte de la foto se mantiene siempre a la vista. En el resto de las secciones todavía no hay ese control — ahí conviene elegir una foto que ya se vea bien recortada al tamaño de esa sección.',
    palabrasClave: ['foto', 'imagen', 'cortada', 'recorte', 'punto focal'],
  },
  {
    id: 'nombre-tagline',
    pregunta: '¿Dónde cambio el nombre o el tagline de la tienda?',
    respuesta: 'Eso no se edita acá: es la identidad de tu negocio, y vive en Configuración, fuera de este editor. Lo que editas acá es el contenido de la tienda — textos, fotos, secciones.',
    palabrasClave: ['nombre', 'tagline', 'negocio', 'configuracion'],
  },
  {
    id: 'precios-productos',
    pregunta: '¿Dónde cambio precios y productos?',
    respuesta: 'Tampoco acá: los productos, sus precios y su stock se manejan en Productos, dentro del panel. Este editor es sólo para el contenido de las páginas — hero, secciones, estilo, encabezado y pie.',
    palabrasClave: ['precio', 'producto', 'stock'],
  },
  {
    id: 'no-veo-seccion',
    pregunta: '¿Por qué no veo una sección?',
    respuesta: 'Puede estar oculta: revisa el ojo de su fila en «Inicio» — si está tachado, préndelo ahí. Algunas secciones además se ocultan solas cuando no tienen contenido real que mostrar (por ejemplo, Testimonios se oculta hasta que cargues al menos uno).',
    palabrasClave: ['sección', 'oculta', 'no aparece', 'no se muestra'],
  },
  {
    id: 'volver-a-como-estaba',
    pregunta: '¿Cómo vuelvo a como estaba?',
    respuesta: 'Si todavía no publicaste el cambio, «Descartar todo» (dentro de «Publicar») te devuelve a lo último publicado. Si ya publicaste y te arrepentiste, el editor no guarda un historial de versiones anteriores — tienes que volver a editar el campo a mano con el valor de antes.',
    palabrasClave: ['volver', 'revertir', 'historial', 'version anterior'],
  },
];

export const ATAJOS_TECLADO: AtajoTeclado[] = [
  { id: 'deshacer', combinacion: 'Ctrl/Cmd + Z', accion: 'Deshacer el último cambio' },
  { id: 'rehacer', combinacion: 'Ctrl/Cmd + Shift + Z', accion: 'Rehacer lo que deshiciste' },
];

// EL MAPA nivel→guía se DERIVA de `GuiaAyuda.niveles` — nunca un segundo mapa a mano que pudiera
// divergir (§ el mismo criterio de `NIVELES_SECCIONES_GENERICAS`, arriba).
const NIVEL_A_TEMA: Record<string, TemaAyudaId> = GUIAS_AYUDA.reduce((acc, g) => {
  for (const nivel of g.niveles) acc[nivel] = g.id;
  return acc;
}, {} as Record<string, TemaAyudaId>);

/** A qué guía abre el «?» de un nivel dado. Un nivel que ninguna guía reclama (una sección
 *  AGREGADA, cuyo id es dinámico — nunca va a estar en `NIVELES_PANEL`) cae en la guía genérica
 *  «Secciones»: es la respuesta correcta para «estoy editando una sección y no sé qué hacer»,
 *  aunque esa sección puntual no tenga guía propia. */
export function temaDeNivel(nivel: string): TemaAyudaId {
  return NIVEL_A_TEMA[nivel] ?? 'secciones';
}

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export interface ResultadoBusquedaAyuda {
  guias: GuiaAyuda[];
  preguntas: PreguntaFrecuente[];
}

/** El buscador del centro de ayuda — substring, sin acentos, sobre título/resumen/palabras clave
 *  de las guías y pregunta/respuesta/palabras clave de las FAQ. Una consulta vacía no devuelve
 *  nada (preferir callar: el centro de ayuda ya muestra la lista completa cuando no hay búsqueda,
 *  así que un resultado vacío-pero-presente sería una segunda forma de decir lo mismo). */
export function buscarAyuda(
  query: string,
  guias: GuiaAyuda[] = GUIAS_AYUDA,
  preguntas: PreguntaFrecuente[] = PREGUNTAS_FRECUENTES,
): ResultadoBusquedaAyuda {
  const q = normalizar(query.trim());
  if (!q) return { guias: [], preguntas: [] };
  const matchGuia = (g: GuiaAyuda) =>
    normalizar(g.titulo).includes(q) || normalizar(g.resumen).includes(q) || g.palabrasClave.some((k) => normalizar(k).includes(q));
  const matchPregunta = (p: PreguntaFrecuente) =>
    normalizar(p.pregunta).includes(q) || normalizar(p.respuesta).includes(q) || (p.palabrasClave ?? []).some((k) => normalizar(k).includes(q));
  return { guias: guias.filter(matchGuia), preguntas: preguntas.filter(matchPregunta) };
}
