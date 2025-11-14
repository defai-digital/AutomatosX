import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Container, Typography, Box, Paper } from '@mui/material';
export function SettingsPage() {
    return (_jsx(Container, { maxWidth: "lg", children: _jsxs(Box, { sx: { my: 4 }, children: [_jsx(Typography, { variant: "h4", component: "h1", gutterBottom: true, children: "Settings" }), _jsx(Typography, { variant: "body1", color: "text.secondary", paragraph: true, children: "Configure application settings and preferences" }), _jsxs(Paper, { sx: { p: 3, mt: 3 }, children: [_jsx(Typography, { variant: "h6", gutterBottom: true, children: "General Settings" }), _jsx(Typography, { variant: "body2", color: "text.secondary", children: "Settings panel will be implemented in future iterations." })] })] }) }));
}
export default SettingsPage;
//# sourceMappingURL=SettingsPage.js.map