import { MessageCircle, Camera, Store, Users } from 'lucide-react';
import { CANALES } from '@/constants/customer';
import type { OrderChannel } from '@/types/order';

// ─── EL CANAL, COMO SUSURRO DE CONTEXTO ──────────────────────────────────────
//
// El design-system no conoce canales: `duna-chip-channel` recibe un nodo y el
// dominio vive acá. Vive en `components/admin/` y no dentro de una pantalla
// porque lo montan DOS (Pedidos y Clientes) y era exactamente la clase de mapa
// que este repo ya vio divergir — dos listas del mismo dominio se desincronizan
// en cuanto alguien renombra una.
//
// Las ETIQUETAS se consumen de `CANALES`, no se re-teclean: es la misma lista que
// usa el formulario de cliente. Acá sólo se declara lo que no existía: el ícono.
//
// Instagram va con `Camera` y no con su logo: lucide 1.x retiró los íconos de
// marca. Un SVG propio sería un valor inventado, y además el chip es contexto, no
// branding.
const ICONO_CANAL: Record<OrderChannel, typeof Store> = {
  whatsapp:  MessageCircle,
  instagram: Camera,
  directo:   Store,
  referido:  Users,
};

export function ChipCanal({ canal, soloIcono = false }: {
  canal?: OrderChannel | null;
  /**
   * Sólo el ícono, sin la palabra. Se usa donde el canal convive con una acción
   * del MISMO canal —el detalle del pedido, con su botón de WhatsApp al lado— y
   * repetir "WhatsApp" sería redundante. El ícono ya identifica el canal; el
   * nombre viaja en `title`/`aria-label` para el hover y el lector de pantalla.
   */
  soloIcono?: boolean;
}) {
  // Sin canal no hay chip. Un cliente creado antes del campo no tiene por qué
  // heredar un "Directo" que nadie declaró — preferir callar a afirmar.
  if (!canal) return null;
  // `?? directo` por si llega un canal fuera del union (el payload lo trae como
  // string): un chip sin ícono rompería la fila; el default no afirma nada falso
  // que el label no diga ya.
  const Icono = ICONO_CANAL[canal] ?? Store;
  const label = CANALES[canal] ?? canal;
  if (soloIcono) {
    // El nombre NO se pierde: va al `aria-label` (lector de pantalla) y al
    // `title` (hover). `.duna-chip-channel` no tiene padding ni fondo, así que
    // sin texto queda un ícono muted limpio, sin caja lopsided.
    return <span className="duna-chip-channel" title={label} aria-label={label}><Icono /></span>;
  }
  return <span className="duna-chip-channel"><Icono />{label}</span>;
}
