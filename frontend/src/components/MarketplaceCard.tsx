import { Inventory } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ShoppingCart } from "lucide-react";

export default function MarketplaceCard({
  name,
  inventories,
  onOpen,
}: {
  name: string;
  inventories: Inventory[];
  onOpen: () => void;
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg">{name}</CardTitle>
        <Button onClick={onOpen} size="sm" variant="outline" className="gap-2">
          <ShoppingCart className="w-3.5 h-3.5" />
          Order
        </Button>
      </CardHeader>
      <CardContent>
        <div className="mt-2 space-y-3">
          <p className="text-xs font-semibold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
            Inventory Levels
          </p>
          <ul className="space-y-2">
            {inventories.length === 0 ? (
              <li className="text-sm text-gray-500 dark:text-neutral-400 px-3 py-2">No products yet</li>
            ) : (
              inventories.map((inv) => {
                const outOfStock = inv.quantity === 0;
                return (
                  <li
                    key={inv.id}
                    className={`flex justify-between items-center text-sm px-3 py-2 rounded-md ${
                      outOfStock ? "bg-red-50 dark:bg-red-950/40" : "bg-gray-50 dark:bg-neutral-800/50"
                    }`}
                  >
                    <span
                      className={`font-medium ${
                        outOfStock ? "text-red-700 dark:text-red-400" : "text-gray-700 dark:text-neutral-300"
                      }`}
                    >
                      {inv.name}
                    </span>
                    <span
                      className={`font-bold ${
                        outOfStock ? "text-red-700 dark:text-red-400" : "text-gray-900 dark:text-neutral-100"
                      }`}
                    >
                      {outOfStock ? "Out of Stock" : inv.quantity}
                    </span>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
