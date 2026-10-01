// El MARK del storefront (la flor, en `Logo.tsx`) es OPT-IN POR DESPLIEGUE (§ Tanda C2 · #2, y § El
// WORDMARK carga la identidad; el MARK es asset por-despliegue). El DEFAULT es WORDMARK-SOLO: un
// despliegue nuevo muestra sólo el nombre del negocio —NUNCA la flor de Nayoli ni ninguna ajena—.
//
// La identidad PORTABLE es el wordmark (`nombre`, de SiteSetting). El mark es un ASSET por-despliegue,
// como el favicon: Nayoli tiene el suyo (la flor) y lo ACTIVA con `NEXT_PUBLIC_STOREFRONT_MARK=1` en su
// despliegue; un segundo cliente con mark propio reemplaza el SVG inline de `Logo.tsx` (el PUNTO DE
// SWAP documentado) y activa el flag; y quien no tiene mark propio deja el flag sin poner → wordmark-solo.
//
// POR QUÉ ENV Y NO UN LITERAL EN EL CÓDIGO (§ El código compartido no NACE siendo Nayoli/demo): lo
// por-despliegue es DATO (SiteSetting) o ENV, nunca un literal de Nayoli en el código COMPARTIDO —un
// `const TIENE_MARK = true` haría que un fork mostrara la flor de Nayoli sin pedirlo—. Mismo patrón que
// `NOINDEX=1` (§ next.config.ts): default seguro (neutro), y el despliegue de Nayoli/demo opta.
//
// ESTO DESCRIBÍA UNA PREMISA QUE YA NO ES CIERTA, Y SE DEJA ESCRITO PARA QUE NO VUELVA A CONFUNDIR
// (§ MARCA-LOGO-IMAGEN-1): decía "NO hay campo logoUrl en SiteSetting: sin subida de logo, sería
// una mina inerte" — HOY SÍ EXISTE esa capacidad, pero NO en SiteSetting: vive en
// `SiteContent.content.logo` (§ `LogoContent`, `site-content-defaults.ts`), con su propio flujo
// borrador/publicar (`EncabezadoSeccion.tsx`, `/api/site-content/encabezado`), DOS versiones
// (oscura/clara) y su alt. El MARK de acá abajo (la flor) sigue siendo OTRA cosa, sin cambio: un
// asset por-despliegue, fijo en código, que NUNCA convive con un logo subido — `Logo.tsx` muestra
// el logo subido ENTERO en vez del mark+wordmark cuando hay al menos una versión subida (§ el
// docstring de `Logo`). `STOREFRONT_TIENE_MARK` se queda exactamente como estaba: decide si el
// fallback de texto (sin logo subido) lleva la flor o es wordmark-solo.
//
// `NEXT_PUBLIC_` porque el mark se renderiza en componentes CLIENTE (StoreNav/StoreFooter): Next inlinea
// la var en el bundle del cliente en BUILD. Constante de despliegue (igual en cada render), no dato.

export const STOREFRONT_TIENE_MARK = process.env.NEXT_PUBLIC_STOREFRONT_MARK === '1';
