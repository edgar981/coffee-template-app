// Plan de suscripción como PROPUESTA (no transaccional). Basado en cantidad y
// frecuencia del ÚNICO café de la finca — sin precio ni descuento (pendientes
// de definir con el cliente).
export interface Subscription {
  id: string;
  nombre: string;
  /** Cantidad y frecuencia, p. ej. "Una bolsa de 250 g cada mes" */
  descripcion: string;
  beneficios: string[];
  popular?: boolean;
}
