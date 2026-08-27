import { Suspense } from "react";
import { getSiteSettings } from "@/lib/config/site-settings";
import NuevaClaveForm from "./NuevaClaveForm";

// Shell SERVER + frontera de Suspense (el form lee `?token=`/`?error=` con
// `useSearchParams`, que la exige, igual que aceptar-invitación). Es el destino al
// que Better Auth redirige DESPUÉS de validar el token del enlace del correo.
export default async function NuevaClavePage() {
  const { nombre } = await getSiteSettings();
  return (
    <Suspense fallback={null}>
      <NuevaClaveForm nombre={nombre} />
    </Suspense>
  );
}
