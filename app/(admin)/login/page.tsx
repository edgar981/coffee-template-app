import { Suspense } from "react";
import { getSiteSettings } from "@/lib/config/site-settings";
import LoginForm from "./LoginForm";

// Shell SERVER: lee el nombre del negocio de SiteSetting (una fila indexada, sólo
// al cargar /login) y lo pasa al formulario cliente. Server-side y no en el gate
// porque esta pantalla vive ANTES del gate; y no un provider de grupo porque eso
// consultaría la base en cada request anónimo de /login (§ decisión del owner).
//
// La frontera de Suspense la exige `useSearchParams()` (el form lee `?motivo=`, el
// aviso con el que el gate rebota a quien no tiene acceso al panel).
export default async function LoginPage() {
  const { nombre } = await getSiteSettings();
  return (
    <Suspense fallback={null}>
      <LoginForm nombre={nombre} />
    </Suspense>
  );
}
