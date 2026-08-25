import { Suspense } from "react";
import { getSiteSettings } from "@/lib/config/site-settings";
import AceptarInvitacionForm from "./AceptarInvitacionForm";

// Shell SERVER: lee el nombre del negocio de SiteSetting y lo pasa al formulario.
// La frontera de Suspense la exige `useSearchParams()` (el form lee ?token=): el
// bailout de CSR de Next necesita que ese componente viva dentro del boundary.
export default async function AceptarInvitacionPage() {
  const { nombre } = await getSiteSettings();
  return (
    <Suspense fallback={null}>
      <AceptarInvitacionForm nombre={nombre} />
    </Suspense>
  );
}
