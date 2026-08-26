import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSiteContent } from "@/lib/config/site-content";
import NosotrosHistoria from "@/components/storefront/nosotros/NosotrosHistoria";

// Sólo "Nosotros": la raíz aplica el template `%s · Café Nayoli` (app/layout.tsx).
export const metadata: Metadata = { title: "Nosotros" };

// La página /nosotros. Es una CAPACIDAD que se puede apagar (`paginas.nosotros.visible`): apagada,
// REDIRIGE a la home en vez de dar 404 —la página EXISTE, sólo está apagada; un 404 diría que no
// existe—. Redirect TEMPORAL (puede volver a encenderse): el `redirect()` de Next emite 307, que
// para navegar a una página GET es equivalente al 302 pedido (el destino se pide igual con GET); un
// 302 literal exigiría middleware, sin ganancia funcional. El flag lo lee el layout server (cache
// por request), así que esta segunda lectura no cuesta una query extra.
export default async function NosotrosPage() {
  const content = await getSiteContent();
  if (!content.paginas.nosotros.visible) redirect("/");

  // El provider de SiteContent lo monta el layout del storefront → NosotrosHistoria lee el contenido.
  return <NosotrosHistoria />;
}
