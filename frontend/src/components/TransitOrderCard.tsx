import { Order, Marketplace } from "@/types";
import { Card, CardContent, CardFooter } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Check, X } from "lucide-react";

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

export default function TransitOrderCard({
  order,
  onAccept,
  onReject,
}: {
  order: Order;
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
}) {
  return (
    <Card className="hover:shadow-md transition-shadow flex flex-col h-full">
      <CardContent className="pt-6 flex-1">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="font-semibold text-gray-900 dark:text-neutral-100">{order.id}</div>
            <div className="text-xs text-gray-500 dark:text-neutral-400 mt-1">{order.items.length} items</div>
          </div>
          <Badge variant={getMarketplaceBadgeVariant(order.marketplace)}>{order.marketplace}</Badge>
        </div>

        <ul className="text-sm text-gray-700 dark:text-neutral-300 space-y-2">
          {order.items.map((it) => (
            <li
              key={`${it.skuId}-${it.skuName}`}
              className="flex justify-between items-center bg-gray-50 dark:bg-neutral-800/50 px-3 py-2 rounded-md"
            >
              <span className="font-medium text-gray-700 dark:text-neutral-200">{it.skuName}</span>
              <span className="text-xs font-bold text-gray-500 dark:text-neutral-400 bg-white dark:bg-neutral-700 px-2 py-1 rounded shadow-sm">
                x{it.quantity}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter className="bg-white dark:bg-neutral-900 border-t-0 pt-0 pb-6 px-6 flex gap-3">
        <Button
          variant="outline"
          className="flex-1 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950 hover:border-red-200 dark:hover:border-red-900"
          onClick={() => onReject?.(order.id)}
        >
          <X className="w-4 h-4 mr-1.5" />
          Reject
        </Button>
        <Button
          className="flex-1 bg-green-600 dark:bg-green-600 hover:bg-green-700 dark:hover:bg-green-700 text-white shadow-sm"
          onClick={() => onAccept?.(order.id)}
        >
          <Check className="w-4 h-4 mr-1.5" />
          Accept
        </Button>
      </CardFooter>
    </Card>
  );
}
