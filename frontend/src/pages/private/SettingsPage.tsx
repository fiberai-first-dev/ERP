import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  ChannelSummary,
  CredentialField,
  FulfillmentMethodOption,
  LogisticsPartnerOption,
  connectChannel,
  disconnectChannel,
  getChannels,
} from "@/services/channel.service";
import { X } from "lucide-react";
import { useRealtimeEvents } from "@/hooks/useRealtimeEvents";

const CHANNEL_TITLES: Record<string, string> = {
  AMAZON: "Amazon",
  FLIPKART: "Flipkart",
  SHOPIFY: "Shopify",
};

export default function SettingsPage() {
  const [channels, setChannels] = useState<ChannelSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalChannel, setModalChannel] = useState<ChannelSummary | null>(null);
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [fulfillmentMethod, setFulfillmentMethod] = useState("");
  const [logisticsProvider, setLogisticsProvider] = useState("");
  const [logisticsCreds, setLogisticsCreds] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [disconnectChannelId, setDisconnectChannelId] = useState<string | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connectedCount = useMemo(
    () => channels.filter((c) => c.status === "CONNECTED").length,
    [channels]
  );

  const modalFields: CredentialField[] = modalChannel?.requiredFields || [];
  const methods: FulfillmentMethodOption[] = modalChannel?.fulfillmentMethods || [];
  const selectedMethod = methods.find((m) => m.id === fulfillmentMethod) || methods[0];
  const requiresLogistics = Boolean(selectedMethod?.requiresLogisticsProvider);
  const partners = modalChannel?.logisticsPartners || [];
  const selectedPartner = partners.find((p) => p.id === logisticsProvider);
  const partnerNeedsCreds =
    requiresLogistics &&
    (selectedPartner?.kind || "EXTERNAL") === "EXTERNAL" &&
    (selectedPartner?.requiredFields?.length || 0) > 0;

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  async function refresh(opts?: { quiet?: boolean }) {
    if (!opts?.quiet) setLoading(true);
    try {
      setChannels(await getChannels());
    } catch (err) {
      if (!opts?.quiet) {
        showToast(err instanceof Error ? err.message : "Failed to load channels");
      }
    } finally {
      if (!opts?.quiet) setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, []);

  useRealtimeEvents((event) => {
    if (event.type === "channel.sync" || event.type === "channel.status") {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => {
        void refresh({ quiet: true });
      }, 300);
    }
  });

  function openConnectModal(channel: ChannelSummary) {
    setModalChannel(channel);
    setCreds({});
    setLogisticsCreds({});
    setFieldErrors({});
    const methodList = channel.fulfillmentMethods || [];
    const initialMethod =
      channel.fulfillmentMethod ||
      methodList.find((m) => m.id === "SELF_SHIP")?.id ||
      methodList[0]?.id ||
      "";
    setFulfillmentMethod(initialMethod);
    const methodDef = methodList.find((m) => m.id === initialMethod);
    const list = channel.logisticsPartners || [];
    setLogisticsProvider(
      methodDef?.requiresLogisticsProvider
        ? channel.logisticsProvider || list[0]?.id || ""
        : ""
    );
  }

  function closeModal() {
    if (busy) return;
    setModalChannel(null);
    setCreds({});
    setLogisticsCreds({});
    setFieldErrors({});
    setFulfillmentMethod("");
    setLogisticsProvider("");
  }

  function onFulfillmentMethodChange(nextId: string) {
    setFulfillmentMethod(nextId);
    const next = methods.find((m) => m.id === nextId);
    setFieldErrors((prev) => {
      const cleaned = { ...prev };
      delete cleaned.fulfillmentMethod;
      delete cleaned.logisticsProvider;
      for (const key of Object.keys(cleaned)) {
        if (key.startsWith("logistics.")) delete cleaned[key];
      }
      return cleaned;
    });
    if (!next?.requiresLogisticsProvider) {
      setLogisticsProvider("");
      setLogisticsCreds({});
      return;
    }
    const list = modalChannel?.logisticsPartners || [];
    setLogisticsProvider((current) => current || list[0]?.id || "");
  }

  function validateConnect() {
    const errors: Record<string, string> = {};
    for (const field of modalFields) {
      if (!creds[field.key]?.trim()) {
        errors[field.key] = `${field.label} is required`;
      }
    }
    if (!fulfillmentMethod) errors.fulfillmentMethod = "Fulfillment method is required";
    if (requiresLogistics) {
      if (!logisticsProvider) errors.logisticsProvider = "Logistics partner is required";
      if (partnerNeedsCreds) {
        for (const field of selectedPartner?.requiredFields || []) {
          if (!logisticsCreds[field.key]?.trim()) {
            errors[`logistics.${field.key}`] = `${field.label} is required`;
          }
        }
      }
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleConnect() {
    if (!modalChannel || !validateConnect()) return;
    setBusy(modalChannel.channel);
    try {
      await connectChannel(modalChannel.channel, creds, {
        fulfillmentMethod,
        logisticsProvider: requiresLogistics ? logisticsProvider : null,
        logisticsCredentials: partnerNeedsCreds ? logisticsCreds : undefined,
      });
      showToast(`${CHANNEL_TITLES[modalChannel.channel] || modalChannel.channel} connected`);
      closeModal();
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Connect failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleDisconnect() {
    if (!disconnectChannelId) return;
    const channel = disconnectChannelId;
    setBusy(channel);
    try {
      await disconnectChannel(channel);
      showToast(`${CHANNEL_TITLES[channel] || channel} disconnected`);
      setDisconnectChannelId(null);
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setBusy(null);
    }
  }

  function partnerLabel(ch: ChannelSummary) {
    return (
      ch.logisticsPartners?.find((p) => p.id === ch.logisticsProvider)?.label ||
      ch.logisticsProvider ||
      null
    );
  }

  function LogisticsPicker({ partners: list }: { partners: LogisticsPartnerOption[] }) {
    return (
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1.5">Logistics partner</label>
          <select
            value={logisticsProvider}
            onChange={(e) => {
              setLogisticsProvider(e.target.value);
              setLogisticsCreds({});
              setFieldErrors((prev) => {
                const next = { ...prev };
                delete next.logisticsProvider;
                for (const key of Object.keys(next)) {
                  if (key.startsWith("logistics.")) delete next[key];
                }
                return next;
              });
            }}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
          >
            {list.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          {fieldErrors.logisticsProvider && (
            <p className="text-xs text-red-500 mt-1">{fieldErrors.logisticsProvider}</p>
          )}
        </div>

        {partnerNeedsCreds &&
          (selectedPartner?.requiredFields || []).map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium mb-1.5">{field.label}</label>
              <input
                type={field.type || "text"}
                autoComplete="off"
                spellCheck={false}
                value={logisticsCreds[field.key] || ""}
                onChange={(e) =>
                  setLogisticsCreds((c) => ({ ...c, [field.key]: e.target.value }))
                }
                className={`w-full px-3 py-2.5 rounded-lg border bg-white dark:bg-neutral-900 ${
                  fieldErrors[`logistics.${field.key}`]
                    ? "border-red-400"
                    : "border-gray-200 dark:border-neutral-700"
                }`}
              />
              {fieldErrors[`logistics.${field.key}`] && (
                <p className="text-xs text-red-500 mt-1">
                  {fieldErrors[`logistics.${field.key}`]}
                </p>
              )}
            </div>
          ))}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <PageHeader title="Settings" />

      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-gray-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-3 rounded-lg shadow-xl text-sm">
          {toast}
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-neutral-100">
            Sales channels
          </h3>
          <span className="text-sm text-gray-500">{connectedCount} connected</span>
        </div>

        {loading ? (
          <div className="text-sm text-gray-500">Loading channels...</div>
        ) : (
          channels.map((ch) => {
            const title = CHANNEL_TITLES[ch.channel] || ch.channel;
            const connected = ch.status === "CONNECTED";
            const methodLabel =
              ch.fulfillmentMethodLabel ||
              ch.fulfillmentMethods?.find((m) => m.id === ch.fulfillmentMethod)?.name ||
              ch.fulfillmentMethod ||
              null;
            const logisticsLabel = partnerLabel(ch);
            const methodNeedsLogistics = Boolean(
              ch.fulfillmentMethods?.find((m) => m.id === ch.fulfillmentMethod)
                ?.requiresLogisticsProvider
            );

            return (
              <div
                key={ch.channel}
                className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="space-y-2 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-gray-900 dark:text-neutral-100">{title}</h4>
                      <Badge
                        variant={
                          connected ? "success" : ch.status === "ERROR" ? "danger" : "secondary"
                        }
                      >
                        {connected ? "Connected" : ch.status === "ERROR" ? "Error" : "Not connected"}
                      </Badge>
                    </div>
                    {connected && ch.lastError && (
                      <div className="text-xs text-red-500">Error: {ch.lastError}</div>
                    )}
                    {connected && methodLabel && (
                      <div className="text-sm text-gray-600 dark:text-neutral-400">
                        Fulfillment:{" "}
                        <span className="font-medium text-gray-900 dark:text-neutral-200">
                          {methodLabel}
                        </span>
                      </div>
                    )}
                    {connected && methodNeedsLogistics && (
                      <div className="text-sm text-gray-600 dark:text-neutral-400">
                        Logistics:{" "}
                        <span className="font-medium text-gray-900 dark:text-neutral-200">
                          {logisticsLabel || "Not set"}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {connected ? (
                      <Button
                        variant="outline"
                        className="text-red-600"
                        disabled={busy === ch.channel}
                        onClick={() => setDisconnectChannelId(ch.channel)}
                      >
                        Disconnect
                      </Button>
                    ) : (
                      <Button
                        className="bg-gray-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
                        onClick={() => openConnectModal(ch)}
                      >
                        Connect
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {modalChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl shadow-xl">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between sticky top-0 bg-white dark:bg-neutral-950">
              <h3 className="text-lg font-semibold">
                Connect {CHANNEL_TITLES[modalChannel.channel] || modalChannel.channel}
              </h3>
              <button type="button" onClick={closeModal} className="p-2 -mr-2 text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              className="p-6 space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                void handleConnect();
              }}
            >
              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-neutral-400">
                  Marketplace credentials
                </p>
                {modalFields.map((field) => (
                  <div key={field.key}>
                    <label className="block text-sm font-medium mb-1.5">{field.label}</label>
                    <input
                      type={field.type || "text"}
                      autoComplete="off"
                      spellCheck={false}
                      value={creds[field.key] || ""}
                      onChange={(e) => setCreds((c) => ({ ...c, [field.key]: e.target.value }))}
                      className={`w-full px-3 py-2.5 rounded-lg border bg-white dark:bg-neutral-900 ${
                        fieldErrors[field.key]
                          ? "border-red-400"
                          : "border-gray-200 dark:border-neutral-700"
                      }`}
                    />
                    {fieldErrors[field.key] && (
                      <p className="text-xs text-red-500 mt-1">{fieldErrors[field.key]}</p>
                    )}
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-100 dark:border-neutral-800 pt-5 space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Fulfillment method</label>
                  <select
                    value={fulfillmentMethod}
                    onChange={(e) => onFulfillmentMethodChange(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
                  >
                    {methods.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  {selectedMethod?.description && (
                    <p className="text-xs text-gray-500 mt-1.5">{selectedMethod.description}</p>
                  )}
                  {fieldErrors.fulfillmentMethod && (
                    <p className="text-xs text-red-500 mt-1">{fieldErrors.fulfillmentMethod}</p>
                  )}
                </div>

                {requiresLogistics && (
                  <>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-neutral-400 pt-1">
                      Logistics
                    </p>
                    <LogisticsPicker partners={partners} />
                  </>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" onClick={closeModal}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={busy === modalChannel.channel}
                  className="bg-gray-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
                >
                  {busy === modalChannel.channel ? "Connecting..." : "Connect"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {disconnectChannelId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
            onClick={() => !busy && setDisconnectChannelId(null)}
          />
          <div className="relative w-full max-w-md bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-neutral-800">
              <h3 className="text-lg font-semibold">
                Disconnect {CHANNEL_TITLES[disconnectChannelId] || disconnectChannelId}?
              </h3>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-gray-600 dark:text-neutral-400">
                This removes marketplace credentials for{" "}
                {CHANNEL_TITLES[disconnectChannelId] || disconnectChannelId}.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDisconnectChannelId(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => void handleDisconnect()}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Disconnect
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
