"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Users,
  Tag,
  ShieldCheck,
  LogOut,
  Download,
  Stethoscope,
} from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [userInfo, setUserInfo] = useState<{
    name: string;
    labName: string;
    email: string;
  } | null>(null);

  const isLoginPage = pathname === "/login";

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
    };
  }, []);

  useEffect(() => {
    if (isLoginPage) return;
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then((data) => {
        if (data?.user) {
          setUserInfo(data.user);
          // Sincronizar silenciosamente espejo automático en la memoria del teléfono/navegador
          fetch("/api/backup")
            .then((res) => (res.ok ? res.json() : null))
            .then((backupData) => {
              if (backupData?.data) {
                try {
                  localStorage.setItem(
                    "dentallab_auto_mirror",
                    JSON.stringify(backupData)
                  );
                } catch {
                  // ignore storage quota errors
                }
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, [isLoginPage, pathname]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const handleInstallPwa = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  const navItems = [
    { href: "/", label: "Resumen", icon: Home },
    { href: "/dentistas", label: "Dentistas", icon: Users },
    { href: "/precios", label: "Precios", icon: Tag },
    { href: "/configuracion", label: "Seguridad", icon: ShieldCheck },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col pb-20 md:pb-0">
      {/* Barra superior */}
      <header className="sticky top-0 z-30 bg-slate-900 text-white shadow-md border-b border-slate-800">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-600 flex items-center justify-center shadow-inner">
              <Stethoscope className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-base tracking-tight block leading-none">
                {userInfo?.labName || "DentalLab Pro"}
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                {userInfo?.name ? `Protesista: ${userInfo.name}` : "Panel Seguro"}
              </span>
            </div>
          </Link>

          {/* Navegación Desktop */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition ${
                    active
                      ? "bg-sky-600 text-white"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            {deferredPrompt && (
              <button
                onClick={handleInstallPwa}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer"
                title="Instalar aplicación en el teléfono"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Instalar App</span>
              </button>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-rose-600 text-slate-200 hover:text-white text-xs font-medium px-3 py-2 rounded-lg transition cursor-pointer"
              title="Cerrar sesión segura"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-5">
        {children}
      </main>

      {/* Barra de Navegación Inferior para Teléfonos Móviles */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 shadow-lg">
        <div className="grid grid-cols-4 h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-1 text-xs font-medium transition ${
                  active
                    ? "text-sky-600 font-semibold"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <Icon
                  className={`w-5 h-5 ${
                    active ? "text-sky-600 stroke-[2.5]" : "text-slate-400"
                  }`}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
