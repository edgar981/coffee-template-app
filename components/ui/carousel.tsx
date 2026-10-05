"use client";
import * as React from "react"
import useEmblaCarousel from "embla-carousel-react"
import type { EmblaCarouselType, EmblaOptionsType, EmblaPluginType } from "embla-carousel"
import { ArrowLeft, ArrowRight } from "lucide-react"

import { cn } from "@duna/core/utils"
import { Button } from "@/components/ui/button"

// --------------------
// Context
// --------------------
type CarouselContextType = {
  carouselRef: (node: HTMLElement | null) => void
  api: EmblaCarouselType | undefined
  opts?: EmblaOptionsType
  orientation: "horizontal" | "vertical"
  scrollPrev: () => void
  scrollNext: () => void
  canScrollPrev: boolean
  canScrollNext: boolean
}

const CarouselContext = React.createContext<CarouselContextType | null>(null)

// EXPORTADO (§ SECCIONES-CARRUSEL-1): antes sólo lo consumían `CarouselPrevious`/`CarouselNext`
// de este mismo archivo. La sección "Carrusel" del catálogo curado de instancias
// (`components/storefront/secciones/Carrusel.tsx`) necesita `api` (para el autoplay con
// `scrollNext`/`scrollTo` y para escuchar `select`) desde FUERA de este archivo, con sus propios
// controles estilados con tokens `--sf-*` — nunca `CarouselPrevious`/`CarouselNext` (esos son
// shadcn/admin-level, con `Button`). Exportar el hook es más barato que ensanchar el contexto con
// cada dato que un consumidor futuro pueda necesitar.
export function useCarousel() {
  const context = React.useContext(CarouselContext)
  if (!context) {
    throw new Error("useCarousel must be used within a <Carousel />")
  }
  return context
}

// --------------------
// Carousel Root
// --------------------
export interface CarouselProps
  extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical"
  opts?: EmblaOptionsType
  plugins?: EmblaPluginType[]
  setApi?: (api: EmblaCarouselType) => void
}

const Carousel = React.forwardRef<
  React.ComponentRef<"div">,
  CarouselProps
>(
  (
    {
      orientation = "horizontal",
      opts,
      setApi,
      plugins,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const [carouselRef, api] = useEmblaCarousel(
      {
        ...opts,
        axis: orientation === "horizontal" ? "x" : "y",
      },
      plugins
    )

    const [canScrollPrev, setCanScrollPrev] = React.useState(false)
    const [canScrollNext, setCanScrollNext] = React.useState(false)

    const onSelect = React.useCallback((api: EmblaCarouselType) => {
      setCanScrollPrev(api.canScrollPrev())
      setCanScrollNext(api.canScrollNext())
    }, [])

    const scrollPrev = React.useCallback(() => {
      api?.scrollPrev()
    }, [api])

    const scrollNext = React.useCallback(() => {
      api?.scrollNext()
    }, [api])

    const handleKeyDown = React.useCallback(
      (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault()
          scrollPrev()
        } else if (event.key === "ArrowRight") {
          event.preventDefault()
          scrollNext()
        }
      },
      [scrollPrev, scrollNext]
    )

    React.useEffect(() => {
      if (!api || !setApi) return
      setApi(api)
    }, [api, setApi])

    React.useEffect(() => {
      if (!api) return

      onSelect(api)
      api.on("reInit", onSelect)
      api.on("select", onSelect)

      return () => {
        api.off("select", onSelect)
      }
    }, [api, onSelect])

    return (
      <CarouselContext.Provider
        value={{
          carouselRef,
          api,
          opts,
          orientation,
          scrollPrev,
          scrollNext,
          canScrollPrev,
          canScrollNext,
        }}
      >
        <div
          ref={ref}
          onKeyDownCapture={handleKeyDown}
          className={cn("relative", className)}
          role="region"
          aria-roledescription="carousel"
          {...props}
        >
          {children}
        </div>
      </CarouselContext.Provider>
    )
  }
)
Carousel.displayName = "Carousel"

// --------------------
// Content
// --------------------
const CarouselContent = React.forwardRef<
  React.ComponentRef<"div">,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { carouselRef, orientation } = useCarousel()

  // `h-full` acá (§ SECCIONES-CARRUSEL-1): sin el ancestro con una altura DEFINIDA (el root de
  // `Carousel` con `className="absolute inset-0"`, § el consumidor de "Carrusel"), esto resuelve a
  // 'auto' — un no-op para todo consumidor de ANTES de este slice (`CarouselPrevious`/
  // `CarouselNext` no lo necesitaban porque nunca hubo un consumidor real). Con esa altura definida
  // arriba, es lo que deja que el `flex` de abajo (con `className="h-full"` pasado por el
  // consumidor) herede una altura resoluble, y de ahí cada `CarouselItem` (align-items:stretch por
  // defecto) estire al alto completo — la cadena que una foto de fondo a sangre por diapositiva
  // necesita.
  return (
    <div ref={carouselRef} className="h-full overflow-hidden">
      <div
        ref={ref}
        className={cn(
          "flex",
          orientation === "horizontal" ? "-ml-4" : "-mt-4 flex-col",
          className
        )}
        {...props}
      />
    </div>
  )
})
CarouselContent.displayName = "CarouselContent"

// --------------------
// Item
// --------------------
const CarouselItem = React.forwardRef<
  React.ComponentRef<"div">,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { orientation } = useCarousel()

  return (
    <div
      ref={ref}
      role="group"
      aria-roledescription="slide"
      className={cn(
        "min-w-0 shrink-0 grow-0 basis-full",
        orientation === "horizontal" ? "pl-4" : "pt-4",
        className
      )}
      {...props}
    />
  )
})
CarouselItem.displayName = "CarouselItem"

// --------------------
// Previous Button
// --------------------
const CarouselPrevious = React.forwardRef<
  React.ComponentRef<typeof Button>,
  React.ComponentPropsWithoutRef<typeof Button>
>(({ className, variant = "outline", size = "icon", ...props }, ref) => {
  const { orientation, scrollPrev, canScrollPrev } = useCarousel()

  return (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      className={cn(
        "absolute h-8 w-8 rounded-full",
        orientation === "horizontal"
          ? "-left-12 top-1/2 -translate-y-1/2"
          : "-top-12 left-1/2 -translate-x-1/2 rotate-90",
        className
      )}
      disabled={!canScrollPrev}
      onClick={scrollPrev}
      {...props}
    >
      <ArrowLeft className="h-4 w-4" />
      <span className="sr-only">Previous slide</span>
    </Button>
  )
})
CarouselPrevious.displayName = "CarouselPrevious"

// --------------------
// Next Button
// --------------------
const CarouselNext = React.forwardRef<
  React.ComponentRef<typeof Button>,
  React.ComponentPropsWithoutRef<typeof Button>
>(({ className, variant = "outline", size = "icon", ...props }, ref) => {
  const { orientation, scrollNext, canScrollNext } = useCarousel()

  return (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      className={cn(
        "absolute h-8 w-8 rounded-full",
        orientation === "horizontal"
          ? "-right-12 top-1/2 -translate-y-1/2"
          : "-bottom-12 left-1/2 -translate-x-1/2 rotate-90",
        className
      )}
      disabled={!canScrollNext}
      onClick={scrollNext}
      {...props}
    >
      <ArrowRight className="h-4 w-4" />
      <span className="sr-only">Next slide</span>
    </Button>
  )
})
CarouselNext.displayName = "CarouselNext"

export {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
}