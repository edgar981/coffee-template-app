// Los colores de CHROME/PWA del storefront —el `theme-color` del navegador (barra de direcciones) y el
// `background_color`/`theme_color` del manifest— DERIVAN de la paleta del cliente (`content.tema`), en
// vez de ser literales de Nayoli (§ Tanda C2 · #1, los 3 literales adyacentes a los íconos). Así un
// segundo cliente viste su navegador y su PWA con SU color, no el cremita de Nayoli.
//
// NULL (Nayoli/fábrica) → los literales EXACTOS de hoy, no el fondo/tinta del motor: son near-dups de la
// paleta (§ globals.css: #f9f6f4/#1e150e colapsaron a fondo/tinta con ≤6u) y se mantienen EXACTOS para
// que Nayoli quede BYTE-IDÉNTICO en su chrome/PWA —igual criterio que la paleta (null → los `--sf-*` de
// código, no una aproximación del motor)—. CUSTOM → el fondo/tinta del cliente.
//
//   fondo → `chrome`  : el theme-color del navegador + el background_color del manifest (el splash).
//   tinta → `pwaTheme`: el theme_color del manifest (la barra en modo standalone de la PWA).
//
// PURO (capa 1). Los íconos en sí (favicon, apple, PNG del manifest) NO se derivan —son assets
// por-despliegue, § el punto de swap en next.config.ts; su generación por paleta es #54—.

// Los literales EXACTOS de hoy (el chrome/PWA de Nayoli). Near-dups de RAICES_DEFECTO fondo/tinta.
const NAYOLI_CHROME = '#F9F6F4';   // = el themeColor de la raíz + el background_color del manifest de hoy
const NAYOLI_PWA_TEMA = '#1E150E'; // = el theme_color del manifest de hoy

export function coloresPWA(fondo: string | null, tinta: string | null): { chrome: string; pwaTheme: string } {
  return {
    chrome:   fondo ?? NAYOLI_CHROME,
    pwaTheme: tinta ?? NAYOLI_PWA_TEMA,
  };
}
