import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Box, Drawer, AppBar, Toolbar, List, Typography, Divider, IconButton, ListItem, ListItemButton, ListItemIcon, ListItemText, } from '@mui/material';
import { Menu as MenuIcon, Home as HomeIcon, Assessment as QualityIcon, AccountTree as DependencyIcon, Settings as SettingsIcon, Brightness4 as DarkModeIcon, Brightness7 as LightModeIcon, } from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../redux/hooks.js';
import { toggleSidebar, toggleTheme } from '../../redux/slices/uiSlice.js';
const DRAWER_WIDTH = 240;
const navigationItems = [
    { text: 'Home', icon: _jsx(HomeIcon, {}), path: '/' },
    { text: 'Quality Dashboard', icon: _jsx(QualityIcon, {}), path: '/quality' },
    { text: 'Dependencies', icon: _jsx(DependencyIcon, {}), path: '/dependencies' },
    { text: 'Settings', icon: _jsx(SettingsIcon, {}), path: '/settings' },
];
export function DashboardLayout({ children }) {
    const navigate = useNavigate();
    const location = useLocation();
    const dispatch = useAppDispatch();
    const sidebarOpen = useAppSelector((state) => state.ui.sidebarOpen);
    const theme = useAppSelector((state) => state.ui.theme);
    const handleDrawerToggle = () => {
        dispatch(toggleSidebar());
    };
    const handleThemeToggle = () => {
        dispatch(toggleTheme());
    };
    const handleNavigation = (path) => {
        navigate(path);
    };
    const drawerContent = (_jsxs(_Fragment, { children: [_jsx(Toolbar, { children: _jsx(Typography, { variant: "h6", noWrap: true, component: "div", children: "AutomatosX v2" }) }), _jsx(Divider, {}), _jsx(List, { children: navigationItems.map((item) => (_jsx(ListItem, { disablePadding: true, children: _jsxs(ListItemButton, { selected: location.pathname === item.path, onClick: () => handleNavigation(item.path), children: [_jsx(ListItemIcon, { children: item.icon }), _jsx(ListItemText, { primary: item.text })] }) }, item.text))) })] }));
    return (_jsxs(Box, { sx: { display: 'flex' }, children: [_jsx(AppBar, { position: "fixed", sx: {
                    width: { sm: sidebarOpen ? `calc(100% - ${DRAWER_WIDTH}px)` : '100%' },
                    ml: { sm: sidebarOpen ? `${DRAWER_WIDTH}px` : 0 },
                    transition: (theme) => theme.transitions.create(['width', 'margin'], {
                        easing: theme.transitions.easing.sharp,
                        duration: theme.transitions.duration.leavingScreen,
                    }),
                }, children: _jsxs(Toolbar, { children: [_jsx(IconButton, { color: "inherit", "aria-label": "toggle drawer", edge: "start", onClick: handleDrawerToggle, sx: { mr: 2 }, children: _jsx(MenuIcon, {}) }), _jsx(Typography, { variant: "h6", noWrap: true, component: "div", sx: { flexGrow: 1 }, children: "Code Intelligence Dashboard" }), _jsx(IconButton, { color: "inherit", onClick: handleThemeToggle, children: theme === 'dark' ? _jsx(LightModeIcon, {}) : _jsx(DarkModeIcon, {}) })] }) }), _jsx(Drawer, { variant: "persistent", open: sidebarOpen, sx: {
                    width: DRAWER_WIDTH,
                    flexShrink: 0,
                    '& .MuiDrawer-paper': {
                        width: DRAWER_WIDTH,
                        boxSizing: 'border-box',
                    },
                }, children: drawerContent }), _jsxs(Box, { component: "main", sx: {
                    flexGrow: 1,
                    p: 3,
                    width: { sm: sidebarOpen ? `calc(100% - ${DRAWER_WIDTH}px)` : '100%' },
                    ml: { sm: sidebarOpen ? 0 : 0 },
                    transition: (theme) => theme.transitions.create(['width', 'margin'], {
                        easing: theme.transitions.easing.sharp,
                        duration: theme.transitions.duration.enteringScreen,
                    }),
                }, children: [_jsx(Toolbar, {}), children] })] }));
}
export default DashboardLayout;
//# sourceMappingURL=DashboardLayout.js.map