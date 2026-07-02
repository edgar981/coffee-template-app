import { CustomerForm } from "@/types/customer";
import { OrderChannel } from "@/types/order";

export const CANALES: Record<OrderChannel, string> = {
  whatsapp:  'WhatsApp',
  instagram: 'Instagram',
  directo:   'Directo',
  referido:  'Referido',
};

export const EMPTY_CUSTOMER_FORM: CustomerForm = {
  nombre:    '',
  email:     '',
  telefono:  '',
  ciudad:    '',
  direccion: '',
  canal:     'directo',
  notas:     '',
  activo:   true,
};