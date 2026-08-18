import { useContext, useMemo, useState } from "react";
import { AppContext } from "@/context/AppContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Inventory } from "@/types";
import {
  createProduct,
  deleteProduct,
  updateProduct,
  adjustQuantity,
  resolveImageUrl,
  uploadProductImage,
} from "@/services/inventory.service";
import { ImagePlus, Loader2, Minus, Plus, Pencil, Trash2, PackagePlus, Package, Search, X } from "lucide-react";

type StockFilter = "ALL" | "IN_STOCK" | "OUT";

const emptyForm = {
  name: "",
  sku: "",
  price: "0",
  quantity: "0",
  description: "",
  imageUrl: "",
};

export default function InventoryPage() {
  const ctx = useContext(AppContext);
  const products = ctx?.state.inventories || [];
  const [toast, setToast] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Inventory | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [syncOverlay, setSyncOverlay] = useState<{
    productName: string;
    action: "adjust" | "set" | "delete";
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [query, setQuery] = useState("");
  const [stockFilter, setStockFilter] = useState<StockFilter>("ALL");
  const [imageMode, setImageMode] = useState<"file" | "url">("file");
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...products]
      .filter((p) => {
        if (!q) return true;
        const name = p.name.toLowerCase();
        const sku = (p.sku || p.id).toLowerCase();
        return name.includes(q) || sku.includes(q);
      })
      .filter((p) => {
        if (stockFilter === "OUT") return p.quantity <= 0;
        if (stockFilter === "IN_STOCK") return p.quantity > 0;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products, query, stockFilter]);

  const hasActiveFilters = Boolean(query.trim()) || stockFilter !== "ALL";

  function clearFilters() {
    setQuery("");
    setStockFilter("ALL");
  }
  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function showChannelSyncToast(channelSync?: Inventory["channelSync"]) {
    if (!channelSync?.length) {
      showToast("Saved locally — no connected channels to sync");
      return;
    }
    const ok = channelSync.filter((r) => r.ok).map((r) => r.channel);
    const failed = channelSync.filter((r) => !r.ok);
    if (!failed.length) {
      showToast(`Synced to ${ok.join(", ")}`);
      return;
    }
    const detail = failed.map((f) => `${f.channel}: ${f.error || "failed"}`).join(" | ");
    if (ok.length) {
      showToast(`Synced ${ok.join(", ")}; failed — ${detail}`);
    } else {
      showToast(`Channel sync failed — ${detail}`);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setImageMode("file");
    setUploadedFileName(null);
    setFormOpen(true);
  }

  function openEdit(item: Inventory) {
    setEditing(item);
    setForm({
      name: item.name,
      sku: item.sku || item.id,
      price: String(item.price ?? 0),
      quantity: String(item.quantity),
      description: item.description || "",
      imageUrl: item.imageUrl || "",
    });
    const hasHttpImage = Boolean(item.imageUrl?.startsWith("http"));
    setImageMode(hasHttpImage ? "url" : "file");
    setUploadedFileName(null);
    setFormOpen(true);
  }

  async function refresh() {
    await ctx?.loadInventories();
  }

  async function handleImageChange(file?: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const imageUrl = await uploadProductImage(file);
      setForm((f) => ({ ...f, imageUrl }));
      setUploadedFileName(file.name);
      setImageMode("file");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function clearImage() {
    setForm((f) => ({ ...f, imageUrl: "" }));
    setUploadedFileName(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      price: Number(form.price) || 0,
      quantity: Number(form.quantity) || 0,
      description: form.description.trim(),
      imageUrl: form.imageUrl.trim() || null,
    };

    try {
      if (editing) {
        const updated = await updateProduct(editing.id, payload);
        ctx?.upsertInventory(updated);
        showToast("Product updated");
      } else {
        const created = await createProduct(payload);
        ctx?.upsertInventory(created);
        showToast("Product created");
      }
      setFormOpen(false);
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this product?")) return;
    const product = products.find((p) => p.id === id);
    setBusyId(id);
    setSyncOverlay({ productName: product?.name || "product", action: "delete" });
    try {
      await deleteProduct(id);
      showToast("Product deleted");
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusyId(null);
      setSyncOverlay(null);
    }
  }

  async function handleAdjust(id: string, delta: number) {
    const product = products.find((p) => p.id === id);
    setBusyId(id);
    setSyncOverlay({ productName: product?.name || "product", action: "adjust" });
    try {
      const updated = await adjustQuantity(id, delta);
      ctx?.upsertInventory(updated);
      showChannelSyncToast(updated.channelSync);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Quantity update failed");
      await refresh();
    } finally {
      setBusyId(null);
      setSyncOverlay(null);
    }
  }

  async function handleSetQuantity(item: Inventory) {
    const raw = prompt("Set quantity", String(item.quantity));
    if (raw === null) return;
    const quantity = Number(raw);
    if (Number.isNaN(quantity) || quantity < 0 || !Number.isInteger(quantity)) {
      showToast("Invalid quantity");
      return;
    }
    setBusyId(item.id);
    setSyncOverlay({ productName: item.name, action: "set" });
    try {
      const updated = await updateProduct(item.id, { quantity });
      ctx?.upsertInventory(updated);
      showToast("Quantity updated");
      showChannelSyncToast(updated.channelSync);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Update failed");
      await refresh();
    } finally {
      setBusyId(null);
      setSyncOverlay(null);
    }
  }

  const syncCopy =
    syncOverlay?.action === "delete"
      ? { title: "Removing product", subtitle: "Updating catalog…" }
      : {
          title: "Syncing inventory",
          subtitle: "Pushing stock to connected channels…",
        };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Inventory"
        description="Manage your product catalog and stock levels across connected channels."
        action={
          <Button onClick={openCreate} className="gap-2 bg-gray-900 dark:bg-neutral-100 text-white dark:text-neutral-900">
            <PackagePlus className="w-4 h-4" />
            Add product
          </Button>
        }
      />

      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-gray-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-3 rounded-lg shadow-xl text-sm">
          {toast}
        </div>
      )}

      {syncOverlay && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center p-4"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="absolute inset-0 bg-gray-950/45 dark:bg-black/55 backdrop-blur-[6px]" />
          <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/20 dark:border-white/10 bg-white/90 dark:bg-neutral-950/90 shadow-2xl shadow-black/20">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gray-400/50 to-transparent" />
            <div className="px-8 py-9 flex flex-col items-center text-center">
              <div className="relative mb-5">
                <div className="absolute inset-0 rounded-full bg-gray-900/10 dark:bg-white/10 blur-xl scale-150 animate-pulse" />
                <div className="relative w-14 h-14 rounded-full bg-gray-900 dark:bg-neutral-100 flex items-center justify-center shadow-lg">
                  <Loader2 className="w-6 h-6 text-white dark:text-neutral-900 animate-spin" />
                </div>
              </div>
              <h3 className="text-base font-semibold tracking-tight text-gray-900 dark:text-neutral-50">
                {syncCopy.title}
              </h3>
              <p className="mt-1.5 text-sm text-gray-500 dark:text-neutral-400">{syncCopy.subtitle}</p>
              <p className="mt-4 max-w-[16rem] truncate text-xs font-medium text-gray-700 dark:text-neutral-300 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-neutral-800/80">
                {syncOverlay.productName}
              </p>
            </div>
          </div>
        </div>
      )}

      {products.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or SKU..."
              className="w-full pl-9 pr-9 py-2 rounded-lg border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-sm"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: "ALL", label: "All" },
                { id: "IN_STOCK", label: "In stock" },
                { id: "OUT", label: "Out of stock" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setStockFilter(opt.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  stockFilter === opt.id
                    ? "bg-gray-900 text-white border-gray-900 dark:bg-neutral-100 dark:text-neutral-900 dark:border-neutral-100"
                    : "bg-white dark:bg-neutral-900 text-gray-600 dark:text-neutral-300 border-gray-200 dark:border-neutral-800"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden">
        {products.length === 0 ? (
          <div className="px-6 py-16 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-gray-50 dark:bg-neutral-800 flex items-center justify-center mb-4">
              <Package className="w-7 h-7 text-gray-300 dark:text-neutral-600" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-neutral-100 mb-1">No products yet</h3>
            <p className="text-sm text-gray-500 dark:text-neutral-400 max-w-sm mb-5">
              Add your first product to start tracking stock and syncing inventory to marketplaces.
            </p>
            <Button onClick={openCreate} className="gap-2 bg-gray-900 dark:bg-neutral-100 text-white dark:text-neutral-900">
              <PackagePlus className="w-4 h-4" />
              Add product
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-14 flex flex-col items-center text-center">
            <h3 className="text-base font-semibold text-gray-900 dark:text-neutral-100 mb-1">No matching products</h3>
            <p className="text-sm text-gray-500 dark:text-neutral-400 max-w-sm mb-4">
              Try a different name, SKU, or stock filter.
            </p>
            {hasActiveFilters && (
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-neutral-950/50 text-left text-gray-500 dark:text-neutral-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">Product</th>
                  <th className="px-4 py-3 font-semibold">SKU</th>
                  <th className="px-4 py-3 font-semibold">Price</th>
                  <th className="px-4 py-3 font-semibold">Quantity</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const image = resolveImageUrl(item.imageUrl);
                  return (
                    <tr key={item.id} className="border-t border-gray-100 dark:border-neutral-800">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-950 overflow-hidden shrink-0 flex items-center justify-center">
                            {image ? (
                              <img src={image} alt={item.name} className="w-full h-full object-cover" />
                            ) : (
                              <ImagePlus className="w-4 h-4 text-gray-300" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900 dark:text-neutral-100">{item.name}</div>
                            <div
                              className={`text-xs mt-0.5 ${
                                item.quantity > 0
                                  ? "text-green-600 dark:text-green-400"
                                  : "text-red-600 dark:text-red-400"
                              }`}
                            >
                              {item.quantity > 0 ? "In stock" : "Out of stock"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-neutral-300">{item.sku || item.id}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-neutral-300">
                        ₹{(item.price ?? 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            disabled={busyId === item.id}
                            onClick={() => handleAdjust(item.id, -1)}
                            className="p-1.5 rounded-md border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleSetQuantity(item)}
                            className="min-w-12 text-center font-semibold text-gray-900 dark:text-neutral-100"
                          >
                            {item.quantity}
                          </button>
                          <button
                            disabled={busyId === item.id}
                            onClick={() => handleAdjust(item.id, 1)}
                            className="p-1.5 rounded-md border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEdit(item)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(item.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setFormOpen(false)} />
          <form
            onSubmit={handleSubmit}
            className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl p-6 space-y-4 shadow-xl"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-neutral-100">
              {editing ? "Update product" : "Add product"}
            </h3>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-neutral-300">Image</label>
              <div className="flex items-start gap-3">
                <div className="w-16 h-16 rounded-lg border border-gray-200 dark:border-neutral-700 overflow-hidden bg-gray-50 dark:bg-neutral-900 flex items-center justify-center shrink-0">
                  {form.imageUrl ? (
                    <img src={resolveImageUrl(form.imageUrl) || ""} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ImagePlus className="w-5 h-5 text-gray-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  {imageMode === "file" ? (
                    <>
                      {form.imageUrl && uploadedFileName ? (
                        <div className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 dark:border-neutral-700 px-3 py-2">
                          <span className="text-sm text-gray-700 dark:text-neutral-300 truncate">
                            {uploadedFileName}
                          </span>
                          <button
                            type="button"
                            onClick={clearImage}
                            className="text-xs font-medium text-gray-500 hover:text-red-600 shrink-0"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleImageChange(e.target.files?.[0])}
                          className="block w-full text-sm"
                        />
                      )}
                      {!form.imageUrl && (
                        <button
                          type="button"
                          onClick={() => setImageMode("url")}
                          className="text-xs text-gray-500 hover:text-gray-800 dark:hover:text-neutral-200"
                        >
                          Or paste an image URL
                        </button>
                      )}
                      {form.imageUrl && !uploadedFileName && (
                        <div className="flex gap-3">
                          <label className="text-xs text-gray-500 hover:text-gray-800 dark:hover:text-neutral-200 cursor-pointer">
                            Replace
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleImageChange(e.target.files?.[0])}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={clearImage}
                            className="text-xs text-gray-500 hover:text-red-600"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <input
                        type="url"
                        placeholder="https://..."
                        value={form.imageUrl}
                        onChange={(e) => {
                          setUploadedFileName(null);
                          setForm((f) => ({ ...f, imageUrl: e.target.value }));
                        }}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setImageMode("file")}
                        className="text-xs text-gray-500 hover:text-gray-800 dark:hover:text-neutral-200"
                      >
                        Or upload from device
                      </button>
                    </>
                  )}
                  {uploading && <p className="text-xs text-gray-500">Uploading...</p>}
                </div>
              </div>
            </div>

            {(["name", "sku", "price", "quantity"] as const).map((field) => (
              <div key={field}>
                <label className="block text-sm font-medium mb-1 capitalize text-gray-700 dark:text-neutral-300">
                  {field}
                </label>
                <input
                  required={field === "name" || field === "sku"}
                  type={field === "price" || field === "quantity" ? "number" : "text"}
                  value={form[field]}
                  onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-neutral-300">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-gray-900 dark:bg-neutral-100 text-white dark:text-neutral-900">
                Save
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
