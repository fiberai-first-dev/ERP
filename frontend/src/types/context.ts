import { Order } from "./order";
import { Inventory } from "./inventory";

export interface AppState {
    isLoggedIn: boolean;
    orders: Order[];
    inventories: Inventory[];
    loading: boolean;
}