import {
  Space_Grotesk, Instrument_Sans, JetBrains_Mono,
  Hanken_Grotesk, Spline_Sans_Mono,
} from "next/font/google";

// Admin (Duna) typography — self-hosted via next/font y scopeada al layout del
// grupo admin (el wrapper `.admin-shell`). El storefront conserva su
// Inter/Playfair; estas fuentes no se cargan nunca en rutas de storefront.
//
// ── DOS JUEGOS A LA VEZ, y es una convivencia DECLARADA ──────────────────────
//
// El chrome actual del panel (sidebar, topbar, las pantallas shadcn) usa
// Instrument Sans + JetBrains Mono. El design-system pide Hanken Grotesk +
// Spline Sans Mono (y Space Grotesk, que ya estaba y la comparten los dos). Las
// cinco cargan mientras el panel viejo y la pantalla nueva conviven — el mismo
// costo temporal que los modales shadcn de /admin/pedidos, con el mismo
// disparador: cuando el chrome migre al design-system, Instrument Sans y
// JetBrains Mono salen de acá.
//
// POR QUÉ HAY QUE DECLARARLAS AUNQUE `tokens.css` YA NOMBRE LAS FAMILIAS:
// `next/font` NO registra el nombre literal de la familia — genera uno propio
// (`__Hanken_Grotesk_ab12cd`) y lo expone en la variable CSS. O sea que un
// `font-family: 'Hanken Grotesk'` NO resuelve aunque la fuente esté cargada. El
// sistema declara el ROL y el consumidor apunta el rol a su variable; el puente
// vive en `app/(admin)/duna.css`.
//   · Space Grotesk    → display / cifras  (chrome viejo: headings)
//   · Hanken Grotesk   → UI del design-system
//   · Spline Sans Mono → datos/IDs del design-system
//   · Instrument Sans  → body/UI del chrome viejo
//   · JetBrains Mono   → el wordmark "Duna"
export const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-space-grotesk",
});

export const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-instrument-sans",
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains-mono",
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
