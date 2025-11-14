import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
function AppContent() {
    const theme = useAppSelector((state) => state.ui.theme);
    const muiTheme = getTheme(theme);
    return (_jsxs(ThemeProvider, { theme: muiTheme, children: [_jsx(CssBaseline, {}), _jsx(ErrorBoundary, { children: _jsx(BrowserRouter, { children: _jsx(DashboardLayout, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(HomePage, {}) }), _jsx(Route, { path: "/quality", element: _jsx(QualityDashboard, {}) }), _jsx(Route, { path: "/dependencies", element: _jsx(DependenciesPage, {}) }), _jsx(Route, { path: "/settings", element: _jsx(SettingsPage, {}) })] }) }) }) })] }));
}
export function App() {
    return (_jsx(Provider, { store: store, children: _jsx(AppContent, {}) }));
}
export default App;
//# sourceMappingURL=App.js.map