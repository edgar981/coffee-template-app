"use client";
import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";

import { cn } from "@duna/core/utils";

const Sheet = SheetPrimitive.Root;

const SheetPortal = SheetPrimitive.Portal;

// ─── Las dos superficies CRUDAS (SheetScrim / SheetSurface) ──────────────────
//
// Son el Radix PELADO —`SheetPrimitive.Overlay` y `.Content` sin chrome—, para que
// DunaSheet (y alert-dialog) usen el COMPORTAMIENTO (foco atrapado, Escape, click-fuera,
// scroll-lock vía react-remove-scroll) y pongan su propia FORMA.
//
// El `SheetContent` shadcn —con fondo, padding, sombra y X— SE RETIRÓ (§ retiro de
// sidebar), junto con `SheetOverlay`, `SheetTrigger` y `SheetClose`: todos quedaron sin un
// solo consumidor cuando el último, el DashboardCustomizer, migró a DunaSheet. Este archivo
// ya sólo expone lo que DunaSheet y alert-dialog usan.
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
  SheetScrim,
  SheetSurface,
  SheetTitle,
  SheetDescription,
};
