import { createContext } from "react";
import { AppState, Inventory, Order } from "@/types";

export interface AppContextType {
  state: AppState;

  login: () => void;

  logout: () => void;

  loadOrders: () => Promise<void>;

  addOrder: (order: Order) => Promise<void>;

  updateOrder: (order: Order) => Promise<Order | void>;

  loadInventories: () => Promise<void>;

  upsertInventory: (item: Inventory) => void;

  updateInventories: (
    inventories: Inventory[]
  ) => Promise<void>;
}

export const AppContext =
  createContext<AppContextType | null>(null);