import { redirect } from "next/navigation";

import { pasarelaDisponibleEnEsteDespliegue } from "@/services/checkout.service";
import { getSiteSettings } from "@/lib/config/site-settings";

import RetornoCliente from "./RetornoCliente";

// LA PUERTA DEL SERVER — WOMPI-RETORNO-307-Y-TECHO-1 (gap 1 del gate del owner sobre (c),
// WOMPI-RUTA-DE-RETORNO-1). Antes esta ruta era enteramente cliente (`useSearchParams`), sin
// chequeo server-side: un tenant SIN la pasarela encendida podía entrar a `/checkout/retorno`
// y ver el formulario de "Confirma tu pago" — una pantalla viva para una capacidad que ese
// despliegue no tiene.
//
// Ahora `page.tsx` es SERVER y decide ANTES de renderizar: sin la pasarela, la ruta NO EXISTE
// para ese tenant — `redirect('/checkout')`. `redirect()` de Next emite 307 (verificado: es su
// comportamiento por defecto, el mismo que ya documenta `nosotros/page.tsx` para su propio
// apagado por config), NUNCA 308 ni un 404: la pasarela es un TOGGLE DE DESPLIEGUE
// (`pasarelaDisponibleEnEsteDespliegue`, § `services/checkout.service.ts`) que puede
// encenderse mañana sin volver a desplegar código, así que el redirect tiene que seguir
// siendo TEMPORAL — un 308 o un 404 mentirían sobre eso.
export default async function CheckoutRetornoPage() {
  if (!pasarelaDisponibleEnEsteDespliegue()) {
    redirect("/checkout");
  }

  // ¿HAY CANAL DE WHATSAPP? Mismo patrón y misma razón que `checkout/page.tsx`
  // (`settings.whatsapp.trim() !== ''`): `SiteSetting.whatsapp` puede estar vacío (la
  // migración neutral siembra `''`), y esta pantalla no debe ofrecer un CTA hacia un canal
  // que el tenant no configuró. Se lee acá, server-side, y se baja como SEÑAL (booleana) al
  // componente cliente — que es quien decide, con esa señal, si pinta el CTA de la vista
  // `techo` (§2, WOMPI-RETORNO-307-Y-TECHO-1).
  const settings = await getSiteSettings();
  const tieneWhatsapp = settings.whatsapp.trim() !== "";

  return <RetornoCliente tieneWhatsapp={tieneWhatsapp} />;
}
