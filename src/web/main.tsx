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

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
