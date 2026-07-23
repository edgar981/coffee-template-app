"use client";
import { useEffect } from "react";

// Marks <html> with the `admin` class while an admin route is mounted. The
// scoped Duna palette in globals.css keys off `html.admin`, so putting the
// marker on <html> (not a wrapper <div>) means body-portaled UI — modals,
// dropdowns, toasts — inherits the Duna tokens too. The cleanup removes the
// class when the user leaves the admin group, so the storefront stays on its
// coffee `:root` palette. (Dark mode is handled by next-themes' own `.dark`
// class + inline script; this marker drives the admin *light* palette.)
export function AdminScope() {
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add("admin");
    return () => html.classList.remove("admin");
  }, []);
  return null;
}
