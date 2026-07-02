import { Automation } from '@/types/automation';
import { Bell, Package, CreditCard, BarChart2, UserX, CheckCircle, } from 'lucide-react';

export const AUTOMATION_TEMPLATES: Automation[] = [
  {
    id: 'template-1',
    tipo: 'nueva_orden',
    nombre: 'Notificación Nueva Orden',
    descripcion: 'Envía un mensaje automático al cliente cuando se confirma su orden.',
    icon: Bell, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    canal: 'whatsapp',
    condicion: 'Cuando una orden cambia a estado "confirmado"',
    activa: false,
    ultima_ejecucion: '2024-06-15T10:30:00Z',
    veces_ejecutada: 12,
    createdAt: '2024-06-01T12:00:00Z'
  },
  {
    id: 'template-2',
    tipo: 'stock_bajo',
    nombre: 'Alerta de Stock Bajo',
    descripcion: 'Notifica al equipo cuando un producto llega al stock mínimo.',
    icon: Package, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    canal: 'interno',
    condicion: 'Cuando el stock de un producto es menor al mínimo configurado',
    activa: false,
    ultima_ejecucion: '2024-06-10T14:45:00Z',
    veces_ejecutada: 5,
    createdAt: '2024-06-02T09:30:00Z'
  },
  {
    id: 'template-3',
    tipo: 'recordatorio_pago',
    nombre: 'Recordatorio de Pago',
    descripcion: 'Recuerda al cliente que tiene un pago pendiente después de 24 horas.',
    icon: CreditCard, color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    canal: 'whatsapp',
    condicion: 'Cuando han pasado 24h y el pago sigue pendiente',
    activa: false,
    ultima_ejecucion: '2024-06-15T10:30:00Z',
    veces_ejecutada: 8,
    createdAt: '2024-06-03T15:20:00Z'
  },
  {
    id: 'template-4',
    tipo: 'reporte_semanal',
    nombre: 'Reporte Semanal de Ventas',
    descripcion: 'Genera y envía un resumen de ventas cada lunes por la mañana.',
    icon: BarChart2, color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
    canal: 'email',
    condicion: 'Cada lunes a las 8:00 AM automáticamente',
    activa: false,
    ultima_ejecucion: '2024-06-17T08:00:00Z',
    veces_ejecutada: 4,
    createdAt: '2024-06-04T11:15:00Z'
  },
  {
    id: 'template-5',
    tipo: 'cliente_inactivo',
    nombre: 'Reactivación de Clientes',
    descripcion: 'Envía una promoción a clientes que no han comprado en 45 días.',
    icon: UserX, color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
    canal: 'whatsapp',
    condicion: 'Cuando un cliente no ha comprado en los últimos 45 días',
    activa: false,
    ultima_ejecucion: '2024-06-15T10:30:00Z',
    veces_ejecutada: 3,
    createdAt: '2024-06-05T13:50:00Z'
  },
  {
    id: 'template-6',
    tipo: 'orden_entregada',
    nombre: 'Confirmación de Entrega',
    descripcion: 'Agradece al cliente cuando su pedido ha sido entregado exitosamente.',
    icon: CheckCircle, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    canal: 'whatsapp',
    condicion: 'Cuando una entrega cambia a estado "entregado"',
    activa: false,
    ultima_ejecucion: '2024-06-15T10:30:00Z',
    veces_ejecutada: 15,
    createdAt: '2024-06-06T10:05:00Z'
  },
];