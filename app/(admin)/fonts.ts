import {
  Space_Grotesk, Hanken_Grotesk, Spline_Sans_Mono,
} from "next/font/google";

// Admin (Duna) typography — self-hosted via next/font y scopeada al grupo admin.
// El storefront conserva su Inter/Playfair; estas fuentes no se cargan nunca en
// rutas de storefront (promesa que sostiene el commit del script inline, no el
// layout raíz — § duna.css).
//
// SON TRES, LAS DEL DESIGN-SYSTEM. Instrument Sans y JetBrains Mono SALIERON
// cuando el chrome migró su tipografía a los roles del DS —era el disparador
// escrito acá desde el principio—: el body del panel pasó a Hanken, y el wordmark
// "DUNA", único consumidor de JetBrains, pasó a Spline Sans Mono (mono por mono,
// la del sistema). Ya no hay dos juegos conviviendo.
//
// POR QUÉ HAY QUE DECLARARLAS AUNQUE `tokens.css` YA NOMBRE LAS FAMILIAS:
// `next/font` NO registra el nombre literal de la familia — genera uno propio
// (`__Hanken_Grotesk_ab12cd`) y lo expone en la variable CSS. O sea que un
// `font-family: 'Hanken Grotesk'` NO resuelve aunque la fuente esté cargada. El
// sistema declara el ROL y el consumidor apunta el rol a su variable; el puente
// vive en `app/(admin)/duna.css`.
//   · Space Grotesk    → display / cifras (`--duna-font-display`)
//   · Hanken Grotesk   → UI / body        (`--duna-font-ui`)
//   · Spline Sans Mono → datos, IDs, wordmark (`--duna-font-mono`)
export const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-space-grotesk",
});

// ── Las dos del design-system ────────────────────────────────────────────────
export const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-hanken-grotesk",
});

export const splineSansMono = Spline_Sans_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-spline-sans-mono",
});
