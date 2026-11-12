"use client";

import React, { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building,
  Phone,
  Mail,
  MapPin,
  Pencil,
  Trash2,
  PlusCircle,
  Banknote,
  Clock,
  Calendar,
  FileText,
  X,
  Share2,
  Check,
  Tag,
  MessageCircle,
  FileDown,
} from "lucide-react";
import {
  formatArgentinaWhatsAppNumber,
  formatCurrency,
  formatDateTime,
  formatDisplayArgentinaPhone,
  toLocalDateTimeInputValue,
} from "@/lib/format";
import { downloadDentistStatementPdf } from "@/lib/pdf-generator";

interface ProductOption {
  id: string;
  name: string;
  category: string;
  price: number;
}

interface LedgerEntry {
  id: string;
  dentistId: string;
  productId: string | null;
  type: "CHARGE" | "PAYMENT";
  concept: string;
  patientOrNotes: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
}

interface DentistDetail {
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
  entries: LedgerEntry[];
}

export default function DentistDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [dentist, setDentist] = useState<DentistDetail | null>(null);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<"ALL" | "CHARGE" | "PAYMENT">(
    "ALL"
  );
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [labInfo, setLabInfo] = useState<{
    name: string;
    labName: string;
  }>({ name: "", labName: "Laboratorio Dental" });

  // Modal Crear / Editar Movimiento (Trabajo o Pago)
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<LedgerEntry | null>(null);
  const [entryType, setEntryType] = useState<"CHARGE" | "PAYMENT">("CHARGE");
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [concept, setConcept] = useState("");
  const [patientOrNotes, setPatientOrNotes] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [amount, setAmount] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [savingEntry, setSavingEntry] = useState(false);
  const [entryError, setEntryError] = useState("");

  // Modal Editar Datos del Dentista
  const [dentistModalOpen, setDentistModalOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [savingDentist, setSavingDentist] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dentistRes, productsRes] = await Promise.all([
        fetch(`/api/dentists/${id}`),
        fetch("/api/products"),
      ]);

      if (dentistRes.status === 404) {
        router.replace("/dentistas");
        return;
      }

      const dentistData = await dentistRes.json();
      const productsData = await productsRes.json();

      if (dentistData?.dentist) setDentist(dentistData.dentist);
      if (productsData?.products) setProducts(productsData.products);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then((data) => {
        if (data?.user) {
          setLabInfo({
            name: data.user.name || "",
            labName: data.user.labName || "Laboratorio Dental",
          });
        }
      })
      .catch(() => {});
  }, [id]);

  // Recalcular monto total automáticamente cuando es un trabajo (CHARGE) y cambia cantidad o precio unitario
  const handleQuantityOrUnitPriceChange = (
    newQtyStr: string,
    newUnitStr: string
  ) => {
    setQuantity(newQtyStr);
    setUnitPrice(newUnitStr);
    const q = Number(newQtyStr) || 1;
    const u = Number(newUnitStr) || 0;
    if (u >= 0) {
      setAmount(String(Math.round(q * u * 100) / 100));
    }
  };

  const handleSelectProduct = (prodId: string) => {
    setSelectedProductId(prodId);
    if (!prodId) return;
    const found = products.find((p) => p.id === prodId);
    if (found) {
      setConcept(found.name);
      const q = Number(quantity) || 1;
      setUnitPrice(String(found.price));
      setAmount(String(Math.round(q * found.price * 100) / 100));
    }
  };

  const openChargeModal = () => {
    setEditingEntry(null);
    setEntryType("CHARGE");
    setSelectedProductId("");
    setConcept("");
    setPatientOrNotes("");
    setQuantity("1");
    setUnitPrice("");
    setAmount("");
    setOccurredAt(toLocalDateTimeInputValue(new Date()));
    setEntryError("");
    setEntryModalOpen(true);
  };

  const openPaymentModal = () => {
    setEditingEntry(null);
    setEntryType("PAYMENT");
    setSelectedProductId("");
    setConcept("Pago a cuenta / Entrega");
    setPatientOrNotes("");
    setQuantity("1");
    setUnitPrice("");
    setAmount(dentist && dentist.balance > 0 ? String(dentist.balance) : "");
    setOccurredAt(toLocalDateTimeInputValue(new Date()));
    setEntryError("");
    setEntryModalOpen(true);
  };

  const openEditEntryModal = (entry: LedgerEntry) => {
    setEditingEntry(entry);
    setEntryType(entry.type);
    setSelectedProductId(entry.productId || "");
    setConcept(entry.concept);
    setPatientOrNotes(entry.patientOrNotes || "");
    setQuantity(String(entry.quantity || 1));
    setUnitPrice(String(entry.unitPrice || entry.amount));
    setAmount(String(entry.amount));
    setOccurredAt(toLocalDateTimeInputValue(entry.occurredAt));
    setEntryError("");
    setEntryModalOpen(true);
  };

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingEntry(true);
    setEntryError("");

    try {
      const url = editingEntry
        ? `/api/entries/${editingEntry.id}`
        : `/api/dentists/${id}/entries`;
      const method = editingEntry ? "PUT" : "POST";

      const isoDate = occurredAt
        ? new Date(occurredAt).toISOString()
        : new Date().toISOString();

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: entryType,
          productId:
            entryType === "CHARGE" && selectedProductId
              ? selectedProductId
              : null,
          concept,
          patientOrNotes,
          quantity: entryType === "CHARGE" ? Number(quantity) || 1 : 1,
          unitPrice:
            entryType === "CHARGE"
              ? Number(unitPrice) || Number(amount)
              : Number(amount),
          amount: Number(amount),
          occurredAt: isoDate,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setEntryError(data.error || "No se pudo guardar el movimiento");
        setSavingEntry(false);
        return;
      }

      await loadData();
      setEntryModalOpen(false);
    } catch {
      setEntryError("Error de conexión al guardar");
    } finally {
      setSavingEntry(false);
    }
  };

  const handleDeleteEntry = async (entry: LedgerEntry) => {
    if (
      !window.confirm(
        `¿Eliminar "${entry.concept}" por ${formatCurrency(
          entry.amount
        )}? El saldo adeudado se recalculará automáticamente.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/entries/${entry.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await loadData();
      }
    } catch {
      // ignore
    }
  };

  const openEditDentistModal = () => {
    if (!dentist) return;
    setFullName(dentist.fullName);
    setClinicName(dentist.clinicName || "");
    setPhone(dentist.phone || "");
    setEmail(dentist.email || "");
    setAddress(dentist.address || "");
    setNotes(dentist.notes || "");
    setDentistModalOpen(true);
  };

  const handleSaveDentist = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingDentist(true);
    const normalizedPhone = phone.trim()
      ? formatDisplayArgentinaPhone(phone)
      : "";
    try {
      const res = await fetch(`/api/dentists/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          clinicName,
          phone: normalizedPhone,
          email,
          address,
          notes,
        }),
      });
      if (res.ok) {
        await loadData();
        setDentistModalOpen(false);
      }
    } finally {
      setSavingDentist(false);
    }
  };

  const handleDeleteDentist = async () => {
    if (!dentist) return;
    if (
      !window.confirm(
        `¿Estás seguro de eliminar a "${dentist.fullName}" y todo su historial de trabajos y pagos? Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }

    const res = await fetch(`/api/dentists/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.replace("/dentistas");
    }
  };

  const buildSummaryMessage = () => {
    if (!dentist) return "";
    return `Hola *${dentist.fullName}*, te escribo desde el laboratorio dental. Tu total adeudado actual es de *${formatCurrency(dentist.balance)}*.`;
  };

  const handleCopySummary = async () => {
    if (!dentist) return;
    const text = buildSummaryMessage();
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 3000);
    } catch {
      // ignore
    }
  };

  const handleSendWhatsApp = () => {
    if (!dentist) return;
    const waPhone = formatArgentinaWhatsAppNumber(dentist.phone);
    if (!waPhone || waPhone.length < 10) {
      window.alert(
        "Este dentista aún no tiene un número de teléfono válido cargado. Ingresa su número para enviarle WhatsApp directo."
      );
      openEditDentistModal();
      return;
    }

    const text = buildSummaryMessage();
    const url = `https://wa.me/${waPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleDownloadStatementPdf = () => {
    if (!dentist) return;
    downloadDentistStatementPdf({
      labName: labInfo.labName,
      protesistaName: labInfo.name,
      dentist: {
        fullName: dentist.fullName,
        clinicName: dentist.clinicName,
        phone: dentist.phone,
        email: dentist.email,
        totalCharges: dentist.totalCharges,
        totalPayments: dentist.totalPayments,
        balance: dentist.balance,
      },
      entries: dentist.entries,
    });
  };

  // Calcular saldo acumulado histórico para mostrar en cada fila si se desea, y filtrar
  const entriesWithRunningBalance = useMemo(() => {
    if (!dentist) return [];
    // Ordenamos cronológicamente de más antiguo a más reciente para calcular saldo progresivo
    const chronological = [...dentist.entries].sort(
      (a, b) =>
        new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
    );
    let running = 0;
    const mapRunning = new Map<string, number>();
    for (const item of chronological) {
      if (item.type === "CHARGE") running += item.amount;
      else running -= item.amount;
      mapRunning.set(item.id, Math.round(running * 100) / 100);
    }

    return dentist.entries
      .filter((e) => filterType === "ALL" || e.type === filterType)
      .map((e) => ({
        ...e,
        runningBalance: mapRunning.get(e.id) ?? 0,
      }));
  }, [dentist, filterType]);

  if (loading && !dentist) {
    return (
      <div className="p-8 text-center text-sm text-slate-500">
        Cargando cuenta corriente del dentista...
      </div>
    );
  }

  if (!dentist) return null;

  return (
    <div className="space-y-5">
      {/* Navegación superior */}
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/dentistas"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-2xs"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a Dentistas
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSendWhatsApp}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 rounded-xl shadow-xs transition cursor-pointer"
            title="Enviar mensaje por WhatsApp (+54 9)"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Enviar WhatsApp</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadStatementPdf}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 px-3.5 py-2 rounded-xl shadow-xs transition cursor-pointer"
            title="Descargar PDF con el listado detallado de trabajos pedidos y pagos"
          >
            <FileDown className="w-4 h-4" />
            <span>Generar PDF Detalle</span>
          </button>

          <button
            type="button"
            onClick={handleCopySummary}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-2xs cursor-pointer"
          >
            {copiedSummary ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">Resumen Copiado</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5 text-sky-600" />
                <span>Copiar Resumen</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={openEditDentistModal}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-2xs cursor-pointer"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>Editar Dentista</span>
          </button>

          <button
            type="button"
            onClick={handleDeleteDentist}
            className="p-2 text-slate-400 hover:text-rose-600 bg-white rounded-xl border border-slate-200 shadow-2xs cursor-pointer"
            title="Eliminar dentista"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Ficha de Datos del Dentista y Saldo Adeudado */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                {dentist.fullName}
              </h1>
              {dentist.clinicName && (
                <span className="inline-flex items-center gap-1 text-xs font-medium bg-slate-100 text-slate-700 px-3 py-1 rounded-full">
                  <Building className="w-3.5 h-3.5 text-slate-500" />
                  {dentist.clinicName}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600">
              {dentist.phone && (
                <button
                  type="button"
                  onClick={handleSendWhatsApp}
                  className="flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-semibold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 cursor-pointer"
                  title="Abrir chat de WhatsApp con este dentista"
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  {formatDisplayArgentinaPhone(dentist.phone)}
                </button>
              )}
              {dentist.email && (
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-sky-600" />
                  {dentist.email}
                </span>
              )}
              {dentist.address && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-sky-600" />
                  {dentist.address}
                </span>
              )}
            </div>

            {dentist.notes && (
              <p className="text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 max-w-xl">
                <strong className="text-slate-700">Notas:</strong>{" "}
                {dentist.notes}
              </p>
            )}
          </div>

          {/* Recuadro de Valor Adeudado */}
          <div
            className={`p-4 sm:p-5 rounded-2xl border text-left md:text-right shrink-0 min-w-[230px] ${
              dentist.balance > 0
                ? "bg-rose-50/70 border-rose-200"
                : "bg-emerald-50/70 border-emerald-200"
            }`}
          >
            <span
              className={`text-xs font-bold uppercase tracking-wider block ${
                dentist.balance > 0 ? "text-rose-700" : "text-emerald-700"
              }`}
            >
              Valor Total Adeudado
            </span>
            <p
              className={`text-2xl sm:text-3xl font-black mt-0.5 ${
                dentist.balance > 0 ? "text-rose-700" : "text-emerald-700"
              }`}
            >
              {formatCurrency(dentist.balance)}
            </p>
            <div className="flex md:justify-end gap-3 mt-2 pt-2 border-t border-slate-200/70 text-[11px] text-slate-600">
              <span>
                Trabajos: <strong>{formatCurrency(dentist.totalCharges)}</strong>
              </span>
              <span>
                Pagos: <strong>{formatCurrency(dentist.totalPayments)}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Botones Principales de Acción para el Protesista */}
        <div className="bg-slate-50 px-5 py-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={openChargeModal}
            className="w-full bg-sky-600 hover:bg-sky-500 text-white font-semibold py-3 px-4 rounded-xl text-sm shadow-xs flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <PlusCircle className="w-5 h-5" />
            Cargar Producto / Trabajo Protésico
          </button>

          <button
            type="button"
            onClick={openPaymentModal}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 px-4 rounded-xl text-sm shadow-xs flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Banknote className="w-5 h-5" />
            Registrar Pago / Entrega
          </button>
        </div>
      </div>

      {/* Historial de Actividades con Fecha y Hora y Edición Total */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:px-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-sky-600" />
              Historial de Trabajos y Pagos (Con Fecha y Hora)
            </h2>
            <p className="text-xs text-slate-500">
              Cada movimiento registra fecha y hora exacta y puede editarse en
              cualquier momento
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFilterType("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                filterType === "ALL"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Todos ({dentist.entries.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType("CHARGE")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                filterType === "CHARGE"
                  ? "bg-sky-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Trabajos (
              {dentist.entries.filter((e) => e.type === "CHARGE").length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType("PAYMENT")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                filterType === "PAYMENT"
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Pagos (
              {dentist.entries.filter((e) => e.type === "PAYMENT").length})
            </button>
          </div>
        </div>

        {entriesWithRunningBalance.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-700">
              No hay movimientos registrados en esta vista
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Usa los botones superiores para cargar un producto/trabajo o
              registrar un pago.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {entriesWithRunningBalance.map((entry) => {
              const isCharge = entry.type === "CHARGE";
              return (
                <div
                  key={entry.id}
                  className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                          isCharge
                            ? "bg-sky-100 text-sky-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {isCharge ? "+ Trabajo / Producto" : "- Pago Recibido"}
                      </span>

                      <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {formatDateTime(entry.occurredAt)}
                      </span>
                    </div>

                    <h3 className="font-bold text-sm sm:text-base text-slate-900">
                      {entry.concept}
                      {isCharge && entry.quantity > 1 && (
                        <span className="ml-2 text-xs font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md">
                          {entry.quantity} u. x {formatCurrency(entry.unitPrice)}
                        </span>
                      )}
                    </h3>

                    {entry.patientOrNotes && (
                      <p className="text-xs text-slate-600">
                        {entry.patientOrNotes}
                      </p>
                    )}

                    {entry.updatedAt !== entry.createdAt && (
                      <p className="text-[10px] text-slate-400">
                        Editado última vez: {formatDateTime(entry.updatedAt)}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
                    <div className="text-left sm:text-right">
                      <span
                        className={`text-base sm:text-lg font-extrabold block ${
                          isCharge ? "text-rose-600" : "text-emerald-600"
                        }`}
                      >
                        {isCharge ? "+" : "-"}
                        {formatCurrency(entry.amount)}
                      </span>
                      <span className="text-[11px] text-slate-400 block">
                        Saldo tras mov:{" "}
                        <strong className="text-slate-600">
                          {formatCurrency(entry.runningBalance)}
                        </strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditEntryModal(entry)}
                        className="flex items-center gap-1 bg-slate-100 hover:bg-sky-600 hover:text-white text-slate-700 text-xs font-semibold px-3 py-2 rounded-xl transition cursor-pointer"
                        title="Editar producto, monto o fecha/hora"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Editar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteEntry(entry)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                        title="Eliminar movimiento"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Cargar / Editar Movimiento (Producto o Pago) */}
      {entryModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden my-8">
            <div
              className={`px-5 py-4 text-white flex items-center justify-between ${
                entryType === "CHARGE" ? "bg-sky-700" : "bg-emerald-700"
              }`}
            >
              <h2 className="font-bold text-sm sm:text-base">
                {editingEntry
                  ? "Editar Movimiento"
                  : entryType === "CHARGE"
                  ? "Cargar Producto / Trabajo al Dentista"
                  : "Registrar Pago del Dentista"}
              </h2>
              <button
                type="button"
                onClick={() => setEntryModalOpen(false)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEntry} className="p-5 space-y-4">
              {entryError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs">
                  {entryError}
                </div>
              )}

              {/* Permite cambiar el tipo al editar si se cargó por error como pago/trabajo */}
              {editingEntry && (
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setEntryType("CHARGE")}
                    className={`py-1.5 text-xs font-semibold rounded-lg cursor-pointer ${
                      entryType === "CHARGE"
                        ? "bg-sky-600 text-white"
                        : "text-slate-600"
                    }`}
                  >
                    Trabajo / Producto (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEntryType("PAYMENT")}
                    className={`py-1.5 text-xs font-semibold rounded-lg cursor-pointer ${
                      entryType === "PAYMENT"
                        ? "bg-emerald-600 text-white"
                        : "text-slate-600"
                    }`}
                  >
                    Pago Recibido (-)
                  </button>
                </div>
              )}

              {entryType === "CHARGE" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5 text-sky-600" />
                    Seleccionar de la Lista de Precios
                  </label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => handleSelectProduct(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50"
                  >
                    <option value="">
                      -- Elegir producto del catálogo (o escribir abajo) --
                    </option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {formatCurrency(p.price)} ({p.category})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {entryType === "CHARGE"
                    ? "Nombre del Producto / Trabajo *"
                    : "Concepto del Pago *"}
                </label>
                <input
                  type="text"
                  required
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                  placeholder={
                    entryType === "CHARGE"
                      ? "Ej. Corona de Zirconio"
                      : "Ej. Pago en efectivo / Transferencia"
                  }
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {entryType === "CHARGE" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Cantidad (Piezas/Unid.)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      required
                      value={quantity}
                      onChange={(e) =>
                        handleQuantityOrUnitPriceChange(
                          e.target.value,
                          unitPrice
                        )
                      }
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Precio Unitario ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={unitPrice}
                      onChange={(e) =>
                        handleQuantityOrUnitPriceChange(
                          quantity,
                          e.target.value
                        )
                      }
                      placeholder="0"
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {entryType === "CHARGE"
                    ? "Monto Total del Trabajo ($) *"
                    : "Monto Abonado ($) *"}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Ej. 65000"
                  className="w-full px-3.5 py-2.5 text-base font-extrabold border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {entryType === "CHARGE"
                    ? "Paciente / Pieza Dental / Color / Notas"
                    : "Método de Pago / Comprobante / Notas"}
                </label>
                <input
                  type="text"
                  value={patientOrNotes}
                  onChange={(e) => setPatientOrNotes(e.target.value)}
                  placeholder={
                    entryType === "CHARGE"
                      ? "Ej. Paciente Juan Pérez - Pieza 24 - Color A2"
                      : "Ej. Transferencia MercadoPago / Efectivo"
                  }
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Fecha y Hora de la Actividad (Editable) *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={occurredAt}
                  onChange={(e) => setOccurredAt(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEntryModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEntry}
                  className={`px-5 py-2.5 rounded-xl text-xs font-semibold text-white shadow-sm cursor-pointer ${
                    entryType === "CHARGE"
                      ? "bg-sky-600 hover:bg-sky-500"
                      : "bg-emerald-600 hover:bg-emerald-500"
                  }`}
                >
                  {savingEntry
                    ? "Guardando..."
                    : editingEntry
                    ? "Guardar Cambios"
                    : entryType === "CHARGE"
                    ? "Cargar Trabajo"
                    : "Registrar Pago"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Datos del Dentista */}
      {dentistModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden my-8">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h2 className="font-bold text-sm sm:text-base">
                Editar Datos del Dentista
              </h2>
              <button
                type="button"
                onClick={() => setDentistModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDentist} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nombre y Apellido del Dentista *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
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
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Dirección
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notas
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDentistModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingDentist}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white shadow-sm cursor-pointer"
                >
                  {savingDentist ? "Guardando..." : "Guardar Datos"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
