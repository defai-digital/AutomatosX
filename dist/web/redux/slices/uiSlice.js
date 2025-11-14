/**
 * UI Slice
 * Redux slice for managing UI state (theme, sidebar, notifications)
 */
import { createSlice } from '@reduxjs/toolkit';
const initialState = {
    theme: 'light',
    sidebarOpen: true,
    notifications: [],
};
const uiSlice = createSlice({
    name: 'ui',
    initialState,
    reducers: {
        toggleTheme: (state) => {
            state.theme = state.theme === 'light' ? 'dark' : 'light';
        },
        setTheme: (state, action) => {
            state.theme = action.payload;
        },
        toggleSidebar: (state) => {
            state.sidebarOpen = !state.sidebarOpen;
        },
        setSidebarOpen: (state, action) => {
            state.sidebarOpen = action.payload;
        },
        addNotification: (state, action) => {
            const notification = {
                ...action.payload,
                id: `notification-${Date.now()}-${Math.random()}`,
                timestamp: new Date().toISOString(),
            };
            state.notifications.push(notification);
        },
        removeNotification: (state, action) => {
            state.notifications = state.notifications.filter((n) => n.id !== action.payload);
        },
        clearNotifications: (state) => {
            state.notifications = [];
        },
    },
});
export const { toggleTheme, setTheme, toggleSidebar, setSidebarOpen, addNotification, removeNotification, clearNotifications, } = uiSlice.actions;
export default uiSlice.reducer;
//# sourceMappingURL=uiSlice.js.map