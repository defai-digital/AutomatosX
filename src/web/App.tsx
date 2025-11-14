/**
 * App Component
 * Main application component with routing and theme provider
 */

import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { Provider } from 'react-redux';
import { store } from './redux/store/index.js';
import { useAppSelector } from './redux/hooks.js';
import { getTheme } from './theme.js';
import { ErrorBoundary } from './components/common/ErrorBoundary.js';
import { DashboardLayout } from './components/dashboard/DashboardLayout.js';
import { HomePage } from './pages/HomePage.js';
import { QualityDashboard } from './pages/QualityDashboard.js';
import { DependenciesPage } from './pages/DependenciesPage.js';
import { SettingsPage } from './pages/SettingsPage.js';

function AppContent(): React.ReactElement {
  const theme = useAppSelector((state) => state.ui.theme);
  const muiTheme = getTheme(theme);

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <ErrorBoundary>
        <BrowserRouter>
          <DashboardLayout>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/quality" element={<QualityDashboard />} />
              <Route path="/dependencies" element={<DependenciesPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </DashboardLayout>
        </BrowserRouter>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

export function App(): React.ReactElement {
  return (
    <Provider store={store}>
      <AppContent />
    </Provider>
  );
}

export default App;
