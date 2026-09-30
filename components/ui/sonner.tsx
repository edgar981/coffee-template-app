"use client"

import { usePathname } from "next/navigation"
import { Toaster as Sonner } from "sonner"

// El Toaster GENÉRICO — TOAST-COMO-PROTOTIPO-1. Antes vivía en `app/layout.tsx` sirviendo a TODA
// la app (panel Y tienda); ahora sirve SÓLO admin y las páginas pre-auth (login, aceptar-
// invitación, recuperar-clave) — sin cambio de props: sigue siendo `richColors`/`top-center`, byte
// a byte lo que ya había.
//
// La TIENDA monta el suyo (`ToasterTienda`, `app/(storefront)/layout.tsx`), con su estilo por
// CORTE. Sonner es un store GLOBAL — dos `<Toaster>` sin `id` renderizan el MISMO aviso dos veces
// (medido contra la fuente del paquete: cada Toaster se suscribe al store y filtra por
// `toasterId`; sin `id`, el filtro es "no tiene toasterId", así que dos instancias sin `id`
// coinciden en TODOS los avisos reales, que no llevan `toasterId` porque los ~30 call sites de
// `toast.success/error(...)` no lo declaran) — así que ÉSTE, fuera de admin/pre-auth, no renderiza
// nada: el silencio es lo que evita el duplicado, no un `id` (etiquetar cada call site está fuera
// de alcance: ninguno de esos archivos está en `touches:` de este slice).
const RUTAS_ADMIN = ["/admin", "/login", "/aceptar-invitacion", "/recuperar-clave"] as const

/** ¿Esta ruta es admin/pre-auth? Todo lo que NO es esto es tienda. LÍMITE DECLARADO: es un
 *  allowlist de los 4 prefijos del grupo `(admin)` (`app/(admin)/{admin,login,aceptar-invitacion,
 *  recuperar-clave}`), no derivado del filesystem — un QUINTO top-level fuera de `/admin/*` que se
 *  agregara sin tocar esta lista se quedaría sin Toaster en esa página. Riesgo aceptado: el grupo
 *  admin crece casi siempre bajo `/admin/*` (ya cubierto por el prefijo), y las tres páginas
 *  pre-auth son estables. */
export function esRutaAdmin(pathname: string): boolean {
  return RUTAS_ADMIN.some((r) => pathname === r || pathname.startsWith(`${r}/`))
}

export function Toaster() {
  const pathname = usePathname()
  if (!esRutaAdmin(pathname)) return null
  return <Sonner richColors position="top-center" />
}