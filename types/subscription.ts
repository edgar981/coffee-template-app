export interface Subscription {
  id: string;
  nombre: string;
  precio: number;
  descripcion: string;
  beneficios: string[];
  
  theme: "essential" | "premium" | "barista";
  
  popular?: boolean;
}