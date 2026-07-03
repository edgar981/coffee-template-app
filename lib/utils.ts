import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const isIframe = typeof window !== "undefined" 
  ? window.self !== window.top 
  : false;

export const formatCOP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);

export function getInitials(name?: string | null): string {
  if (!name) return "SN";
  return name.trim().split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

export function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")                    // decompose accented chars: "í" → "i" + combining accent
    .replace(/[\u0300-\u036f]/g, "");    // strip the combining accent marks
}