import { Space_Grotesk, Instrument_Sans, JetBrains_Mono } from "next/font/google";

// Admin (Duna) typography — self-hosted via next/font and scoped to the admin
// route group's layout (the `.admin-shell` wrapper). The storefront keeps its
// own Inter/Playfair; these fonts never load on storefront routes.
//   · Space Grotesk  → headings
//   · Instrument Sans → body / UI
//   · JetBrains Mono  → the "Duna" wordmark
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
