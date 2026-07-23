import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: { default: "Café Nayoli", template: "%s · Café Nayoli" },
  description:
    "Café de especialidad 100% colombiano, de la Finca Nayoli en Supatá.",
};

// La política de tema NO vive aquí: cada grupo de rutas monta su propio
// ThemeProvider (storefront light-only, admin con dark). Ver CLAUDE.md.
export const viewport: Viewport = {
  themeColor: "#F9F6F4",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}