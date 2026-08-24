import { getSiteSettings } from "@/lib/config/site-settings";
import LoginForm from "./LoginForm";

// Shell SERVER: lee el nombre del negocio de SiteSetting (una fila indexada, sólo
// al cargar /login) y lo pasa al formulario cliente. Server-side y no en el gate
// porque esta pantalla vive ANTES del gate; y no un provider de grupo porque eso
// consultaría la base en cada request anónimo de /login (§ decisión del owner).
export default async function LoginPage() {
  const { nombre } = await getSiteSettings();
  return <LoginForm nombre={nombre} />;
}
