import { useState } from "react";
import { OrderStatus } from "@/types";

export default function OrderColumn({
  status,
  title,
  count,
  children,
  onDropOrder,
}: {
  status: OrderStatus | string;
  title: string;
  count: number;
  children: React.ReactNode;
  onDropOrder: (orderId: string, targetStatus: OrderStatus | string) => void;
}) {
  const [isOver, setIsOver] = useState(false);
  function handleDragOver(e: React.DragEvent) {
    let allowed = false;
    const draggedTypes = e.dataTransfer.types;

    if (draggedTypes.includes(`status-${status.toLowerCase()}`)) {
      allowed = true;
    } else if (
      status === OrderStatus.PACKED &&
      (draggedTypes.includes(`status-${OrderStatus.READY_TO_PACK.toLowerCase()}`) ||
        draggedTypes.includes(`status-${OrderStatus.NEW.toLowerCase()}`) ||
        draggedTypes.includes(`status-${OrderStatus.CONFIRMED.toLowerCase()}`))
    ) {
      allowed = true;
    } else if (
      String(status) === "LOGISTICS_SETUP" &&
      draggedTypes.includes(`status-${OrderStatus.PACKED.toLowerCase()}`)
    ) {
      allowed = true;
    }

    if (!allowed) {
      e.dataTransfer.dropEffect = "none";
      return;
    }
    e.preventDefault();
    setIsOver(true);
  }

  function handleDragLeave() {
    setIsOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsOver(false);
    const orderId = e.dataTransfer.getData("text/plain");
    if (orderId) {
      onDropOrder(orderId, status);
    }
  }

  return (
    <div
      className={`flex flex-col bg-gray-50/50 dark:bg-neutral-900/20 rounded-2xl border ${isOver ? "border-gray-400 dark:border-neutral-500 bg-gray-100/50 dark:bg-neutral-800/40" : "border-gray-200 dark:border-neutral-800"} transition-colors w-[85vw] md:w-[280px] lg:flex-1 lg:min-w-[240px] shrink-0 h-full overflow-hidden`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="p-4 border-b border-gray-100 dark:border-neutral-800/60 flex items-center justify-between bg-white dark:bg-neutral-900 rounded-t-xl">
        <h3 className="font-semibold text-gray-900 dark:text-neutral-100 text-sm">{title}</h3>
        <span className="bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-300 text-xs font-semibold px-2 py-0.5 rounded-full">
          {count}
        </span>
      </div>
      <div className="p-3 flex-1 flex flex-col gap-3 min-h-[150px] overflow-y-auto scrollbar-hide">
        {children}
      </div>
    </div>
  );
}
