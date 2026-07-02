export const subscriptionThemes = {
  essential: {
    card: "bg-stone-100 border-stone-300",
    badge: "bg-stone-700 text-white",
    button: "bg-stone-900 hover:bg-stone-800",
  },

  premium: {
    card: "bg-amber-50 border-amber-300",
    badge: "bg-amber-700 text-white",
    button: "bg-amber-700 hover:bg-amber-600",
  },

  barista: {
    card: "bg-zinc-900 border-zinc-700",
    badge: "bg-orange-500 text-black",
    button: "bg-orange-500 hover:bg-orange-400",
  },
} as const;