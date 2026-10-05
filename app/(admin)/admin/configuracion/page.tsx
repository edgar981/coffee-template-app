'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PARTE_DEFAULT, parteValida, type ParteConfiguracion } from '@/lib/admin/configuracion-partes';
import { ConfiguracionNav } from '@/components/admin/configuracion/ConfiguracionNav';
import IdentidadBloque from '@/components/admin/configuracion/IdentidadBloque';
import ContactoRedesBloque from '@/components/admin/configuracion/ContactoRedesBloque';
import CorreosBloque from '@/components/admin/configuracion/CorreosBloque';
import PagosCobrosBloque from '@/components/admin/configuracion/PagosCobrosBloque';
import EquipoSeccion from '@/components/admin/configuracion/EquipoSeccion';

// ─── ESTA ES LA PANTALLA DE CONFIGURACIÓN (§ PANEL-CONFIG-BLOQUES-1) ────────────────────────
//
// Dejó de ser un formulario que abre TODO a la vez (identidad + contacto + redes + correos +
// pagos + pasarela + equipo, detrás de un solo "Editar") y pasó a CINCO subsecciones —Negocio ·
// Contacto y redes · Correos · Pagos y cobros · Equipo—, elegidas por `?parte=` en la URL, cada
// una con su propio bloque y su propio Editar/Cancelar/Guardar. El porqué completo —el diagnóstico
// que lo motivó, qué quedó igual (el write sigue siendo el PATCH COMPLETO de SiteSetting), y qué NO
// se construyó ("Dónde estás": sin dato hoy)— vive en `docs/panel/REDISENO.md` § 2-3
// "Configuración" y en el asiento de este slice (`DECISIONS.md`).
//
// `?parte=` reemplaza al scroll de una sola página larga: un enlace profundo que antes caía en
// "la pantalla de Configuración" ahora cae en una subsección PRECISA — por default, `negocio`
// (la primera), que es donde vivía la identidad del negocio antes de este slice. Los enlaces
// existentes a `/admin/configuracion` (`NegocioMenu` "Datos del negocio", `UserMenu`/`MobileNav`
// "Configuración") no llevan `?parte=` y por eso siguen cayendo ahí — `NegocioMenu` ya lo decía en
// su comentario ("la pantalla ya abre ahí por defecto"), y sigue siendo cierto.
//
// La ruta se queda en `/admin/configuracion`; la subruta vieja `/configuracion/usuarios` redirige
// acá (§ `lib/redirect-config`) y cae en el mismo default.

function ConfiguracionContenido() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const parte        = parteValida(searchParams.get('parte'));

  const irA = (destino: ParteConfiguracion) => {
    if (destino === PARTE_DEFAULT) {
      router.push('/admin/configuracion');
    } else {
      router.push(`/admin/configuracion?parte=${destino}`);
    }
  };

  return (
    <div>
      <div style={{ minWidth: 0 }}>
        <h1 className="duna-display-m">Configuración</h1>
        <p className="duna-sub" style={{ marginTop: '3px', maxWidth: '42rem' }}>
          Cada parte se edita por su cuenta. Nada cambia hasta que guardas.
        </p>
      </div>

      <div className="admin-config-layout" style={{ marginTop: 'var(--duna-space-6)' }}>
        <ConfiguracionNav parteActiva={parte} onSeleccionar={irA} />
        <div>
          {parte === 'negocio'  && <IdentidadBloque />}
          {parte === 'contacto' && <ContactoRedesBloque />}
          {parte === 'correos'  && <CorreosBloque />}
          {parte === 'pagos'    && <PagosCobrosBloque />}
          {parte === 'equipo'   && <EquipoSeccion />}
        </div>
      </div>
    </div>
  );
}

// `useSearchParams()` exige `<Suspense>` — mismo patrón que Pedidos (`?pedido=`/`?f=`/`?hora=`).
export default function Configuracion() {
  return (
    <Suspense fallback={null}>
      <ConfiguracionContenido />
    </Suspense>
  );
}
