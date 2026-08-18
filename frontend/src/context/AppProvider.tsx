import { ReactNode, useEffect, useReducer, useRef } from "react";
import { polyfill } from "mobile-drag-drop";
import { scrollBehaviourDragImageTranslateOverride } from "mobile-drag-drop/scroll-behaviour";
import "mobile-drag-drop/default.css";

import { AppContext } from "./AppContext";
import { AppReducer } from "./AppReducer";
import { ActionType } from "./AppActions";

import {
  addOrder as createOrderApi,
  getOrders,
  updateOrder as updateOrderApi,
} from "@/services/order.service";

import {
  getInventories,
  updateInventories as updateInventoryApi,
} from "@/services/inventory.service";

import { Inventory, Order } from "@/types";
import { useRealtimeEvents } from "@/hooks/useRealtimeEvents";

const initialState = () => ({
  isLoggedIn: localStorage.getItem("isLoggedIn") === "true",
  loading: false,
  orders: [],
  inventories: [],
});

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(AppReducer, undefined, initialState);
  const ordersRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inventoryRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function login() {
    try {
      localStorage.setItem("isLoggedIn", "true");
    } catch {
      // ignore
    }
    dispatch({ type: ActionType.LOGIN });
  }

  function logout() {
    try {
      localStorage.removeItem("isLoggedIn");
    } catch {
      // ignore
    }
    dispatch({ type: ActionType.LOGOUT });
  }

  async function loadOrders() {
    const orders = await getOrders();
    dispatch({ type: ActionType.SET_ORDERS, payload: orders });
  }

  async function addOrder(order: Order) {
    try {
      const newOrder = await createOrderApi(order);
      dispatch({ type: ActionType.ADD_ORDER, payload: newOrder });
    } catch (e) {
      console.error(e);
    }
  }

  async function updateOrder(order: Order) {
    try {
      const updated = await updateOrderApi(order);
      dispatch({ type: ActionType.UPDATE_ORDER, payload: updated });
      return updated;
    } catch (e) {
      console.error(e);
      await loadOrders();
      throw e;
    }
  }

  async function loadInventories() {
    const inventories = await getInventories();
    dispatch({ type: ActionType.SET_INVENTORIES, payload: inventories });
  }

  function upsertInventory(item: Inventory) {
    dispatch({ type: ActionType.UPSERT_INVENTORY, payload: item });
  }

  async function updateInventories(inventories: Inventory[]) {
    try {
      const updated = await updateInventoryApi(inventories);
      dispatch({ type: ActionType.UPDATE_INVENTORIES, payload: updated });
    } catch (e) {
      console.error(e);
      dispatch({ type: ActionType.UPDATE_INVENTORIES, payload: inventories });
    }
  }

  function scheduleOrdersRefresh() {
    if (ordersRefreshTimer.current) clearTimeout(ordersRefreshTimer.current);
    ordersRefreshTimer.current = setTimeout(() => {
      void loadOrders();
    }, 250);
  }

  function scheduleInventoryRefresh() {
    if (inventoryRefreshTimer.current) clearTimeout(inventoryRefreshTimer.current);
    inventoryRefreshTimer.current = setTimeout(() => {
      void loadInventories();
    }, 250);
  }

  useEffect(() => {
    polyfill({
      dragImageTranslateOverride: scrollBehaviourDragImageTranslateOverride,
      holdToDrag: 300,
    });
    window.addEventListener("touchmove", function () {}, { passive: false });

    const saved = localStorage.getItem("isLoggedIn") === "true";
    if (saved) dispatch({ type: ActionType.LOGIN });

    loadOrders();
    loadInventories();

    return () => {
      if (ordersRefreshTimer.current) clearTimeout(ordersRefreshTimer.current);
      if (inventoryRefreshTimer.current) clearTimeout(inventoryRefreshTimer.current);
    };
  }, []);

  useRealtimeEvents((event) => {
    if (event.type.startsWith("order.")) scheduleOrdersRefresh();
    if (event.type.startsWith("inventory.")) scheduleInventoryRefresh();
  });

  return (
    <AppContext.Provider
      value={{
        state,
        login,
        logout,
        loadOrders,
        addOrder,
        updateOrder,
        loadInventories,
        upsertInventory,
        updateInventories,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export default AppProvider;
