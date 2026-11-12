"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  ShieldCheck,
  Lock,
  Download,
  Upload,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  History,
  RotateCcw,
  RefreshCw,
} from "lucide-react";
import { formatDateTime } from "@/lib/format";

interface SnapshotItem {
  id: string;
  reason: string;
  productsCount: number;
  dentistsCount: number;
  entriesCount: number;
  createdAt: string;
}

interface MirrorInfo {
  exportedAt: string;
  productsCount: number;
  dentistsCount: number;
  entriesCount: number;
}

export default function ConfiguracionPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Estado de Backups Automáticos y Manuales
  const [snapshots, setSnapshots] = useState<SnapshotItem[]>([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(true);
  const [mirrorInfo, setMirrorInfo] = useState<MirrorInfo | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [backupFeedback, setBackupFeedback] = useState("");
  const [backupError, setBackupError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadSnapshotsAndMirror = async () => {
    setLoadingSnapshots(true);
    try {
      const res = await fetch("/api/backup?snapshots=1");
      const data = await res.json();
      if (data?.snapshots) {
        setSnapshots(data.snapshots);
      }
    } catch {
      // ignore
    } finally {
      setLoadingSnapshots(false);
    }

    try {
      const rawMirror = localStorage.getItem("dentallab_auto_mirror");
      if (rawMirror) {
        const parsed = JSON.parse(rawMirror);
        if (parsed?.data) {
          setMirrorInfo({
            exportedAt: parsed.exportedAt,
            productsCount: parsed.data.products?.length || 0,
            dentistsCount: parsed.data.dentists?.length || 0,
            entriesCount: parsed.data.entries?.length || 0,
          });
        }
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadSnapshotsAndMirror();
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch("/api/auth/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al actualizar la contraseña");
      } else {
        setMessage("Contraseña actualizada correctamente.");
        setCurrentPassword("");
        setNewPassword("");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadBackup = async (snapshotId?: string) => {
    setDownloading(true);
    setBackupError("");
    try {
      const urlPath = snapshotId
        ? `/api/backup?snapshotId=${encodeURIComponent(snapshotId)}`
        : "/api/backup";
      const res = await fetch(urlPath);
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = `respaldo-laboratorio-dental-${dateStr}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setBackupError("No se pudo descargar el archivo de respaldo.");
    } finally {
      setDownloading(false);
    }
  };

  const handleTriggerManualSnapshot = async () => {
    setBackupError("");
    setBackupFeedback("");
    try {
      const res = await fetch("/api/cron/backup");
      if (res.ok) {
        await loadSnapshotsAndMirror();
        setBackupFeedback("Punto de restauración creado y espejo actualizado.");
        setTimeout(() => setBackupFeedback(""), 4000);
      }
    } catch {
      setBackupError("Error al crear punto de restauración.");
    }
  };

  const handleRestoreSnapshot = async (snap: SnapshotItem) => {
    if (
      !window.confirm(
        `¿Deseas restaurar el sistema al punto automático "${
          snap.reason
        }" del ${formatDateTime(snap.createdAt)}?\n\n(Se creará primero una copia automática de tus datos actuales por seguridad).`
      )
    ) {
      return;
    }

    setRestoring(true);
    setBackupError("");
    setBackupFeedback("");

    try {
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshotId: snap.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBackupError(data.error || "No se pudo restaurar el punto");
      } else {
        setBackupFeedback(
          data.message || "Punto de restauración aplicado con éxito."
        );
        await loadSnapshotsAndMirror();
      }
    } catch {
      setBackupError("Error de conexión al restaurar");
    } finally {
      setRestoring(false);
    }
  };

  const handleRestoreFromMirror = async () => {
    const rawMirror = localStorage.getItem("dentallab_auto_mirror");
    if (!rawMirror) return;

    if (
      !window.confirm(
        "¿Deseas restaurar en el servidor la copia espejo guardada automáticamente en este dispositivo?"
      )
    ) {
      return;
    }

    setRestoring(true);
    setBackupError("");
    setBackupFeedback("");

    try {
      const payload = JSON.parse(rawMirror);
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBackupError(data.error || "Error al restaurar desde espejo local");
      } else {
        setBackupFeedback(
          data.message || "Datos restaurados desde el espejo del dispositivo."
        );
        await loadSnapshotsAndMirror();
      }
    } catch {
      setBackupError("Error al leer el espejo del dispositivo");
    } finally {
      setRestoring(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (
      !window.confirm(
        `¿Confirmas que deseas importar y restaurar el archivo "${file.name}"?`
      )
    ) {
      e.target.value = "";
      return;
    }

    setRestoring(true);
    setBackupError("");
    setBackupFeedback("");

    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBackupError(data.error || "El archivo de respaldo no es válido");
      } else {
        setBackupFeedback(data.message || "Archivo importado con éxito.");
        await loadSnapshotsAndMirror();
      }
    } catch {
      setBackupError(
        "El archivo seleccionado no tiene un formato JSON válido."
      );
    } finally {
      setRestoring(false);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <h1 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          Seguridad y Sistema de Backup Automático
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Tus datos se respaldan solos al registrar cambios, diariamente y en la
          memoria de tu teléfono
        </p>
      </div>

      {/* Panel Principal de Backups Automáticos (Puntos de Restauración + Espejo en Teléfono) */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <History className="w-5 h-5 text-sky-600" />
              Puntos de Restauración Automáticos
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Se crean automáticamente cada vez que agregas o editas precios,
              dentistas, trabajos o pagos
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleTriggerManualSnapshot}
              className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-2 rounded-xl transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Crear Punto Ahora
            </button>

            <button
              type="button"
              onClick={() => handleDownloadBackup()}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold px-3.5 py-2 rounded-xl shadow-xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              {downloading ? "Descargando..." : "Descargar .JSON"}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={restoring}
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3.5 py-2 rounded-xl shadow-xs transition cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              Importar .JSON
            </button>
          </div>
        </div>

        {backupFeedback && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-xl text-xs font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{backupFeedback}</span>
          </div>
        )}

        {backupError && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3.5 rounded-xl text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{backupError}</span>
          </div>
        )}

        {/* Espejo Automático Guardado en este Teléfono/Dispositivo */}
        {mirrorInfo && (
          <div className="bg-sky-50/70 border border-sky-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-sky-900">
                <Smartphone className="w-4 h-4 text-sky-600" />
                Espejo Automático Guardado en este Teléfono / Navegador
              </div>
              <p className="text-xs text-sky-800">
                Última sincronización automática:{" "}
                <strong>{formatDateTime(mirrorInfo.exportedAt)}</strong> (
                {mirrorInfo.productsCount} productos, {mirrorInfo.dentistsCount}{" "}
                dentistas, {mirrorInfo.entriesCount} movimientos)
              </p>
            </div>
            <button
              type="button"
              onClick={handleRestoreFromMirror}
              disabled={restoring}
              className="inline-flex items-center justify-center gap-1.5 bg-white hover:bg-sky-100 text-sky-800 border border-sky-300 text-xs font-semibold px-3 py-2 rounded-xl transition cursor-pointer shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restaurar desde este Teléfono
            </button>
          </div>
        )}

        {/* Tabla de los últimos Puntos de Restauración Automáticos */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 text-xs font-bold text-slate-700">
            Historial de Backups Automáticos en Base de Datos (Últimos 20)
          </div>

          {loadingSnapshots ? (
            <div className="p-6 text-center text-xs text-slate-500">
              Cargando historial de respaldos automáticos...
            </div>
          ) : snapshots.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              El primer punto de restauración automático se creará apenas
              agregues o modifiques cualquier dato, o tocando &quot;Crear Punto
              Ahora&quot;.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {snapshots.map((snap) => (
                <div
                  key={snap.id}
                  className="p-3.5 px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50 transition"
                >
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-900">
                        {snap.reason}
                      </span>
                      <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium">
                        {formatDateTime(snap.createdAt)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {snap.productsCount} productos · {snap.dentistsCount}{" "}
                      dentistas · {snap.entriesCount} movimientos registrados
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleDownloadBackup(snap.id)}
                      className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1"
                      title="Descargar este punto en archivo JSON"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Bajar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRestoreSnapshot(snap)}
                      disabled={restoring}
                      className="text-xs font-semibold text-sky-700 hover:text-white bg-sky-50 hover:bg-sky-600 border border-sky-200 px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restaurar</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Estado de Seguridad Activa */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 space-y-2">
        <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          Medidas de Seguridad Activas en tu Laboratorio
        </div>
        <ul className="text-xs text-emerald-800 space-y-1.5 list-disc list-inside">
          <li>
            <strong>Registro público bloqueado:</strong> Ninguna persona externa
            puede crear cuentas ni consultar tus precios o dentistas.
          </li>
          <li>
            <strong>Triple Backup Automático:</strong> Copias automáticas en base
            de datos al editar, espejo automático en el teléfono y archivo en la
            carpeta <code>/backups</code>.
          </li>
          <li>
            <strong>Sesión blindada (HttpOnly) y contraseñas Bcrypt</strong> con
            bloqueo automático contra intentos de fuerza bruta.
          </li>
        </ul>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Cambiar Contraseña */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <h2 className="font-bold text-base text-slate-900 flex items-center gap-2 mb-4">
            <Lock className="w-4 h-4 text-sky-600" />
            Cambiar Contraseña de Acceso
          </h2>

          <form onSubmit={handleChangePassword} className="space-y-3.5">
            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {message && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{message}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Contraseña Actual
              </label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nueva Contraseña (mínimo 8 caracteres)
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer"
            >
              {saving ? "Actualizando..." : "Actualizar Contraseña"}
            </button>
          </form>
        </div>

        {/* Cómo instalar la PWA en el Teléfono */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <h2 className="font-bold text-base text-slate-900 flex items-center gap-2 mb-2">
            <Smartphone className="w-4 h-4 text-sky-600" />
            Cómo Instalar la PWA en tu Teléfono
          </h2>
          <ul className="text-xs text-slate-600 space-y-2.5 mt-3">
            <li>
              <strong>En Android (Chrome):</strong> Toca el botón{" "}
              <em>&quot;Instalar App&quot;</em> en la barra superior o abre el
              menú de 3 puntos de Chrome y selecciona{" "}
              <strong>&quot;Instalar aplicación&quot;</strong> /{" "}
              <strong>&quot;Agregar a la pantalla principal&quot;</strong>.
            </li>
            <li>
              <strong>En iPhone (Safari):</strong> Toca el botón{" "}
              <strong>Compartir</strong> en la barra inferior de Safari y elige{" "}
              <strong>&quot;Agregar a inicio&quot;</strong>.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
