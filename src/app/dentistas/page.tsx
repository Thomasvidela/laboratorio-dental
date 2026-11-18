"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Users,
  Plus,
  Search,
  Phone,
  Building,
  Clock,
  ChevronRight,
  Pencil,
  X,
  AlertCircle,
  CheckCircle2,
  MessageCircle,
} from "lucide-react";
import {
  formatArgentinaWhatsAppNumber,
  formatCurrency,
  formatDateTime,
  formatDisplayArgentinaPhone,
} from "@/lib/format";

interface DentistItem {
  id: string;
  fullName: string;
  clinicName: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  totalCharges: number;
  totalPayments: number;
  balance: number;
  entriesCount: number;
  lastActivity: string;
}

function DentistasContent() {
  const searchParams = useSearchParams();
  const [dentists, setDentists] = useState<DentistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "DEBT" | "CLEAR">(
    "ALL"
  );

  // Modal Crear / Editar Dentista
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDentist, setEditingDentist] = useState<DentistItem | null>(
    null
  );
  const [fullName, setFullName] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [initialBalance, setInitialBalance] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadDentists = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dentists");
      const data = await res.json();
      if (data?.dentists) setDentists(data.dentists);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDentists();
    if (searchParams.get("new") === "1") {
      openCreateModal();
    }
  }, [searchParams]);

  const filteredDentists = useMemo(() => {
    return dentists.filter((d) => {
      if (filterStatus === "DEBT" && d.balance <= 0) return false;
      if (filterStatus === "CLEAR" && d.balance > 0) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        d.fullName.toLowerCase().includes(q) ||
        d.clinicName.toLowerCase().includes(q) ||
        d.phone.toLowerCase().includes(q) ||
        d.email.toLowerCase().includes(q)
      );
    });
  }, [dentists, filterStatus, search]);

  const openCreateModal = () => {
    setEditingDentist(null);
    setFullName("");
    setClinicName("");
    setPhone("");
    setEmail("");
    setAddress("");
    setNotes("");
    setInitialBalance("");
    setError("");
    setModalOpen(true);
  };

  const openEditModal = (e: React.MouseEvent, dentist: DentistItem) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingDentist(dentist);
    setFullName(dentist.fullName);
    setClinicName(dentist.clinicName || "");
    setPhone(dentist.phone || "");
    setEmail(dentist.email || "");
    setAddress(dentist.address || "");
    setNotes(dentist.notes || "");
    setError("");
    setModalOpen(true);
  };

  const handleSaveDentist = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const url = editingDentist
        ? `/api/dentists/${editingDentist.id}`
        : "/api/dentists";
      const method = editingDentist ? "PUT" : "POST";
      const normalizedPhone = phone.trim()
        ? formatDisplayArgentinaPhone(phone)
        : "";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          clinicName,
          phone: normalizedPhone,
          email,
          address,
          notes,
          initialBalance: !editingDentist ? Number(initialBalance) || 0 : 0,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al guardar los datos del dentista");
        setSaving(false);
        return;
      }

      await loadDentists();
      setModalOpen(false);
    } catch {
      setError("Error de conexión al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-sky-600" />
            Directorio de Dentistas y Cuentas
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Selecciona un profesional para cargarle productos, registrar pagos o
            editar sus datos
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="flex items-center justify-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl shadow-xs transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Cargar Nuevo Dentista
        </button>
      </div>

      {/* Buscador y Filtros */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre del dentista, consultorio o teléfono..."
            className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFilterStatus("ALL")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              filterStatus === "ALL"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Todos ({dentists.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus("DEBT")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              filterStatus === "DEBT"
                ? "bg-rose-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Con Saldo Adeudado ({dentists.filter((d) => d.balance > 0).length})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus("CLEAR")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              filterStatus === "CLEAR"
                ? "bg-emerald-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Al Día ({dentists.filter((d) => d.balance <= 0).length})
          </button>
        </div>
      </div>

      {/* Lista de Dentistas */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Cargando dentistas...
          </div>
        ) : filteredDentists.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-700">
              No hay dentistas que coincidan con tu búsqueda
            </p>
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-3 inline-flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Agregar Dentista
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredDentists.map((dentist) => (
              <Link
                key={dentist.id}
                href={`/dentistas/${dentist.id}`}
                className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition group"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-base text-slate-900 group-hover:text-sky-600 transition">
                      {dentist.fullName}
                    </h3>
                    {dentist.clinicName && (
                      <span className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full">
                        <Building className="w-3 h-3" />
                        {dentist.clinicName}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-1.5">
                    {dentist.phone && (
                      <span className="flex items-center gap-1 font-medium text-slate-600">
                        <Phone className="w-3.5 h-3.5 text-emerald-600" />
                        {formatDisplayArgentinaPhone(dentist.phone)}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      Últ. actividad: {formatDateTime(dentist.lastActivity)}
                    </span>
                    <span>Movimientos: {dentist.entriesCount}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
                  <div className="text-left sm:text-right">
                    <span className="text-[11px] text-slate-400 block">
                      Valor Adeudado
                    </span>
                    <div
                      className={`inline-flex items-center gap-1 text-base font-extrabold ${
                        dentist.balance > 0
                          ? "text-rose-600"
                          : "text-emerald-600"
                      }`}
                    >
                      {dentist.balance > 0 ? (
                        <AlertCircle className="w-4 h-4" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      <span>{formatCurrency(dentist.balance)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {dentist.phone && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const waPhone = formatArgentinaWhatsAppNumber(
                            dentist.phone
                          );
                          if (waPhone) {
                            const msg = `Hola *${dentist.fullName}*, te escribo desde el laboratorio dental. Tu saldo actual registrado es de *${formatCurrency(dentist.balance)}*.`;
                            window.open(
                              `https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`,
                              "_blank",
                              "noopener,noreferrer"
                            );
                          }
                        }}
                        className="p-2 text-emerald-600 hover:text-white hover:bg-emerald-600 bg-emerald-50 rounded-xl transition cursor-pointer"
                        title="Enviar WhatsApp directo (+54 9)"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => openEditModal(e, dentist)}
                      className="p-2 text-slate-500 hover:text-sky-600 hover:bg-sky-50 rounded-xl transition cursor-pointer"
                      title="Editar datos del dentista"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <div className="p-2 text-slate-400 group-hover:text-sky-600">
                      <ChevronRight className="w-5 h-5" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Modal Crear / Editar Dentista */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden my-8">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h2 className="font-bold text-sm sm:text-base">
                {editingDentist
                  ? "Editar Datos del Dentista"
                  : "Cargar Nuevo Dentista"}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDentist} className="p-5 space-y-3.5">
              {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nombre y Apellido del Dentista *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ej. Dra. Laura Martínez"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Consultorio / Clínica
                  </label>
                  <input
                    type="text"
                    value={clinicName}
                    onChange={(e) => setClinicName(e.target.value)}
                    placeholder="Ej. Odontología Centro"
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Teléfono / WhatsApp (Argentina +54 9)
                  </label>
                  <div className="flex">
                    <span className="inline-flex items-center px-2.5 text-xs font-bold text-slate-600 bg-slate-100 border border-r-0 border-slate-300 rounded-l-xl select-none">
                      +54 9
                    </span>
                    <input
                      type="text"
                      value={phone.replace(/^\+?54\s*9?\s*/, "")}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="11 2345-6789"
                      className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-r-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="dentista@correo.com"
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Dirección del Consultorio
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Ej. Av. Rivadavia 1234"
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              {!editingDentist && (
                <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3">
                  <label className="block text-xs font-bold text-amber-900 mb-1">
                    Saldo Anterior Acumulado ($) — Opcional
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={initialBalance}
                    onChange={(e) => setInitialBalance(e.target.value)}
                    placeholder="Ej. 120000 (dejar vacío o 0 si no debe nada previo)"
                    className="w-full px-3.5 py-2 text-sm font-bold bg-white border border-amber-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="block text-[11px] text-amber-800 mt-1">
                    Si el dentista ya tenía deuda previa anotada, se cargará
                    automáticamente como &quot;Saldo anterior acumulado&quot;.
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notas u Observaciones del Profesional
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Preferencias de oclusión, colores habituales, días de retiro..."
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white shadow-sm cursor-pointer"
                >
                  {saving
                    ? "Guardando..."
                    : editingDentist
                    ? "Guardar Cambios"
                    : "Registrar Dentista"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DentistasPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-slate-500">
          Cargando directorio de dentistas...
        </div>
      }
    >
      <DentistasContent />
    </Suspense>
  );
}
