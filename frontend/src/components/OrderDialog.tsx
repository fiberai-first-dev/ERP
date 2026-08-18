import { useEffect, useState } from "react";
import { Inventory } from "@/types";
import { Button } from "@/components/ui/Button";
import { X } from "lucide-react";
import { SHOPIFY_SIM_CUSTOMER } from "@/constants/shopifySimCustomer";

export type PlaceOrderPayload = {
  items: { skuId: string; quantity: number }[];
  customer: {
    name: string;
    email: string;
    phone: string;
    address: string;
  };
};

export default function OrderDialog({
  inventories,
  open,
  onClose,
  onPlace,
  marketplace,
  showCustomerFields,
  lockCustomer,
}: {
  inventories: Inventory[];
  open: boolean;
  onClose: () => void;
  onPlace: (payload: PlaceOrderPayload) => void | Promise<void>;
  marketplace: string;
  showCustomerFields?: boolean;
  /** When true, customer fields are read-only (Shopify sim always uses one profile). */
  lockCustomer?: boolean;
}) {
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [customer, setCustomer] = useState<{
    name: string;
    email: string;
    phone: string;
    address: string;
  }>({ ...SHOPIFY_SIM_CUSTOMER });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const customerLocked = Boolean(lockCustomer || marketplace === "SHOPIFY");

  useEffect(() => {
    if (open) {
      setSelected({});
      setError(null);
      if (customerLocked) {
        setCustomer({ ...SHOPIFY_SIM_CUSTOMER });
      } else {
        setCustomer({
          name: "ERM Test Customer",
          email: "",
          phone: "",
          address: "",
        });
      }
    }
  }, [open, marketplace, customerLocked]);

  function setQty(id: string, qty: number) {
    setSelected((s) => ({ ...s, [id]: qty }));
  }

  function updatePhone(value: string) {
    if (customerLocked) return;
    const digits = value.replace(/\D/g, "").slice(0, 10);
    setCustomer((c) => ({ ...c, phone: digits }));
  }

  async function submit() {
    setError(null);

    const items = Object.entries(selected)
      .filter(([, q]) => q && q > 0)
      .map(([skuId, q]) => ({ skuId, quantity: q }));

    if (!items.length) {
      setError("Select at least one product quantity");
      return;
    }

    const payloadCustomer = customerLocked ? { ...SHOPIFY_SIM_CUSTOMER } : customer;

    if (showCustomerFields && !customerLocked && payloadCustomer.phone && payloadCustomer.phone.length !== 10) {
      setError("Phone number must be exactly 10 digits");
      return;
    }

    setSubmitting(true);
    try {
      await onPlace({ items, customer: payloadCustomer });
      setSelected({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to place order");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0" role="presentation">
      <div
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="place-order-title"
        className="relative bg-white dark:bg-neutral-950 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col border border-transparent dark:border-neutral-800 max-h-[90vh]"
      >
        <div className="px-6 py-4 border-b border-gray-100 dark:border-neutral-800/50 flex items-center justify-between">
          <h3 id="place-order-title" className="text-lg font-semibold text-gray-900 dark:text-neutral-100">
            Place {marketplace} order
          </h3>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-gray-400 hover:text-gray-600 rounded-full"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto bg-white dark:bg-neutral-950 space-y-6">
          {error && (
            <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 px-3 py-2.5 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {showCustomerFields && (
            <div className="space-y-3">
              {customerLocked && (
                <p className="text-xs text-gray-500 dark:text-neutral-400">
                  Shopify simulation always uses this customer profile.
                </p>
              )}
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-neutral-300">
                  Customer name
                </label>
                <input
                  value={customer.name}
                  onChange={(e) => setCustomer((c) => ({ ...c, name: e.target.value }))}
                  readOnly={customerLocked}
                  className={`w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 text-sm ${
                    customerLocked
                      ? "bg-gray-50 dark:bg-neutral-900 text-gray-600 dark:text-neutral-300"
                      : "bg-white dark:bg-neutral-900"
                  }`}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-neutral-300">Email</label>
                <input
                  type="email"
                  value={customer.email}
                  onChange={(e) => setCustomer((c) => ({ ...c, email: e.target.value }))}
                  readOnly={customerLocked}
                  className={`w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 text-sm ${
                    customerLocked
                      ? "bg-gray-50 dark:bg-neutral-900 text-gray-600 dark:text-neutral-300"
                      : "bg-white dark:bg-neutral-900"
                  }`}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-neutral-300">
                  Phone
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="tel"
                  maxLength={10}
                  placeholder="10-digit mobile number"
                  value={customer.phone}
                  onChange={(e) => updatePhone(e.target.value)}
                  readOnly={customerLocked}
                  onPaste={(e) => {
                    if (customerLocked) return;
                    e.preventDefault();
                    updatePhone(e.clipboardData.getData("text"));
                  }}
                  onKeyDown={(e) => {
                    if (customerLocked) return;
                    const allow =
                      e.ctrlKey ||
                      e.metaKey ||
                      e.key === "Backspace" ||
                      e.key === "Delete" ||
                      e.key === "Tab" ||
                      e.key === "ArrowLeft" ||
                      e.key === "ArrowRight" ||
                      e.key === "Home" ||
                      e.key === "End";
                    if (allow) return;
                    if (!/^\d$/.test(e.key)) {
                      e.preventDefault();
                      return;
                    }
                    if (customer.phone.length >= 10 && !window.getSelection()?.toString()) {
                      e.preventDefault();
                    }
                  }}
                  className={`w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 text-sm ${
                    customerLocked
                      ? "bg-gray-50 dark:bg-neutral-900 text-gray-600 dark:text-neutral-300"
                      : "bg-white dark:bg-neutral-900"
                  }`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-neutral-300">Address</label>
                <input
                  value={customer.address}
                  onChange={(e) => setCustomer((c) => ({ ...c, address: e.target.value }))}
                  readOnly={customerLocked}
                  className={`w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 text-sm ${
                    customerLocked
                      ? "bg-gray-50 dark:bg-neutral-900 text-gray-600 dark:text-neutral-300"
                      : "bg-white dark:bg-neutral-900"
                  }`}
                />
              </div>
            </div>
          )}

          <form
            id="place-order-form"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
            className="space-y-4"
          >
            {inventories.map((inv) => {
              const isOutOfStock = inv.quantity === 0;
              const qty = selected[inv.id] || 0;
              const isSelected = qty > 0;
              let rowClasses = "border-gray-200 dark:border-neutral-800";
              if (isOutOfStock)
                rowClasses = "border-red-100 dark:border-red-900/30 bg-red-50/50 dark:bg-red-900/10 opacity-75";
              else if (isSelected)
                rowClasses = "border-gray-900 dark:border-neutral-500 bg-gray-50/50 dark:bg-neutral-900/50";

              return (
                <div key={inv.id} className={`flex items-center justify-between p-4 rounded-xl border ${rowClasses}`}>
                  <div>
                    <div className="font-medium text-gray-800 dark:text-neutral-200">{inv.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {inv.sku || inv.id} · {isOutOfStock ? "Out of Stock" : `Available: ${inv.quantity}`}
                    </div>
                  </div>
                  <input
                    type="number"
                    value={selected[inv.id] || ""}
                    onChange={(e) => setQty(inv.id, parseInt(e.target.value) || 0)}
                    min={0}
                    max={inv.quantity}
                    disabled={isOutOfStock}
                    placeholder={isOutOfStock ? "-" : "0"}
                    className="border px-3 py-1.5 w-24 rounded-lg text-sm text-right bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-700"
                  />
                </div>
              );
            })}
          </form>
        </div>

        <div className="px-6 py-4 bg-gray-50 dark:bg-neutral-900 border-t border-gray-100 dark:border-neutral-800 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} type="button" disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="place-order-form"
            disabled={submitting}
            className="bg-gray-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
          >
            {submitting ? "Placing..." : "Place order"}
          </Button>
        </div>
      </div>
    </div>
  );
}
