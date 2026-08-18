"use client";
import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker, type DayPickerProps } from "react-day-picker"

import { cn } from "@duna/core/utils"
import { buttonVariants } from "@/components/ui/button"

// Props = DayPicker props + your additions
export type CalendarProps = DayPickerProps & {
  className?: string
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      // `relative` NO es decorativo: es el ancestro POSICIONADO contra el que anclan
      // los botones de nav (react-day-picker v10, sin `navLayout`, monta el `<Nav>`
      // como hermano de los meses; sus botones son `absolute`). Sin esto anclaban al
      // `PopoverContent`. Es el eje HORIZONTAL del arreglo; el vertical lo pone el
      // `top-1` de `button_previous/next` (ver ahí). Los dos juntos ponen las flechas
      // en la banda del caption (fondo `--duna-surface`), donde su `opacity-50` es el
      // contraste normal del chevron. NO quitar.
      className={cn("relative p-3", className)}
      classNames={{
  months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
  month: "space-y-4",

  // La clave `month_caption` se PERDIÓ en el rename `caption` → `month_caption`
  // de react-day-picker v8 → v10: sin ella el `<div>` del caption queda sin estilo
  // y el label se pega a la IZQUIERDA, donde la flecha de nav de esa esquina se le
  // encima. Centrarlo es restaurar la intención de shadcn (`caption: flex
  // justify-center` en v8), no una posición nueva. NO quitar.
  month_caption: "flex justify-center items-center",

  // `captionLayout="dropdown"` monta un `<select>` nativo SUPERPUESTO a un label
  // visible; el `style.css` de la librería —que no importamos— pone el select
  // `opacity-0` absoluto ENCIMA del label. Sin esas reglas el select se ve crudo
  // ADEMÁS del label → duplicado. Estas claves reponen ese overlay: el select
  // invisible arriba (`z-20`) captura el click, el label visible debajo (`z-10`).
  // Mismo caso que `month_caption`: la config asume un CSS que no traemos. NO quitar.
  dropdowns: "flex items-center gap-1.5",
  dropdown_root: "relative inline-flex items-center",
  dropdown: "absolute inset-0 z-20 w-full cursor-pointer opacity-0",
  chevron: "fill-current",
  caption_label: "relative z-10 inline-flex items-center gap-1 text-sm font-medium",

  nav: "space-x-1 flex items-center",

  // `top-1` NO es arbitrario: `left-1`/`right-1` ya declaraban intención de
  // ESQUINA, pero sin `top` un `absolute` hereda su POSICIÓN ESTÁTICA en el eje
  // vertical — y aquí esa posición sale CENTRADA, porque el `<Nav>` es hijo de
  // `Months` (flex-row en sm+) y se estira al alto TOTAL del calendario, con
  // `items-center` centrando sus botones absolutos. Sin `top-1` las flechas caen
  // a media altura, sobre la grilla, invisibles contra el rango resaltado.
  // El `top` es el eje que faltaba, no una posición nueva. NO quitar.
  button_previous: cn(
    buttonVariants({ variant: "outline" }),
    "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute top-1 left-1"
  ),
  button_next: cn(
    buttonVariants({ variant: "outline" }),
    "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute top-1 right-1"
  ),

  weekdays: "flex",
  weekday:
    "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem]",

  week: "flex w-full mt-2",

  day: cn(
    buttonVariants({ variant: "ghost" }),
    "h-8 w-8 p-0 font-normal aria-selected:opacity-100"
  ),

  selected:
    "bg-primary text-primary-foreground hover:bg-primary",
  today: "bg-accent text-accent-foreground",

  outside:
    "text-muted-foreground opacity-50",

  disabled:
    "text-muted-foreground opacity-50",

  range_start: "bg-primary text-primary-foreground",
  range_end: "bg-primary text-primary-foreground",
  range_middle:
    "bg-accent text-accent-foreground",
    
  ...classNames,
}}
      components={{
  PreviousMonthButton: ({ className, ...props }) => (
    <button {...props} className={cn(className)}>
      <ChevronLeft className="h-4 w-4" />
    </button>
  ),
  NextMonthButton: ({ className, ...props }) => (
    <button {...props} className={cn(className)}>
      <ChevronRight className="h-4 w-4" />
    </button>
  ),
}}
      {...props}
    />
  )
}

Calendar.displayName = "Calendar"

export { Calendar }