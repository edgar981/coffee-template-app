"use client";
import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";

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

// ─── Las dos superficies CRUDAS (SheetScrim / SheetSurface) ──────────────────
//
// Son el Radix PELADO —`SheetPrimitive.Overlay` y `.Content` sin chrome—, para que
// DunaSheet (y alert-dialog) usen el COMPORTAMIENTO (foco atrapado, Escape, click-fuera,
// scroll-lock vía react-remove-scroll) y pongan su propia FORMA.
//
// El `SheetContent` shadcn —con fondo, padding, sombra y X— SE RETIRÓ (§ retiro de
// sidebar): quedó sin un solo consumidor cuando el último, el DashboardCustomizer, migró a
// DunaSheet. `SheetOverlay`/`SheetTrigger`/`SheetClose` siguen exportados pero también sin
// consumidor (candidatos a retiro aparte).
//
// `@radix-ui/react-dialog` se importa en un solo sitio, igual que `@vercel/blob` en
// `lib/storage.ts`: hace barata la revisión del día que la librería cambie — y entra como
// dependencia transitiva, así que un import suelto en otro archivo sería una apuesta sobre
// el árbol de node_modules.
const SheetScrim   = SheetPrimitive.Overlay;
const SheetSurface = SheetPrimitive.Content;

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
  SheetTitle,
  SheetDescription,
};
