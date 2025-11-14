/**
 * Redux Store Configuration
 * Configures the Redux store with all slices and middleware
 */

import { configureStore } from '@reduxjs/toolkit';
import qualityReducer from '../slices/qualitySlice.js';
import dependencyReducer from '../slices/dependencySlice.js';
import uiReducer from '../slices/uiSlice.js';

export const store = configureStore({
  reducer: {
    quality: qualityReducer,
    dependency: dependencyReducer,
    ui: uiReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types
        ignoredActions: ['ui/addNotification'],
        // Ignore these field paths in all actions
        ignoredActionPaths: ['payload.timestamp'],
        // Ignore these paths in the state
        ignoredPaths: ['ui.notifications'],
      },
    }),
  devTools: process.env.NODE_ENV !== 'production',
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
