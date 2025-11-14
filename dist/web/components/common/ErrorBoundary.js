import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * ErrorBoundary Component
 * Catches JavaScript errors anywhere in the component tree
 */
import { Component } from 'react';
import { Box, Button, Container, Typography, Paper } from '@mui/material';
import { ErrorOutline as ErrorIcon } from '@mui/icons-material';
export class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        this.setState({
            error,
            errorInfo,
        });
    }
    handleReset = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });
    };
    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }
            return (_jsx(Container, { maxWidth: "md", sx: { mt: 8 }, children: _jsxs(Paper, { elevation: 3, sx: { p: 4 }, children: [_jsxs(Box, { display: "flex", alignItems: "center", mb: 2, children: [_jsx(ErrorIcon, { color: "error", sx: { fontSize: 48, mr: 2 } }), _jsx(Typography, { variant: "h4", color: "error", children: "Oops! Something went wrong" })] }), _jsx(Typography, { variant: "body1", color: "text.secondary", paragraph: true, children: "We're sorry for the inconvenience. An unexpected error occurred while rendering this component." }), this.state.error && (_jsxs(Paper, { variant: "outlined", sx: { p: 2, mb: 2, bgcolor: 'error.50' }, children: [_jsx(Typography, { variant: "subtitle2", color: "error", gutterBottom: true, children: "Error Message:" }), _jsx(Typography, { variant: "body2", sx: { fontFamily: 'monospace', color: 'error.dark' }, children: this.state.error.toString() })] })), this.state.errorInfo && (_jsxs(Paper, { variant: "outlined", sx: { p: 2, mb: 2, bgcolor: 'grey.50' }, children: [_jsx(Typography, { variant: "subtitle2", gutterBottom: true, children: "Component Stack:" }), _jsx(Typography, { variant: "body2", sx: {
                                        fontFamily: 'monospace',
                                        fontSize: '0.75rem',
                                        whiteSpace: 'pre-wrap',
                                        maxHeight: 200,
                                        overflow: 'auto',
                                    }, children: this.state.errorInfo.componentStack })] })), _jsxs(Box, { display: "flex", gap: 2, children: [_jsx(Button, { variant: "contained", color: "primary", onClick: this.handleReset, children: "Try Again" }), _jsx(Button, { variant: "outlined", color: "primary", onClick: () => window.location.reload(), children: "Reload Page" })] })] }) }));
        }
        return this.props.children;
    }
}
export default ErrorBoundary;
//# sourceMappingURL=ErrorBoundary.js.map