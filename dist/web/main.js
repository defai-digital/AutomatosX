import { jsx as _jsx } from "react/jsx-runtime";
/**
 * main.tsx
 * Application entry point for React web application
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';
const root = document.getElementById('root');
if (!root) {
    throw new Error('Root element not found');
}
ReactDOM.createRoot(root).render(_jsx(React.StrictMode, { children: _jsx(App, {}) }));
//# sourceMappingURL=main.js.map