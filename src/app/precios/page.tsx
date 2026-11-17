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
  FolderPlus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Layers,
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

interface CategoryItem {
  id: string;
  name: string;
  sortOrder: number;
  productsCount: number;
}

type SortMode =
  | "CATEGORY_ORDER"
  | "CATEGORY_AZ"
  | "PRICE_ASC"
  | "PRICE_DESC"
  | "NAME_AZ";

function PreciosContent() {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categoriesList, setCategoriesList] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("TODAS");
  const [sortBy, setSortBy] = useState<SortMode>("CATEGORY_ORDER");

  // Modal Crear / Editar Producto
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [creatingNewCategoryInline, setCreatingNewCategoryInline] =
    useState(false);
  const [newInlineCategoryName, setNewInlineCategoryName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Modal Gestionar Categorías (Crear, Listar, Renombrar, Ordenar, Eliminar)
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState("");
  const [catSaving, setCatSaving] = useState(false);
  const [catError, setCatError] = useState("");

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

  const loadData = async () => {
    setLoading(true);
    try {
      const [prodRes, catRes] = await Promise.all([
        fetch("/api/products"),
        fetch("/api/categories"),
      ]);
      const [prodData, catData] = await Promise.all([
        prodRes.json(),
        catRes.json(),
      ]);
      if (prodData?.products) setProducts(prodData.products);
      if (catData?.categories) setCategoriesList(catData.categories);
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
    if (searchParams.get("new") === "1") {
      openCreateModal();
    }
  }, [searchParams]);

  // Lista ordenada de nombres de categorías según sortOrder
  const categoryOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    categoriesList.forEach((c, idx) => {
      map.set(c.name, c.sortOrder ?? idx + 1);
    });
    return map;
  }, [categoriesList]);

  const allCategoryNames = useMemo(() => {
    const names = categoriesList.map((c) => c.name);
    for (const p of products) {
      if (p.category && !names.includes(p.category)) {
        names.push(p.category);
      }
    }
    return names;
  }, [categoriesList, products]);

  // Productos filtrados y ordenados según el modo elegido
  const filteredAndSortedProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = products.filter((p) => {
      const matchesCategory =
        selectedCategory === "TODAS" || p.category === selectedCategory;
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === "CATEGORY_ORDER") {
        const orderA = categoryOrderMap.get(a.category) ?? 999;
        const orderB = categoryOrderMap.get(b.category) ?? 999;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name, "es");
      }
      if (sortBy === "CATEGORY_AZ") {
        const cmp = a.category.localeCompare(b.category, "es");
        if (cmp !== 0) return cmp;
        return a.name.localeCompare(b.name, "es");
      }
      if (sortBy === "PRICE_ASC") {
        return a.price - b.price;
      }
      if (sortBy === "PRICE_DESC") {
        return b.price - a.price;
      }
      return a.name.localeCompare(b.name, "es");
    });
  }, [products, selectedCategory, search, sortBy, categoryOrderMap]);

  // Agrupación visual por categorías cuando se ordena por categoría
  const groupedByCategory = useMemo(() => {
    const groups: Array<{ category: string; items: Product[] }> = [];
    const map = new Map<string, Product[]>();
    for (const prod of filteredAndSortedProducts) {
      const cat = prod.category || "General";
      let arr = map.get(cat);
      if (!arr) {
        arr = [];
        map.set(cat, arr);
        groups.push({ category: cat, items: arr });
      }
      arr.push(prod);
    }
    return groups;
  }, [filteredAndSortedProducts]);

  const openCreateModal = (presetCategory?: string) => {
    setEditingProduct(null);
    setName("");
    const defaultCat =
      presetCategory ||
      (selectedCategory !== "TODAS"
        ? selectedCategory
        : allCategoryNames[0] || "Removible de acrílico");
    setCategory(defaultCat);
    setCreatingNewCategoryInline(false);
    setNewInlineCategoryName("");
    setDescription("");
    setPrice("");
    setError("");
    setModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setName(product.name);
    setCategory(product.category);
    setCreatingNewCategoryInline(false);
    setNewInlineCategoryName("");
    setDescription(product.description || "");
    setPrice(String(product.price));
    setError("");
    setModalOpen(true);
  };

  const handleSaveInlineCategory = async () => {
    const trimmed = newInlineCategoryName.trim();
    if (trimmed.length < 2) {
      setError("Escribe al menos 2 letras para la nueva categoría");
      return;
    }
    setError("");
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok && res.status !== 409) {
        setError(data.error || "No se pudo crear la categoría");
        return;
      }
      await loadData();
      setCategory(trimmed);
      setCreatingNewCategoryInline(false);
      setNewInlineCategoryName("");
    } catch {
      setError("Error al crear la categoría");
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    const finalCategory = creatingNewCategoryInline
      ? newInlineCategoryName.trim()
      : category.trim();

    if (!finalCategory) {
      setError("Selecciona o escribe una categoría");
      setSaving(false);
      return;
    }

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
          category: finalCategory,
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

      await loadData();
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
        await loadData();
        setFeedback("Producto eliminado del catálogo");
        setTimeout(() => setFeedback(""), 3000);
      }
    } catch {
      // ignore
    }
  };

  // Funciones del Gestor de Categorías
  const handleCreateCategoryInModal = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    setCatSaving(true);
    setCatError("");

    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCatError(data.error || "Error al crear la categoría");
      } else {
        setNewCategoryName("");
        await loadData();
      }
    } catch {
      setCatError("Error de conexión");
    } finally {
      setCatSaving(false);
    }
  };

  const handleRenameCategory = async (catId: string) => {
    const trimmed = editingCatName.trim();
    if (!trimmed) return;
    setCatSaving(true);
    setCatError("");
    try {
      const res = await fetch(`/api/categories/${catId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCatError(data.error || "No se pudo renombrar la categoría");
      } else {
        setEditingCatId(null);
        setEditingCatName("");
        await loadData();
      }
    } finally {
      setCatSaving(false);
    }
  };

  const handleMoveCategory = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= categoriesList.length) return;

    const currentCat = categoriesList[index];
    const swapCat = categoriesList[targetIndex];

    await Promise.all([
      fetch(`/api/categories/${currentCat.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: targetIndex + 1 }),
      }),
      fetch(`/api/categories/${swapCat.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: index + 1 }),
      }),
    ]);

    await loadData();
  };

  const handleDeleteCategory = async (cat: CategoryItem) => {
    if (cat.productsCount > 0) {
      window.alert(
        `La categoría "${cat.name}" tiene ${cat.productsCount} producto(s) asociado(s). Cambia de categoría o elimina esos productos primero, o renombra esta categoría.`
      );
      return;
    }
    if (!window.confirm(`¿Eliminar la categoría "${cat.name}"?`)) return;

    const res = await fetch(`/api/categories/${cat.id}`, { method: "DELETE" });
    if (res.ok) {
      if (selectedCategory === cat.name) setSelectedCategory("TODAS");
      await loadData();
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

      await loadData();
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
      filteredAndSortedProducts.length > 0
        ? filteredAndSortedProducts
        : products;
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

  const isGroupedView =
    sortBy === "CATEGORY_ORDER" || sortBy === "CATEGORY_AZ";

  return (
    <div className="space-y-5">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
            <Tag className="w-5 h-5 text-sky-600" />
            Panel de Lista de Precios y Categorías
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Gestiona categorías, ordena tus productos, ajusta precios o descarga
            el PDF oficial
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
              setCatError("");
              setCatModalOpen(true);
            }}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3.5 py-2.5 rounded-xl transition cursor-pointer"
          >
            <Layers className="w-4 h-4 text-sky-600" />
            Categorías ({categoriesList.length})
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
            Ajuste %
          </button>

          <button
            type="button"
            onClick={() => openCreateModal()}
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

      {/* Buscador, Selector de Ordenamiento y Filtros de Categoría */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar prótesis, corona, perno, placa, compostura..."
              className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortMode)}
              className="w-full px-3 py-2 text-xs font-semibold border border-slate-200 rounded-xl bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="CATEGORY_ORDER">
                Ordenar: Por Categorías (Orden Catálogo)
              </option>
              <option value="CATEGORY_AZ">
                Ordenar: Por Categorías (A - Z)
              </option>
              <option value="PRICE_ASC">
                Ordenar: Precio (Menor a Mayor)
              </option>
              <option value="PRICE_DESC">
                Ordenar: Precio (Mayor a Menor)
              </option>
              <option value="NAME_AZ">
                Ordenar: Nombre de Producto (A - Z)
              </option>
            </select>
          </div>
        </div>

        {/* Pestañas de Categorías */}
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
          {allCategoryNames.map((cat) => {
            const count = products.filter((p) => p.category === cat).length;
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
          <button
            type="button"
            onClick={() => {
              setCatError("");
              setCatModalOpen(true);
            }}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 flex items-center gap-1 cursor-pointer"
            title="Crear o editar categorías"
          >
            <Plus className="w-3.5 h-3.5" />
            Nueva Categoría
          </button>
        </div>
      </div>

      {/* Lista de Productos (Agrupada por Categorías o Lista Plana) */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
          Cargando lista de precios...
        </div>
      ) : filteredAndSortedProducts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <Tag className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-700">
            No se encontraron productos en esta categoría o búsqueda
          </p>
          <button
            type="button"
            onClick={() => openCreateModal()}
            className="mt-3 inline-flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Agregar Producto
          </button>
        </div>
      ) : isGroupedView ? (
        <div className="space-y-4">
          {groupedByCategory.map((group) => (
            <div
              key={group.category}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden"
            >
              <div className="bg-slate-900 text-white px-4 sm:px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm sm:text-base tracking-tight">
                    {group.category}
                  </span>
                  <span className="text-[11px] bg-sky-600/30 text-sky-200 border border-sky-500/30 px-2 py-0.5 rounded-full">
                    {group.items.length} ítem(s)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => openCreateModal(group.category)}
                  className="text-xs font-semibold text-sky-300 hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Agregar aquí</span>
                </button>
              </div>

              <div className="divide-y divide-slate-100">
                {group.items.map((product) => (
                  <div
                    key={product.id}
                    className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition"
                  >
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm sm:text-base text-slate-900">
                        {product.name}
                      </h3>
                      {product.description && (
                        <p className="text-xs text-slate-500 mt-0.5">
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
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden divide-y divide-slate-100">
          {filteredAndSortedProducts.map((product) => (
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
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
                <span className="text-base sm:text-lg font-extrabold text-slate-900">
                  {formatCurrency(product.price)}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openEditModal(product)}
                    className="flex items-center gap-1 bg-slate-100 hover:bg-sky-600 hover:text-white text-slate-700 text-xs font-semibold px-3 py-2 rounded-xl transition cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Editar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteProduct(product)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Crear / Editar Producto (Con Selector y Creación Rápida de Categoría) */}
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
                  placeholder="Ej. Corona cerámica sobre metal..."
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {/* Campo de Categoría: Listar existentes o Crear Nueva */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Categoría *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setCreatingNewCategoryInline(!creatingNewCategoryInline);
                      setError("");
                    }}
                    className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1 cursor-pointer"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    {creatingNewCategoryInline
                      ? "Elegir de la lista existente"
                      : "+ Crear nueva categoría"}
                  </button>
                </div>

                {!creatingNewCategoryInline ? (
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    {allCategoryNames.map((catName) => (
                      <option key={catName} value={catName}>
                        {catName}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newInlineCategoryName}
                      onChange={(e) => setNewInlineCategoryName(e.target.value)}
                      placeholder="Nombre de la nueva categoría..."
                      className="flex-1 px-3.5 py-2.5 text-sm border border-sky-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    <button
                      type="button"
                      onClick={handleSaveInlineCategory}
                      className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold px-3.5 rounded-xl cursor-pointer shrink-0"
                    >
                      Guardar Cat.
                    </button>
                  </div>
                )}
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
                  placeholder="Ej. 65000"
                  className="w-full px-3.5 py-2.5 text-base font-bold border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Descripción o Detalles (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Especificaciones, material, elementos..."
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

      {/* Modal Gestionar Categorías (Crear, Listar, Renombrar y Ordenar) */}
      {catModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h2 className="font-bold text-sm sm:text-base flex items-center gap-2">
                <Layers className="w-4 h-4 text-sky-400" />
                Gestionar y Ordenar Categorías
              </h2>
              <button
                type="button"
                onClick={() => setCatModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {catError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs">
                  {catError}
                </div>
              )}

              {/* Formulario para Crear Nueva Categoría */}
              <form
                onSubmit={handleCreateCategoryInModal}
                className="flex gap-2"
              >
                <input
                  type="text"
                  required
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Escribe una nueva categoría..."
                  className="flex-1 px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <button
                  type="submit"
                  disabled={catSaving}
                  className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  Crear Categoría
                </button>
              </form>

              <p className="text-[11px] text-slate-500">
                Usa las flechas <strong>↑ / ↓</strong> para elegir en qué orden
                se muestran las categorías en la pantalla y en el PDF.
              </p>

              {/* Listado de Categorías */}
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-80 overflow-y-auto">
                {categoriesList.map((cat, idx) => (
                  <div
                    key={cat.id}
                    className="p-3 flex items-center justify-between gap-2 hover:bg-slate-50"
                  >
                    {editingCatId === cat.id ? (
                      <div className="flex-1 flex items-center gap-2">
                        <input
                          type="text"
                          value={editingCatName}
                          onChange={(e) => setEditingCatName(e.target.value)}
                          className="flex-1 px-2.5 py-1.5 text-xs border border-sky-400 rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => handleRenameCategory(cat.id)}
                          className="bg-emerald-600 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg cursor-pointer"
                        >
                          Guardar
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingCatId(null)}
                          className="text-xs text-slate-500 px-2 py-1.5 cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="min-w-0">
                          <span className="font-bold text-xs sm:text-sm text-slate-900">
                            {idx + 1}. {cat.name}
                          </span>
                          <span className="ml-2 text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                            {cat.productsCount} prod.
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveCategory(idx, -1)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-30 hover:bg-slate-100 rounded-lg cursor-pointer"
                            title="Subir categoría"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === categoriesList.length - 1}
                            onClick={() => handleMoveCategory(idx, 1)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-30 hover:bg-slate-100 rounded-lg cursor-pointer"
                            title="Bajar categoría"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCatId(cat.id);
                              setEditingCatName(cat.name);
                            }}
                            className="p-1.5 text-slate-500 hover:text-sky-600 hover:bg-sky-50 rounded-lg cursor-pointer"
                            title="Renombrar categoría"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(cat)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                            title="Eliminar categoría"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setCatModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white cursor-pointer"
                >
                  Listo
                </button>
              </div>
            </div>
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
                  {allCategoryNames.map((c) => (
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
