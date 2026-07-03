import Link from 'next/link';
import { Users, Store, Shield, CreditCard, Bell, Puzzle, ChevronRight, LucideIcon } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConfigSection {
  icon:        LucideIcon;
  label:       string;
  description: string;
  path:        string;
  color:       string;
  badge:       string | null;
  available:   boolean;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const sections: ConfigSection[] = [
  {
    icon:        Users,
    label:       'Equipo y usuarios',
    description: 'Invita colaboradores, gestiona roles y accesos al panel.',
    path:        '/admin/configuracion/usuarios',
    color:       'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    badge:       null,
    available:   true,
  },
  {
    icon:        Store,
    label:       'Restaurante',
    description: 'Nombre, ubicación, horarios y datos del negocio.',
    path:        '/admin/configuracion/restaurante',
    color:       'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
    badge:       'Próximamente',
    available:   false,
  },
  {
    icon:        Shield,
    label:       'Roles y permisos',
    description: 'Define qué puede hacer cada rol dentro del sistema.',
    path:        '/admin/configuracion/roles',
    color:       'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400',
    badge:       'Próximamente',
    available:   false,
  },
  {
    icon:        CreditCard,
    label:       'Plan y facturación',
    description: 'Administra tu suscripción, facturas y métodos de pago.',
    path:        '/admin/configuracion/facturacion',
    color:       'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400',
    badge:       'Próximamente',
    available:   false,
  },
  {
    icon:        Bell,
    label:       'Notificaciones',
    description: 'Configura alertas de órdenes, inventario bajo y más.',
    path:        '/admin/configuracion/notificaciones',
    color:       'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
    badge:       'Próximamente',
    available:   false,
  },
  {
    icon:        Puzzle,
    label:       'Integraciones',
    description: 'Conecta herramientas externas: pagos, delivery, CRM.',
    path:        '/admin/configuracion/integraciones',
    color:       'bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400',
    badge:       'Próximamente',
    available:   false,
  },
];

// ─── Card ─────────────────────────────────────────────────────────────────────

function SectionCard({ icon: Icon, label, description, color, badge, available }: Omit<ConfigSection, 'path'>) {
  return (
    <div className={`group bg-card border border-border rounded-2xl p-5 shadow-sm transition-all duration-200 ${
      available
        ? 'hover:shadow-md hover:-translate-y-0.5 cursor-pointer'
        : 'opacity-70 cursor-default'
    }`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        {badge ? (
          <span className="text-[10px] font-semibold bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
            {badge}
          </span>
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
        )}
      </div>
      <h3 className="font-semibold text-sm text-foreground mb-1">{label}</h3>
      <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Configuracion() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configuración</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Personaliza y administra tu plataforma Café Nayoli
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sections.map(section => (
          section.available ? (
            <Link key={section.path} href={section.path}>
              <SectionCard {...section} />
            </Link>
          ) : (
            <div key={section.path}>
              <SectionCard {...section} />
            </div>
          )
        ))}
      </div>
    </div>
  );
}