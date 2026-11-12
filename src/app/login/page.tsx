"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Stethoscope,
  Lock,
  Mail,
  User,
  Building2,
  ShieldCheck,
  AlertCircle,
  Eye,
  EyeOff,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);

  const [name, setName] = useState("");
  const [labName, setLabName] = useState("Laboratorio Dental");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then((data) => {
        if (data.authenticated) {
          router.replace("/");
          return;
        }
        setRegistrationOpen(Boolean(data.registrationOpen));
        if (!data.hasUsers) {
          setMode("register");
        }
      })
      .catch(() => {})
      .finally(() => setCheckingStatus(false));
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint =
        mode === "register" ? "/api/auth/register" : "/api/auth/login";
      const payload =
        mode === "register"
          ? { name, labName, email, password }
          : { email, password };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ocurrió un error al procesar la solicitud");
        setLoading(false);
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setError("Error de conexión con el servidor");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-sky-950 flex flex-col justify-center items-center px-4 py-8">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
        {/* Encabezado */}
        <div className="bg-slate-900 px-6 py-7 text-center text-white relative">
          <div className="w-14 h-14 rounded-2xl bg-sky-600 mx-auto flex items-center justify-center shadow-lg mb-3">
            <Stethoscope className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">
            DentalLab Pro PWA
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Gestión de Prótesis Dental, Precios y Cuentas Corrientes
          </p>
        </div>

        {/* Selector de modo si el registro inicial está habilitado */}
        {!checkingStatus && registrationOpen && (
          <div className="grid grid-cols-2 bg-slate-100 p-1 m-6 mb-0 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError("");
              }}
              className={`py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
                mode === "login"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Iniciar Sesión
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setError("");
              }}
              className={`py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
                mode === "register"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Crear Cuenta Inicial
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {mode === "register" && (
            <div className="bg-sky-50 border border-sky-200 text-sky-900 rounded-xl p-3 text-xs leading-relaxed">
              <strong>Configuración inicial del Protesista:</strong> Crea tu
              cuenta administradora. Una vez registrada, el registro público se
              bloqueará automáticamente para que nadie más pueda crear cuentas.
            </div>
          )}

          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {mode === "register" && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tu Nombre (Protesista)
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej. Tomás Gómez"
                    className="w-full pl-10 pr-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nombre del Laboratorio
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    value={labName}
                    onChange={(e) => setLabName(e.target.value)}
                    placeholder="Ej. Laboratorio Dental Precisión"
                    className="w-full pl-10 pr-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Correo Electrónico
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
                className="w-full pl-10 pr-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Contraseña {mode === "register" && "(mínimo 8 caracteres)"}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={mode === "register" ? 8 : 1}
                autoComplete={
                  mode === "register" ? "new-password" : "current-password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sky-600 hover:bg-sky-500 disabled:bg-sky-300 text-white font-semibold py-3 rounded-xl text-sm shadow-md transition cursor-pointer"
          >
            {loading
              ? "Verificando seguridad..."
              : mode === "register"
              ? "Registrar Laboratorio y Entrar"
              : "Ingresar al Panel"}
          </button>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Sesión cifrada con token HttpOnly y bloqueo de acceso externo
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
