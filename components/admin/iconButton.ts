// The single hover/focus treatment shared by every icon-only button in the admin
// chrome — the top-bar controls (menu, expand, search, theme, notifications) AND
// the sidebar-rail header buttons — so they can never drift apart again. Uses the
// same `--sidebar-accent` / `--sidebar-foreground` pair as the rail nav rows: a
// soft accent fill on hover, foreground-tinted icon, and the sidebar focus ring.
//
// Size (h-/w-) is left to each caller. The pointer cursor comes from the admin
// base rule in globals.css (`html.admin button`), not from here.
export const ADMIN_ICON_BUTTON =
  'inline-flex items-center justify-center rounded-md text-sidebar-foreground/60 ' +
  'outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground ' +
  'focus-visible:ring-2 focus-visible:ring-sidebar-ring';
