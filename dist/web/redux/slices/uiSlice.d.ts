/**
 * UI Slice
 * Redux slice for managing UI state (theme, sidebar, notifications)
 */
import type { UIState, Notification } from '../../types/redux.js';
export declare const toggleTheme: import("@reduxjs/toolkit").ActionCreatorWithoutPayload<"ui/toggleTheme">, setTheme: import("@reduxjs/toolkit").ActionCreatorWithPayload<"light" | "dark", "ui/setTheme">, toggleSidebar: import("@reduxjs/toolkit").ActionCreatorWithoutPayload<"ui/toggleSidebar">, setSidebarOpen: import("@reduxjs/toolkit").ActionCreatorWithPayload<boolean, "ui/setSidebarOpen">, addNotification: import("@reduxjs/toolkit").ActionCreatorWithPayload<Omit<Notification, "id" | "timestamp">, "ui/addNotification">, removeNotification: import("@reduxjs/toolkit").ActionCreatorWithPayload<string, "ui/removeNotification">, clearNotifications: import("@reduxjs/toolkit").ActionCreatorWithoutPayload<"ui/clearNotifications">;
declare const _default: import("redux").Reducer<UIState>;
export default _default;
//# sourceMappingURL=uiSlice.d.ts.map