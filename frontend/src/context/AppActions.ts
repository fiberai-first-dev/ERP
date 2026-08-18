import { Inventory, Order } from "@/types";

export enum ActionType {
  LOGIN = "LOGIN",
  LOGOUT = "LOGOUT",
  SET_LOADING = "SET_LOADING",
  SET_ORDERS = "SET_ORDERS",
  ADD_ORDER = "ADD_ORDER",
  UPDATE_ORDER = "UPDATE_ORDER",
  SET_INVENTORIES = "SET_INVENTORIES",
  UPDATE_INVENTORIES = "UPDATE_INVENTORIES",
  UPSERT_INVENTORY = "UPSERT_INVENTORY",
}

export type AppAction =
  | {
      type: ActionType.LOGIN;
    }
  | {
      type: ActionType.LOGOUT;
    }
  | {
      type: ActionType.SET_LOADING;
      payload: boolean;
    }
  | {
      type: ActionType.SET_ORDERS;
      payload: Order[];
    }
  | {
      type: ActionType.ADD_ORDER;
      payload: Order;
    }
  | {
      type: ActionType.UPDATE_ORDER;
      payload: Order;
    }
  | {
      type: ActionType.SET_INVENTORIES;
      payload: Inventory[];
    }
  | {
      type: ActionType.UPDATE_INVENTORIES;
      payload: Inventory[];
    }
  | {
      type: ActionType.UPSERT_INVENTORY;
      payload: Inventory;
    };