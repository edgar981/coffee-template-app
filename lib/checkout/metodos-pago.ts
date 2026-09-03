import { formatWhatsappDisplay } from '../config/site';
import { opcionTransferencia } from './transferencia';

// Los MÉTODOS de pago del checkout son FIJOS (nequi, daviplata, transferencia, efectivo) — no un
// motor de métodos arbitrarios (§ backlog: Wompi/pasarelas). El dueño ENCIENDE/APAGA cada uno y edita
// sus datos desde Configuración. La regla "¿se muestra?" y el estado del editor viven ACÁ (puro, capa
// 1): un método aparece en la tienda si está ON *y* tiene sus datos completos. Encender/apagar es UI
// del checkout — NO toca el eje de Pagos: el método se guarda como string libre en la orden y
// `derivarCondicionPago` sólo distingue EFECTIVO; apagar un método no huerfaniza órdenes viejas.

export type MetodoPagoId = 'nequi' | 'daviplata' | 'transferencia' | 'efectivo';

/** Los campos de SiteSetting (o del form del editor) que la lógica de métodos necesita. Acepta
 *  `string | null` (settings) y `string` (form) — un `string` es asignable a `string | null`. */
export interface SettingsMetodos {
  bancoNombre: string | null;
  bancoTipoCuenta: string | null;
  bancoNumeroCuenta: string | null;
  bancoTitular: string | null;
  pagoNequiActivo: boolean;
  pagoDaviplataActivo: boolean;
  pagoTransferenciaActivo: boolean;
  pagoEfectivoActivo: boolean;
  pagoMovilNumero: string | null;
}

export interface MetodoCheckout {
  id: MetodoPagoId;
  label: string;
  /** La línea que ve el cliente ("Enviar a 315 …", "Bancolombia · Ahorros · …"). */
  desc: string;
}

/** Número de pago móvil (Nequi/Daviplata) formateado para mostrar ("315 576 6064"), o '' si no hay. */
function movilDisplay(s: SettingsMetodos): string {
  const n = (s.pagoMovilNumero ?? '').trim();
  return n ? formatWhatsappDisplay(n).replace(/^\+57\s*/, '') : '';
}

/**
 * Los métodos que el checkout MUESTRA, en orden. Un método aparece si está ENCENDIDO *y* tiene sus
 * datos: nequi/daviplata → número móvil; transferencia → cuenta completa (§ opcionTransferencia);
 * efectivo → nada que configurar, pero sólo en Bogotá (`isBogota`, regla de envío, no de config).
 * Puede devolver VACÍO (todos apagados o sin datos) — el checkout lo maneja con su guarda defensiva.
 */
export function metodosDisponibles(s: SettingsMetodos, opts: { isBogota: boolean }): MetodoCheckout[] {
  const out: MetodoCheckout[] = [];
  const movil = movilDisplay(s);
  if (s.pagoNequiActivo && movil) out.push({ id: 'nequi', label: 'Nequi', desc: `Enviar a ${movil}` });
  if (s.pagoDaviplataActivo && movil) out.push({ id: 'daviplata', label: 'Daviplata', desc: `Enviar a ${movil}` });
  const transf = opcionTransferencia(s);
  if (s.pagoTransferenciaActivo && transf) out.push({ id: 'transferencia', label: 'Transferencia Bancaria', desc: transf.desc });
  if (s.pagoEfectivoActivo && opts.isBogota) out.push({ id: 'efectivo', label: 'Contra entrega', desc: 'Solo disponible en Bogotá D.C.' });
  return out;
}

export type EstadoMetodoEditor = 'apagado' | 'activo_sin_datos' | 'activo';

/**
 * El estado de un método PARA EL EDITOR. `activo_sin_datos` es el caso que el editor debe HACER
 * VISIBLE ("encendido — falta configurarlo"): pasa en cualquier despliegue nuevo (los booleanos nacen
 * en true y aún no hay datos), y sin el aviso el método simplemente no aparece en la tienda sin
 * explicación. Efectivo no tiene datos que configurar → nunca `activo_sin_datos`.
 */
export function estadoMetodoEditor(s: SettingsMetodos, id: MetodoPagoId): EstadoMetodoEditor {
  const activo = { nequi: s.pagoNequiActivo, daviplata: s.pagoDaviplataActivo, transferencia: s.pagoTransferenciaActivo, efectivo: s.pagoEfectivoActivo }[id];
  if (!activo) return 'apagado';
  const tieneDatos =
    id === 'efectivo' ? true :
    id === 'transferencia' ? opcionTransferencia(s) !== null :
    (s.pagoMovilNumero ?? '').trim() !== ''; // nequi / daviplata
  return tieneDatos ? 'activo' : 'activo_sin_datos';
}
