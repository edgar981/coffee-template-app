// LA CONFIGURACIÓN por sección del editor de la tienda. Datos PUROS (sin JSX, sin 'use client')
// para que el page server los importe y los pase como props al editor cliente. Lo que se
// PARAMETRIZA es exactamente esto —campos, imágenes, toggle de visibilidad, y la identidad de la
// sección (`seccion` + `titulo`)—; TODO lo demás (autoguardado, publicar/descartar, read↔edit,
// beforeunload, indicador, layout sticky) vive en la CÁSCARA (`TiendaSeccionEditor`). Si una
// sección nueva necesitara algo fuera de esta config, es señal de que la cáscara se está forzando.

export type SeccionVista = 'hero' | 'brandStory';

export type CampoTexto = { name: string; label: string; opcional?: boolean; textarea?: boolean; hint: string };
export type CampoImagen = { name: string; label: string };

export interface SeccionConfig {
  seccion: SeccionVista;
  titulo: string;
  campos: CampoTexto[];
  imagenes: CampoImagen[];
  /** Si la sección expone el toggle de visibilidad (§ REGISTRY.ocultable). El hero es false. */
  ocultable: boolean;
}

const HERO: SeccionConfig = {
  seccion: 'hero',
  titulo: 'Hero de la home',
  ocultable: false,
  imagenes: [{ name: 'imagen', label: 'Imagen de fondo' }],
  campos: [
    { name: 'eyebrow',            label: 'Línea superior',      opcional: true, hint: 'La línea en mayúsculas sobre el titular. Vacío: no se muestra.' },
    { name: 'titulo',             label: 'Titular',             hint: 'Vacío: se usa el texto por defecto.' },
    { name: 'tituloEnfasis',      label: 'Énfasis del titular', opcional: true, hint: 'La palabra en cursiva, en su propia línea bajo el titular. Vacío: no se muestra.' },
    { name: 'subtitulo',          label: 'Subtítulo', textarea: true, hint: 'Vacío: se usa el texto por defecto.' },
    { name: 'ctaPrimarioLabel',   label: 'Botón principal',     hint: 'Su destino es /tienda (fijo). Vacío: se usa el texto por defecto.' },
    { name: 'ctaSecundarioLabel', label: 'Botón secundario',    opcional: true, hint: 'Su destino es /suscripciones (fijo). Vacío: no se muestra.' },
  ],
};

const BRAND_STORY: SeccionConfig = {
  seccion: 'brandStory',
  titulo: 'Nuestra Historia',
  ocultable: true,
  // El collage 2×2 del storefront: imagen1 arriba-izq, imagen2 arriba-der, imagen3 abajo-izq,
  // imagen4 abajo-der. Las cuatro son requeridas (el collage es rígido; vacío → default).
  imagenes: [
    { name: 'imagen1', label: 'Imagen 1 · arriba izquierda' },
    { name: 'imagen2', label: 'Imagen 2 · arriba derecha' },
    { name: 'imagen3', label: 'Imagen 3 · abajo izquierda' },
    { name: 'imagen4', label: 'Imagen 4 · abajo derecha' },
  ],
  campos: [
    { name: 'eyebrow',  label: 'Línea superior', opcional: true, hint: 'La línea en mayúsculas sobre el título. Vacío: no se muestra.' },
    { name: 'titulo',   label: 'Título',         hint: 'Vacío: se usa el texto por defecto.' },
    { name: 'parrafo1', label: 'Primer párrafo', textarea: true, hint: 'Vacío: se usa el texto por defecto.' },
    { name: 'parrafo2', label: 'Segundo párrafo', opcional: true, textarea: true, hint: 'Vacío: no se muestra.' },
  ],
};

// El ORDEN es el orden en la pantalla (y en la home): primero el hero, después la historia.
export const SECCIONES_TIENDA: SeccionConfig[] = [HERO, BRAND_STORY];
