import { getSiteSettings } from "@/lib/config/site-settings";
import RecuperarClaveForm from "./RecuperarClaveForm";

// Shell SERVER: lee el nombre del negocio de SiteSetting y lo pasa al formulario.
// Es la tercera pantalla de la PUERTA (login · aceptar-invitación · recuperar-clave),
// las tres sobre el mismo `PreAuthShell` para que se vean iguales.
export default async function RecuperarClavePage() {
  const { nombre } = await getSiteSettings();
  return <RecuperarClaveForm nombre={nombre} />;
}
