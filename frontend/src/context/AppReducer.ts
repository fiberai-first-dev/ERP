import { AppState, Order } from "@/types";
import { ActionType, AppAction } from "./AppActions";

export function AppReducer(
  state: AppState,
  action: AppAction
): AppState {
  switch (action.type) {
    case ActionType.LOGIN:
      return {
        ...state,
        isLoggedIn: true,
      };

    case ActionType.LOGOUT:
      return {
        ...state,
        isLoggedIn: false,
      };

    case ActionType.SET_LOADING:
      return {
        ...state,
        loading: action.payload,
      };

    case ActionType.SET_ORDERS:
      return {
        ...state,
        orders: action.payload,
      };

    case ActionType.ADD_ORDER:
      return {
        ...state,
        orders: [...state.orders, action.payload],
      };

    case ActionType.UPDATE_ORDER:
      return {
        ...state,
        orders: state.orders.map((order: Order) =>
          order.id === action.payload.id ? action.payload : order
        ),
      };

    case ActionType.SET_INVENTORIES:
      return {
        ...state,
        inventories: action.payload,
      };

    case ActionType.UPDATE_INVENTORIES:
      return {
        ...state,
        inventories: action.payload,
      };

    case ActionType.UPSERT_INVENTORY:
      return {
        ...state,
        inventories: state.inventories.some((item) => item.id === action.payload.id)
          ? state.inventories.map((item) =>
              item.id === action.payload.id ? action.payload : item
            )
          : [...state.inventories, action.payload],
      };

    default:
      return state;
  }
}