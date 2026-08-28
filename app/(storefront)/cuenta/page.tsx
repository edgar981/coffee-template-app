"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

import { redirect } from "next/navigation";

import {
  Package,
  User,
  MapPin,
  LogOut,
  ShoppingBag,
  ChevronRight,
  Coffee,
} from "lucide-react";

import { motion } from "framer-motion";

import { formatCOP } from "@duna/core/utils";

import StatusBadge from "@/components/ui/StatusBadge";

import { getCurrentUser, logout } from "@/services/auth.service";

import { getOrdersByUser } from "@/services/order.service";

const TABS = [
  {
    id: "orders",
    label: "Mis Pedidos",
    icon: Package,
  },

  {
    id: "subs",
    label: "Suscripciones",
    icon: Coffee,
  },

  {
    id: "profile",
    label: "Mi Perfil",
    icon: User,
  },

  {
    id: "addresses",
    label: "Direcciones",
    icon: MapPin,
  },
];

export default function AccountPage() {
  // TEMP v1: redirect until account feature is built — REMOVE this when /cuenta ships
  redirect("/");

  const [tab, setTab] = useState("orders");

  const [orders, setOrders] = useState<any[]>([]);

  const [user, setUser] = useState<any>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAccount() {
      try {
        const currentUser = await getCurrentUser();

        setUser(currentUser);

        if (currentUser) {
          const userOrders =
            await getOrdersByUser();

          setOrders(userOrders);
        }
      } finally {
        setLoading(false);
      }
    }

    loadAccount();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center pt-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--sf-linea)] border-t-[var(--sf-acento)]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4 pt-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-sm text-center"
        >
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--sf-superficie)]">
            <User className="h-7 w-7 text-[var(--sf-tostado-2)]" />
          </div>

          <h2 className="mb-2 text-2xl font-playfair text-[var(--sf-tinta)]">
            Mi Cuenta
          </h2>

          <p className="mb-6 text-sm text-[var(--sf-texto)]">
            Inicia sesión para ver tus pedidos,
            gestionar tu suscripción y más.
          </p>

          <button className="mb-3 w-full rounded-xl bg-[var(--sf-tinta)] py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--sf-tinta-2)]">
            Iniciar sesión
          </button>

          <p className="text-xs text-[var(--sf-texto-suave)]">
            ¿Nuevo cliente? Tu cuenta se crea
            automáticamente al hacer tu primer
            pedido.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--sf-fondo)] pt-16">
      {/* Profile Header */}
      <div className="bg-[var(--sf-tinta)] px-4 py-10">
        <div className="mx-auto flex max-w-4xl items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--sf-tostado)]/20">
            <span className="text-xl font-bold text-[var(--sf-tostado)]">
              {user.full_name?.[0] || "U"}
            </span>
          </div>

          <div>
            <h2 className="text-xl font-playfair text-white">
              Hola,{" "}
              {user.full_name?.split(" ")[0] ||
                "amigo/a"}
            </h2>

            <p className="text-sm text-white/50">
              {user.email}
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-4">
          {/* Sidebar */}
          <div className="sm:col-span-1">
            <div className="overflow-hidden rounded-2xl border border-[var(--sf-linea)] bg-white">
              {TABS.map((tabItem) => (
                <button
                  key={tabItem.id}
                  onClick={() =>
                    setTab(tabItem.id)
                  }
                  className={`flex w-full items-center gap-3 border-b border-[var(--sf-superficie)] px-4 py-3.5 text-sm font-medium transition-colors last:border-0 ${
                    tab === tabItem.id
                      ? "bg-[var(--sf-superficie)] text-[var(--sf-acento)]"
                      : "text-[var(--sf-texto)] hover:bg-[var(--sf-fondo)]"
                  }`}
                >
                  <tabItem.icon className="h-4 w-4" />

                  <span className="hidden sm:block">
                    {tabItem.label}
                  </span>

                  <ChevronRight
                    className={`ml-auto hidden h-3 w-3 sm:block ${
                      tab === tabItem.id
                        ? "text-[var(--sf-acento)]"
                        : "text-[var(--sf-tostado-2)]"
                    }`}
                  />
                </button>
              ))}

              <button
                onClick={logout}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-sm font-medium text-red-500 transition-colors hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" />

                <span className="hidden sm:block">
                  Cerrar sesión
                </span>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="sm:col-span-3">
            {tab === "orders" && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-[var(--sf-tinta)]">
                  Mis Pedidos
                </h3>

                {orders.length === 0 ? (
                  <div className="rounded-2xl border border-[var(--sf-linea)] bg-white p-12 text-center">
                    <ShoppingBag className="mx-auto mb-3 h-10 w-10 text-[var(--sf-tostado-2)]" />

                    <p className="mb-1 font-medium text-[var(--sf-tinta)]">
                      Aún no tienes pedidos
                    </p>

                    <p className="mb-4 text-sm text-[var(--sf-texto-suave)]">
                      Explora nuestra tienda y
                      haz tu primer pedido.
                    </p>

                    <Link
                      href="/shop"
                      className="inline-block rounded-xl bg-[var(--sf-acento)] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--sf-acento-3)]"
                    >
                      Ir a la tienda
                    </Link>
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--sf-superficie)] overflow-hidden rounded-2xl border border-[var(--sf-linea)] bg-white">
                    {orders.map((order) => (
                      <div
                        key={order.id}
                        className="flex items-center justify-between p-4 transition-colors hover:bg-[var(--sf-fondo)]"
                      >
                        <div>
                          <p className="text-sm font-semibold text-[var(--sf-acento)]">
                            {order.numero_orden}
                          </p>

                          <p className="mt-0.5 text-xs text-[var(--sf-texto-suave)]">
                            {new Date(
                              order.createdAt
                            ).toLocaleDateString(
                              "es-CO",
                              {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              }
                            )}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <StatusBadge
                            status={order.estado}
                            theme="light"
                          />

                          <p className="text-sm font-bold text-[var(--sf-tinta)]">
                            {formatCOP(order.total)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Subscriptions Tab */}
              {tab === 'subs' && (
                <div>
                  <h3 className="font-semibold text-[var(--sf-tinta)] text-lg mb-4">Mis Suscripciones</h3>
                  <div className="bg-white rounded-2xl border border-[var(--sf-linea)] p-6 text-center">
                    <Coffee className="w-10 h-10 text-[var(--sf-tostado-2)] mx-auto mb-3" />
                    <p className="font-medium text-[var(--sf-tinta)] mb-1">No tienes suscripciones activas</p>
                    <p className="text-sm text-[var(--sf-texto-suave)] mb-4">Suscríbete y recibe café fresco cada mes con descuento.</p>
                    <Link href="/suscripciones" className="inline-block bg-[var(--sf-acento)] text-white text-sm font-semibold px-6 py-2.5 rounded-xl hover:bg-[var(--sf-acento-3)] transition-colors">Ver planes</Link>
                  </div>
                </div>
              )}

              {/* Profile Tab */}
              {tab === 'profile' && (
                <div>
                  <h3 className="font-semibold text-[var(--sf-tinta)] text-lg mb-4">Mi Perfil</h3>
                  <div className="bg-white rounded-2xl border border-[var(--sf-linea)] p-6 space-y-4">
                    {[['Nombre completo', user.full_name], ['Correo electrónico', user.email], ['Rol', user.role]].map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between py-2 border-b border-[var(--sf-superficie)] last:border-0">
                        <span className="text-sm text-[var(--sf-texto-suave)]">{k}</span>
                        <span className="text-sm font-medium text-[var(--sf-tinta)]">{v || '—'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Addresses Tab */}
              {tab === 'addresses' && (
                <div>
                  <h3 className="font-semibold text-[var(--sf-tinta)] text-lg mb-4">Mis Direcciones</h3>
                  <div className="bg-white rounded-2xl border border-[var(--sf-linea)] p-6 text-center">
                    <MapPin className="w-10 h-10 text-[var(--sf-tostado-2)] mx-auto mb-3" />
                    <p className="font-medium text-[var(--sf-tinta)] mb-1">Sin direcciones guardadas</p>
                    <p className="text-sm text-[var(--sf-texto-suave)]">Tus direcciones se guardarán al realizar un pedido.</p>
                  </div>
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}