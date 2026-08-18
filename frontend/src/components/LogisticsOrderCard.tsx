import { Order, Marketplace, OrderStatus } from "@/types";
import { Card, CardContent, CardFooter } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SimulationAction } from "@/services/simulation.service";

function getMarketplaceBadgeVariant(marketplace: Marketplace | string) {
  switch (marketplace) {
    case Marketplace.AMAZON:
      return "warning";
    case Marketplace.SHOPIFY:
      return "success";
    case Marketplace.FLIPKART:
      return "info";
    default:
      return "secondary";
  }
}

function statusLabel(status: string) {
  if (status === "DELIVERY_FAILED") return "RTO";
  return status.replace(/_/g, " ");
}

export default function LogisticsOrderCard({
  order,
  actions,
  busy,
  onTransition,
}: {
  order: Order;
  actions: SimulationAction[];
  busy?: boolean;
  onTransition: (orderId: string, target: OrderStatus) => void;
}) {
  return (
    <Card className="hover:shadow-md transition-shadow flex flex-col h-full">
      <CardContent className="pt-6 flex-1 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-semibold text-gray-900 dark:text-neutral-100 text-sm break-all">
              {order.id.slice(0, 8)}…
            </div>
            <div className="text-xs text-gray-500 dark:text-neutral-400 mt-1">
              {statusLabel(order.status)}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant={getMarketplaceBadgeVariant(order.marketplace)}>{order.marketplace}</Badge>
            {order.lastStatusSource && (
              <span className="text-[10px] uppercase tracking-wide text-gray-400">
                via {order.lastStatusSource}
              </span>
            )}
          </div>
        </div>

        <ul className="text-sm text-gray-700 dark:text-neutral-300 space-y-2">
          {order.items.map((it) => (
            <li
              key={`${it.skuId}-${it.skuName}`}
              className="flex justify-between items-center bg-gray-50 dark:bg-neutral-800/50 px-3 py-2 rounded-md"
            >
              <span className="font-medium text-gray-700 dark:text-neutral-200 truncate mr-2">
                {it.skuName}
              </span>
              <span className="text-xs font-bold text-gray-500 dark:text-neutral-400 bg-white dark:bg-neutral-700 px-2 py-1 rounded shadow-sm shrink-0">
                x{it.quantity}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter className="bg-white dark:bg-neutral-900 border-t-0 pt-0 pb-6 px-6 flex flex-wrap gap-2">
        {actions.length === 0 ? (
          <p className="text-xs text-gray-400 w-full">No further simulation actions</p>
        ) : (
          actions.map((action) => (
            <Button
              key={action.targetStatus}
              variant="outline"
              disabled={busy}
              className="text-xs"
              onClick={() => onTransition(order.id, action.targetStatus)}
            >
              {action.label}
            </Button>
          ))
        )}
      </CardFooter>
    </Card>
  );
}
