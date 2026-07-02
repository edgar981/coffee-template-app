import { LucideIcon } from 'lucide-react';

export interface Automation {
    id: string;
    tipo: string;
    nombre: string;
    descripcion: string;
    icon: LucideIcon;
    color: string;
    canal: string;
    condicion: string;
    activa: boolean;
    ultima_ejecucion?: string;
    veces_ejecutada: number;
    createdAt: string;
  }