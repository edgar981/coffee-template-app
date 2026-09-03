// La opción "Transferencia bancaria" del checkout se DERIVA de la config del negocio
// (SiteSetting.banco*), no de un literal — antes había una cuenta HARDCODEADA falsa en la ruta del
// dinero. La lógica de "¿se muestra, y con qué texto?" vive acá (pura, capa 1) para poder afirmarla
// sin renderizar el checkout.

export interface OpcionTransferencia {
  banco: string;
  tipo: string;
  numero: string;
  titular: string | null;
  /** La línea que ve el cliente: "Bancolombia · Ahorros · 123-456 · Nayoli SAS". */
  desc: string;
}

/** Sólo los campos de cuenta que este helper necesita (subconjunto de SiteSettings). */
export interface CuentaBancaria {
  bancoNombre: string | null;
  bancoTipoCuenta: string | null;
  bancoNumeroCuenta: string | null;
  bancoTitular: string | null;
}

/**
 * La opción de transferencia para el checkout, o `null` si le faltan los ESENCIALES (banco, tipo,
 * número). "No a medias": con cualquiera de los tres vacío el método no se muestra —una instrucción
 * de pago incompleta es peor que un método menos—. El TITULAR es OPCIONAL: una transferencia se
 * ejecuta con banco+tipo+número (el número enruta la plata); el titular es una línea de confirmación
 * de a quién se le paga, así que se muestra si está y no bloquea si falta.
 */
export function opcionTransferencia(s: CuentaBancaria): OpcionTransferencia | null {
  const banco = (s.bancoNombre ?? '').trim();
  const tipo = (s.bancoTipoCuenta ?? '').trim();
  const numero = (s.bancoNumeroCuenta ?? '').trim();
  const titular = (s.bancoTitular ?? '').trim() || null;
  if (!banco || !tipo || !numero) return null;
  return { banco, tipo, numero, titular, desc: [banco, tipo, numero, titular].filter(Boolean).join(' · ') };
}
