"use client";
import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { cva, VariantProps } from "class-variance-authority";
import { X } from "lucide-react";

import { cn } from "@duna/core/utils";
import { overlayClasses, sheetTiming } from "@/components/ui/overlay";

const Sheet = SheetPrimitive.Root;

const SheetTrigger = SheetPrimitive.Trigger;

const SheetClose = SheetPrimitive.Close;

const SheetPortal = SheetPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ComponentRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    // Shared scrim (components/ui/overlay) + the Sheet's own timing, so the fade
    // is synced with the panel slide.
    className={cn(overlayClasses, sheetTiming, className)}
    {...props}
    ref={ref}
  />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

// ─── Las dos superficies CRUDAS, sin el chrome de la variante ────────────────
//
// `SheetContent` trae fondo, padding, sombra, borde y una X de cierre: perfecto
// para el sheet genérico, y un estorbo para un consumidor que ya tiene su propia
// FORMA. Neutralizar esas clases una por una desde el call site funciona por
// tailwind-merge, pero deja al llamador peleando con un chrome que no pidió — y
// la primera clase que se agregue acá vuelve a aparecer donde se la había sacado.
//
// Estas dos son el Radix pelado. Existen para que el sheet de Duna use el
// COMPORTAMIENTO (foco atrapado, Escape, click-fuera, scroll-lock vía
// react-remove-scroll) sin heredar la apariencia.
//
// Y siguen viviendo en ESTE archivo a propósito: `@radix-ui/react-dialog` se
// importa en un solo sitio, igual que `@vercel/blob` en `lib/storage.ts`. Es lo
// que hace barata la revisión del día que la librería cambie — hoy además entra
// como dependencia transitiva, así que un import suelto en otro archivo sería
// además una apuesta sobre el árbol de node_modules.
const SheetScrim   = SheetPrimitive.Overlay;
const SheetSurface = SheetPrimitive.Content;

const sheetVariants = cva(
  // Slide timing/easing centralized in `sheetTiming` (open ~300ms ease-out, close
  // ~200ms ease-in). The per-side classes below add the slide direction.
  cn(
    "fixed z-50 gap-4 bg-background p-6 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out",
    sheetTiming,
  ),
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
          "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        left: "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
        right:
          "inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
      },
    },
    defaultVariants: {
      side: "right",
    },
  }
);

type SheetContentProps = React.ComponentPropsWithoutRef<
  typeof SheetPrimitive.Content
> &
  VariantProps<typeof sheetVariants>;

const SheetContent = React.forwardRef<
  React.ComponentRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = "right", className, children, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <SheetPrimitive.Content
      ref={ref}
      className={cn(sheetVariants({ side }), className)}
      {...props}
    >
      <SheetPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </SheetPrimitive.Close>
      {children}
    </SheetPrimitive.Content>
  </SheetPortal>
));
SheetContent.displayName = SheetPrimitive.Content.displayName;

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col space-y-2 text-center sm:text-left", className)}
    {...props}
  />
);
SheetHeader.displayName = "SheetHeader";

const SheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
);
SheetFooter.displayName = "SheetFooter";

const SheetTitle = React.forwardRef<
  React.ComponentRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
));
SheetTitle.displayName = SheetPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
  React.ComponentRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
SheetDescription.displayName = SheetPrimitive.Description.displayName;

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetScrim,
  SheetSurface,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
