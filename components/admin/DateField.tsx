"use client";
import { useState } from 'react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useContenedorDunaPortal } from '@/components/admin/dunaPortal';
import { dayKeyToDate, dateToDayKey } from '@/lib/day-key';
import { formatFecha } from '@duna/core/format-fecha';

// ═══ EL CAMPO DE FECHA · el MISMO calendario que el rango de Pedidos ════════
//
// Antes era un `<input type="date">` nativo, y esa era la incoherencia: el panel
// YA TENÍA un date picker Duna —el "Rango de fechas" de Pedidos— así que el
// operador veía DOS formas distintas para la misma tarea en la misma sesión. No
// es nativo-contra-custom en abstracto: son dos superficies visibles compitiendo.
//
// Es la diferencia con el `<select>`, que SÍ se queda nativo: su lista aparece un
// segundo, no compite con ninguna otra lista del panel, y la rueda del sistema en
// un teléfono es una ventaja real. Acá el costo se acepta al revés —se pierde el
// selector nativo de fecha en móvil— porque la coherencia pesa más cuando hay dos
// formas a la vista.
//
// ── ES EL MISMO `Calendar`, PERO NO ES UNA COPIA ────────────────────────────
//
// Comparte componente con `DateRangePicker` (shadcn sobre react-day-picker), y
// ahí se acaba el parecido. Cuatro cosas cambian, y ninguna es cosmética:
//
// 1. **EL TIEMPO VA AL REVÉS.** El rango filtra registros PASADOS y por eso
//    prohíbe el futuro (`disabled={{ after: today }}`) y capa la navegación
//    hacia adelante. Una fecha de entrega es un COMPROMISO futuro. Copiar esos
//    límites habría hecho imposible programar para mañana.
// 2. **NO SE AGREGAN LÍMITES QUE NO HABÍA.** El `<input type="date">` que esto
//    reemplaza no tenía `min` ni `max`, así que una fecha pasada era posible —y
//    lo sigue siendo—. Registrar una entrega que ya ocurrió es un caso legítimo,
//    y una migración de FORMA no es el sitio para estrenar una regla de negocio.
// 3. **UN SOLO MES.** El rango muestra dos porque un rango se elige entre meses;
//    acá es una fecha, y dos meses no caben en un drawer de 375px.
// 4. **EL DISPARADOR ES UN CAMPO, NO UN CHIP.** El del rango es un botón de
//    filtro. Éste vive dentro de un formulario, bajo su `duna-field__label`, así
//    que se ve como los demás campos: `duna-input` con la fecha adentro.
//
// ── EL POPOVER PORTALEA AL PUENTE ──────────────────────────────────────────
//
// Como el sheet y el diálogo. Sin `container` iría a `<body>`, fuera de
// `.admin-shell`, y el calendario abriría con la fuente del sistema sobre una
// superficie Duna. Es la tercera vez que este límite muerde; por eso el
// contenedor vive en un solo sitio (`dunaPortal`).

export function DateField({ value, onChange, id, ariaLabel, placeholder = 'Elegir fecha' }: {
  /** Clave de día `YYYY-MM-DD`, o `''`. El MISMO formato que emitía el input
   *  nativo, así que el consumidor no cambia su estado ni su envío. */
  value: string;
  onChange: (dayKey: string) => void;
  id?: string;
  /** Para cuando el campo no tiene un `<label>` asociado por `id`. */
  ariaLabel?: string;
  placeholder?: string;
}) {
  const contenedor = useContenedorDunaPortal();
  const [abierto, setAbierto] = useState(false);
  const elegido = value ? dayKeyToDate(value) : undefined;

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        {/* `duna-input` para que mida y se vea EXACTAMENTE como los campos de al
            lado: es un campo, no un botón que abre algo. `text-align: left`
            porque un `<button>` centra por defecto y un campo no. */}
        <button
          type="button"
          id={id}
          aria-label={ariaLabel}
          className="duna-input"
          style={{ textAlign: 'left', cursor: 'pointer' }}
        >
          {/* Sin fecha, el texto va en el tono de un placeholder — la misma
              distinción que hace la opción vacía de un select: el campo tiene que
              poder decir "todavía no elegiste" sin parecer que ya tiene valor. */}
          {/* Se formatea la CADENA, no el `Date`. `formatFecha` ancla las fechas
              `YYYY-MM-DD` en UTC justamente porque son de reloj de pared sin
              hora; pasarle un `Date` lo manda por el formateador de Bogotá, y
              este `Date` es de medianoche LOCAL — en una máquina fuera de UTC-5
              imprimiría el día ANTERIOR. El propio comentario de esa función
              explica el desfase; acá basta con no provocarlo. */}
          <span style={value ? undefined : { color: 'var(--duna-muted)' }}>
            {value ? formatFecha(value) : placeholder}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start" container={contenedor}>
        <Calendar
          mode="single"
          selected={elegido}
          defaultMonth={elegido}
          onSelect={(d) => {
            // `undefined` llega al re-tocar el día ya elegido (react-day-picker
            // lo trata como deseleccionar). Se propaga como `''` para que el
            // consumidor pueda VACIAR la fecha — que es justo lo que el input
            // nativo permitía y perder eso sería una regresión silenciosa.
            onChange(d ? dateToDayKey(d) : '');
            if (d) setAbierto(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
