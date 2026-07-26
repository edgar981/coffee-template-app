// Shared modal presentation tokens — the ONE place the scrim and the open/close
// timing are defined, consumed by the Sheet, every Dialog and the ⌘K palette. No
// duplicated `bg-black/..` per component, no magic ms scattered across files.

// The scrim: lighter than the shadcn default (`bg-black/80`) so the content behind
// reads as clearly dimmed, not switched off. Dark mode needs a touch more alpha to
// dim an already-dark background by the same perceived amount. Fade animation is
// here; the DURATION is added per-consumer so it syncs with its container.
export const overlayClasses =
  "fixed inset-0 z-50 bg-black/35 dark:bg-black/50 " +
  "data-[state=open]:animate-in data-[state=closed]:animate-out " +
  "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0";

// Sheet (side panel): slower, gliding. Open ~300ms ease-out (settles in), close
// ~200ms ease-in (leaves a bit quicker). No bounce.
export const sheetTiming =
  "data-[state=open]:duration-300 data-[state=open]:ease-out " +
  "data-[state=closed]:duration-200 data-[state=closed]:ease-in";

// Dialog / ⌘K: snappy. Open ~200ms, close ~150ms — a speed tool must never feel
// like it lags the first keystroke.
export const dialogTiming =
  "data-[state=open]:duration-200 data-[state=closed]:duration-150";
