"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Tag,
  Plus,
  Search,
  Pencil,
  Trash2,
  Percent,
  X,
  Clock,
  Check,
  FileDown,
} from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { downloadPriceListPdf } from "@/lib/pdf-generator";

interface Product {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

const SUGGESTED_CATEGORIES = [
  "Prótesis Fija",
  "Prótesis Removible",
  "Cromo Cobalto",
  "Implantes",
  "Ortodoncia y Placas",
  "Provisorios",
  "Reparaciones",
  "General",
];

function PreciosContent() {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("TODAS");

  // Modal Crear / Editar Producto
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Prótesis Fija");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Modal Ajuste Masivo de Precios
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkPercentage, setBulkPercentage] = useState("10");
  const [bulkCategory, setBulkCategory] = useState("TODAS");
  const [bulkRoundTo, setBulkRoundTo] = useState("100");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [labInfo, setLabInfo] = useState<{
    name: string;
    labName: string;
  }>({ name: "", labName: "Laboratorio Dental" });

  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/products");
      const data = await res.json();
      if (data?.products) setProducts(data.products);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
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
    if (searchParams.get("new") === "1") {
      openCreateModal();
    }
  }, [searchParams]);

  const categories = useMemo(() => {
    const set = new Set<string>(SUGGESTED_CATEGORIES);
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory =
        selectedCategory === "TODAS" || p.category === selectedCategory;
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, search]);

  const openCreateModal = () => {
    setEditingProduct(null);
    setName("");
    setCategory("Prótesis Fija");
    setDescription("");
    setPrice("");
    setError("");
    setModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setName(product.name);
    setCategory(product.category);
    setDescription(product.description || "");
    setPrice(String(product.price));
    setError("");
    setModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const url = editingProduct
        ? `/api/products/${editingProduct.id}`
        : "/api/products";
      const method = editingProduct ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          category,
          description,
          price: Number(price),
          active: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al guardar el producto");
        setSaving(false);
        return;
      }

      await loadProducts();
      setModalOpen(false);
      setFeedback(
        editingProduct
          ? "Producto y precio actualizados correctamente"
          : "Producto agregado a la lista de precios"
      );
      setTimeout(() => setFeedback(""), 3500);
    } catch {
      setError("Error de conexión al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    if (
      !window.confirm(
        `¿Seguro que deseas eliminar "${product.name}" de la lista de precios? Los trabajos ya cargados a dentistas conservarán su registro histórico.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setProducts((prev) => prev.filter((p) => p.id !== product.id));
        setFeedback("Producto eliminado del catálogo");
        setTimeout(() => setFeedback(""), 3000);
      }
    } catch {
      // ignore
    }
  };

  const handleBulkAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    setBulkSaving(true);
    setError("");

    try {
      const res = await fetch("/api/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          percentage: Number(bulkPercentage),
          category: bulkCategory,
          roundTo: Number(bulkRoundTo),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo aplicar el ajuste");
        setBulkSaving(false);
        return;
      }

      if (data.products) setProducts(data.products);
      setBulkModalOpen(false);
      setFeedback(data.message || "Precios actualizados");
      setTimeout(() => setFeedback(""), 4000);
    } catch {
      setError("Error al ajustar precios");
    } finally {
      setBulkSaving(false);
    }
  };

  const handleGeneratePdf = () => {
    const listToExport =
      filteredProducts.length > 0 ? filteredProducts : products;
    downloadPriceListPdf({
      labName: labInfo.labName,
      protesistaName: labInfo.name,
      categoryFilter: selectedCategory,
      products: listToExport,
    });
    setFeedback(
      `PDF generado con ${listToExport.length} producto(s) de la lista de precios`
    );
    setTimeout(() => setFeedback(""), 3500);
  };

  return (
    <div className="space-y-5">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
            <Tag className="w-5 h-5 text-sky-600" />
            Panel de Lista de Precios y Productos
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Carga nuevos trabajos protésicos, modifica sus precios o descarga la
            lista en PDF
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleGeneratePdf}
            disabled={products.length === 0}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold px-3.5 py-2.5 rounded-xl shadow-xs transition cursor-pointer"
            title="Descargar lista de precios en formato PDF"
          >
            <FileDown className="w-4 h-4" />
            Generar PDF
          </button>
          <button
            type="button"
            onClick={() => {
              setError("");
              setBulkModalOpen(true);
            }}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3.5 py-2.5 rounded-xl transition cursor-pointer"
          >
            <Percent className="w-4 h-4 text-amber-600" />
            Ajuste Masivo %
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nuevo Producto
          </button>
        </div>
      </div>

      {feedback && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Buscador y Filtros */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar prótesis, corona, cromo, reparación..."
            className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSelectedCategory("TODAS")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              selectedCategory === "TODAS"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Todas ({products.length})
          </button>
          {categories.map((cat) => {
            const count = products.filter((p) => p.category === cat).length;
            if (count === 0 && selectedCategory !== cat) return null;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  selectedCategory === cat
                    ? "bg-sky-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Lista de Productos */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Cargando lista de precios...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-8 text-center">
            <Tag className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-700">
              No se encontraron productos
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Puedes agregar un nuevo producto o trabajo con su precio usando el
              botón superior.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-semibold bg-sky-50 text-sky-700 px-2.5 py-0.5 rounded-full border border-sky-200">
                      {product.category}
                    </span>
                    <h3 className="font-bold text-sm sm:text-base text-slate-900">
                      {product.name}
                    </h3>
                  </div>
                  {product.description && (
                    <p className="text-xs text-slate-500 mt-1">
                      {product.description}
                    </p>
                  )}
                  <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Actualizado: {formatDateTime(product.updatedAt)}
                  </p>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
                  <div className="text-left sm:text-right">
                    <span className="text-xs text-slate-400 block">
                      Precio unitario
                    </span>
                    <span className="text-base sm:text-lg font-extrabold text-slate-900">
                      {formatCurrency(product.price)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEditModal(product)}
                      className="flex items-center gap-1 bg-slate-100 hover:bg-sky-600 hover:text-white text-slate-700 text-xs font-semibold px-3 py-2 rounded-xl transition cursor-pointer"
                      title="Modificar producto o precio"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteProduct(product)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                      title="Eliminar producto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Crear / Editar Producto */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h2 className="font-bold text-sm sm:text-base">
                {editingProduct
                  ? "Editar Producto y Precio"
                  : "Nuevo Producto en Lista de Precios"}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-5 space-y-4">
              {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nombre del Producto / Trabajo Protésico *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Corona de Zirconio, Cromo Cobalto..."
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Categoría *
                  </label>
                  <input
                    type="text"
                    required
                    list="categories-list"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Categoría"
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <datalist id="categories-list">
                    {SUGGESTED_CATEGORIES.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Precio Unitario ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="Ej. 55000"
                    className="w-full px-3.5 py-2.5 text-sm font-bold border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Descripción o Detalles (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Especificaciones, material, tiempos..."
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
                    : editingProduct
                    ? "Guardar Cambios"
                    : "Crear Producto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Ajuste Porcentual Masivo */}
      {bulkModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h2 className="font-bold text-sm sm:text-base flex items-center gap-2">
                <Percent className="w-4 h-4 text-amber-400" />
                Actualizar Lista de Precios por Porcentaje
              </h2>
              <button
                type="button"
                onClick={() => setBulkModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBulkAdjustment} className="p-5 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Aumenta o disminuye automáticamente los precios del catálogo.{" "}
                <strong>Importante:</strong> Esto actualiza la lista de precios
                para nuevos trabajos, sin alterar las deudas históricas ya
                cargadas.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Categoría a actualizar
                </label>
                <select
                  value={bulkCategory}
                  onChange={(e) => setBulkCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="TODAS">Toda la lista de precios</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      Solo categoría: {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Porcentaje (%)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={bulkPercentage}
                    onChange={(e) => setBulkPercentage(e.target.value)}
                    placeholder="Ej. 15"
                    className="w-full px-3.5 py-2.5 text-sm font-bold border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Redondear a múltiplo de
                  </label>
                  <select
                    value={bulkRoundTo}
                    onChange={(e) => setBulkRoundTo(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="0">Sin redondeo</option>
                    <option value="100">$100</option>
                    <option value="500">$500</option>
                    <option value="1000">$1.000</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBulkModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={bulkSaving}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow-sm cursor-pointer"
                >
                  {bulkSaving ? "Actualizando..." : "Aplicar Ajuste"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PreciosPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-slate-500">
          Cargando panel de precios...
        </div>
      }
    >
      <PreciosContent />
    </Suspense>
  );
}
