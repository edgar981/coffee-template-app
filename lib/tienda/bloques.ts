import type { SeccionConfig, CampoTexto, CampoImagen } from '@/components/admin/tienda-secciones';

// EL RESOLVEDOR de bloques del editor de la tienda (§ tienda-secciones · BloqueConfig). Traduce la
// declaración (`config.bloques`, campos por NOMBRE) al bloque RESUELTO (con los descriptores reales)
// que la cáscara renderiza. Es la RED DE SEGURIDAD de la migración a bloques: una sección SIN
// `bloques` cae a UN bloque `seccion` con TODAS sus imágenes y campos → renderiza EXACTAMENTE como
// antes (los dos loops imágenes/campos). Así migradas y no migradas conviven, y `grupo` se puede
// retirar sección por sección sin migrar las cinco de una.
//
// PURO (capa 1). No toca el resolver de SiteContent, el modelo (campos planos) ni #44 —esos leen su
// propio REGISTRY (§ site-content-defaults), no el descriptor—.

export type BloqueResuelto =
  | { tipo: 'seccion'; imagenes: CampoImagen[]; campos: CampoTexto[] };

/**
 * Los bloques RESUELTOS de una sección, en orden. Sin `bloques` declarados → un solo bloque `seccion`
 * con TODO (la red de seguridad). Con `bloques`, cada uno resuelve sus NOMBRES a los descriptores del
 * `config` (un nombre que no exista es un error de declaración, no un caso de runtime).
 */
export function bloquesResueltos(config: SeccionConfig): BloqueResuelto[] {
  if (!config.bloques) {
    return [{ tipo: 'seccion', imagenes: config.imagenes, campos: config.campos }];
  }
  const porImg = new Map(config.imagenes.map(i => [i.name, i]));
  const porCampo = new Map(config.campos.map(c => [c.name, c]));
  return config.bloques.map(b => ({
    tipo: 'seccion' as const,
    imagenes: (b.imagenes ?? []).map(n => porImg.get(n)!),
    campos: (b.campos ?? []).map(n => porCampo.get(n)!),
  }));
}
