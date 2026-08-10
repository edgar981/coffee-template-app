// Shipping methods shaped like future DB rows. The client delivers personally
// within Bogotá by time slot; national orders ship via carrier.
//
// TODO: prices are placeholders pending client's real rates; migrate to a
// ShippingMethod table + admin UI in a later phase.

export type ShippingMethodId = 'bogota' | 'nacional';

export interface ShippingSlot {
  id: string;
  label: string;
}

export interface ShippingMethod {
  id: ShippingMethodId;
  label: string;
  price: number;
  description: string;
  slots: ShippingSlot[] | null;
}

export const SHIPPING_METHODS: ShippingMethod[] = [
  {
    id: 'bogota',
    label: 'Entrega en Bogotá',
    price: 8000,
    description: 'Coordinamos la entrega contigo por WhatsApp (1–2 días hábiles)',
    slots: [
      { id: 'am', label: 'Mañana (8:00 – 12:00)' },
      { id: 'pm', label: 'Tarde (2:00 – 6:00)' },
    ],
  },
  {
    id: 'nacional',
    label: 'Envío nacional (resto del país)',
    price: 18000,
    description: '3–5 días hábiles',
    slots: null,
  },
];

// TODO: threshold is a placeholder default; client confirms final value;
// migrates to DB with the ShippingMethod table later. `null` disables free
// shipping entirely.
export const freeShippingThreshold: number | null = 150000;

export function getShippingMethod(id: string): ShippingMethod | undefined {
  return SHIPPING_METHODS.find((m) => m.id === id);
}

// Validate a slot id against a specific method (used server-side to reject a
// Bogotá order whose franja isn't one of that method's real slots).
export function getShippingSlot(
  methodId: string,
  slotId: string | null | undefined,
): ShippingSlot | undefined {
  const method = getShippingMethod(methodId);
  if (!method?.slots || !slotId) return undefined;
  return method.slots.find((s) => s.id === slotId);
}

// id → label lookup for a persisted slot id, without needing the method in
// hand. We persist only the slot id (e.g. "am") on the Order and resolve the
// human label here at render time, so relabeling a slot never rewrites history.
export function findSlotLabel(slotId: string | null | undefined): string | undefined {
  if (!slotId) return undefined;
  for (const method of SHIPPING_METHODS) {
    const slot = method.slots?.find((s) => s.id === slotId);
    if (slot) return slot.label;
  }
  return undefined;
}

// Single source of truth for the shipping price, read by BOTH the client
// summary and the server-side recompute so neither can disagree about the
// free-shipping threshold.
export function computeShippingCost(methodId: string, subtotal: number): number {
  const method = getShippingMethod(methodId);
  if (!method) return 0;
  if (freeShippingThreshold !== null && subtotal >= freeShippingThreshold) return 0;
  return method.price;
}
