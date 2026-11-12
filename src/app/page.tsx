"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  Tag,
  Wallet,
  ArrowRight,
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  Phone,
  Building,
} from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/format";

interface DentistSummary {
  id: string;
  fullName: string;
  clinicName: string;
  phone: string;
  totalCharges: number;
  totalPayments: number;
  balance: number;
  entriesCount: number;
  lastActivity: string;
}

export default function DashboardPage() {
  const [dentists, setDentists] = useState<DentistSummary[]>([]);
  const [productsCount, setProductsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/dentists").then((r) => r.json()),
      fetch("/api/products").then((r) => r.json()),
    ])
      .then(([dentistsData, productsData]) => {
        if (dentistsData?.dentists) setDentists(dentistsData.dentists);
        if (productsData?.products)
          setProductsCount(productsData.products.length);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalBalance = dentists.reduce((acc, d) => acc + d.balance, 0);
  const totalCharged = dentists.reduce((acc, d) => acc + d.totalCharges, 0);
  const totalCollected = dentists.reduce((acc, d) => acc + d.totalPayments, 0);
  const dentistsWithDebt = dentists.filter((d) => d.balance > 0);

  return (
    <div className="space-y-6">
      {/* Tarjeta Principal de Balance General */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-sky-900 rounded-2xl p-5 sm:p-6 text-white shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs uppercase tracking-wider text-sky-300 font-semibold flex items-center gap-1.5">
              <Wallet className="w-4 h-4" />
              Total por Cobrar (Saldo Adeudado)
            </span>
            <p className="text-3xl sm:text-4xl font-extrabold mt-1 tracking-tight">
              {loading ? "..." : formatCurrency(totalBalance)}
            </p>
            <p className="text-xs text-slate-300 mt-1">
              {dentistsWithDebt.length} de {dentists.length} dentistas registran
              saldo pendiente
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <Link
              href="/dentistas"
              className="bg-sky-500 hover:bg-sky-400 text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow transition"
            >
              <PlusCircle className="w-4 h-4" />
              Cargar Trabajo / Pago
            </Link>
            <Link
              href="/precios"
              className="bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-medium px-4 py-2.5 rounded-xl flex items-center gap-2 transition"
            >
              <Tag className="w-4 h-4" />
              Lista de Precios ({productsCount})
            </Link>
          </div>
        </div>

        {/* Sub-métricas */}
        <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-white/10 text-xs">
          <div>
            <span className="text-slate-400 block">Trabajos Cargados</span>
            <span className="font-bold text-sm sm:text-base text-white">
              {formatCurrency(totalCharged)}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block">Pagos Recibidos</span>
            <span className="font-bold text-sm sm:text-base text-emerald-400">
              {formatCurrency(totalCollected)}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block">Dentistas Activos</span>
            <span className="font-bold text-sm sm:text-base text-white">
              {dentists.length}
            </span>
          </div>
        </div>
      </div>

      {/* Accesos Rápidos Móviles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Link
          href="/dentistas?new=1"
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-sky-400 transition flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="font-semibold text-sm block text-slate-900">
              Nuevo Dentista
            </span>
            <span className="text-xs text-slate-500">
              Registrar cliente y datos
            </span>
          </div>
        </Link>

        <Link
          href="/precios?new=1"
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-sky-400 transition flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Tag className="w-5 h-5" />
          </div>
          <div>
            <span className="font-semibold text-sm block text-slate-900">
              Nuevo Producto
            </span>
            <span className="text-xs text-slate-500">
              Agregar a lista de precios
            </span>
          </div>
        </Link>

        <Link
          href="/precios"
          className="col-span-2 sm:col-span-1 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-sky-400 transition flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <span className="font-semibold text-sm block text-slate-900">
              Actualizar Precios
            </span>
            <span className="text-xs text-slate-500">
              Editar catálogo o ajustar %
            </span>
          </div>
        </Link>
      </div>

      {/* Estado de Cuentas de Dentistas */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:px-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-base text-slate-900">
              Cuentas Corrientes de Dentistas
            </h2>
            <p className="text-xs text-slate-500">
              Toca un dentista para cargar productos, registrar pagos o editar
              su historial
            </p>
          </div>
          <Link
            href="/dentistas"
            className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1"
          >
            Ver todos
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Cargando estado de cuentas...
          </div>
        ) : dentists.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-700">
              Aún no has cargado ningún dentista
            </p>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Agrega tu primer dentista para asignarle prótesis/trabajos y
              llevar su saldo adeudado.
            </p>
            <Link
              href="/dentistas?new=1"
              className="inline-flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition"
            >
              <PlusCircle className="w-4 h-4" />
              Cargar Primer Dentista
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {dentists.map((dentist) => (
              <Link
                key={dentist.id}
                href={`/dentistas/${dentist.id}`}
                className="p-4 sm:px-6 flex items-center justify-between gap-3 hover:bg-slate-50 transition"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 truncate">
                      {dentist.fullName}
                    </span>
                    {dentist.clinicName && (
                      <span className="hidden sm:inline-flex items-center gap-1 text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                        <Building className="w-3 h-3" />
                        {dentist.clinicName}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
                    {dentist.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {dentist.phone}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Últ. mov: {formatDateTime(dentist.lastActivity)}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div
                    className={`inline-flex items-center gap-1 text-sm font-bold px-2.5 py-1 rounded-xl ${
                      dentist.balance > 0
                        ? "bg-rose-50 text-rose-700 border border-rose-200"
                        : dentist.balance < 0
                        ? "bg-sky-50 text-sky-700 border border-sky-200"
                        : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    }`}
                  >
                    {dentist.balance > 0 ? (
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    )}
                    <span>{formatCurrency(dentist.balance)}</span>
                  </div>
                  <span className="block text-[11px] text-slate-400 mt-0.5">
                    {dentist.balance > 0
                      ? "Saldo adeudado"
                      : dentist.balance < 0
                      ? "Saldo a favor"
                      : "Al día"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
