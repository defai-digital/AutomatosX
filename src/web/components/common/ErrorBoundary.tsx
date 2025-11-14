/**
 * ErrorBoundary Component
 * Catches JavaScript errors anywhere in the component tree
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Button, Container, Typography, Paper } from '@mui/material';
import { ErrorOutline as ErrorIcon } from '@mui/icons-material';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Container maxWidth="md" sx={{ mt: 8 }}>
          <Paper elevation={3} sx={{ p: 4 }}>
            <Box display="flex" alignItems="center" mb={2}>
              <ErrorIcon color="error" sx={{ fontSize: 48, mr: 2 }} />
              <Typography variant="h4" color="error">
                Oops! Something went wrong
              </Typography>
            </Box>

            <Typography variant="body1" color="text.secondary" paragraph>
              We're sorry for the inconvenience. An unexpected error occurred while rendering this
              component.
            </Typography>

            {this.state.error && (
              <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'error.50' }}>
                <Typography variant="subtitle2" color="error" gutterBottom>
                  Error Message:
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'error.dark' }}>
                  {this.state.error.toString()}
                </Typography>
              </Paper>
            )}

            {this.state.errorInfo && (
              <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
                <Typography variant="subtitle2" gutterBottom>
                  Component Stack:
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    whiteSpace: 'pre-wrap',
                    maxHeight: 200,
                    overflow: 'auto',
                  }}
                >
                  {this.state.errorInfo.componentStack}
                </Typography>
              </Paper>
            )}

            <Box display="flex" gap={2}>
              <Button variant="contained" color="primary" onClick={this.handleReset}>
                Try Again
              </Button>
              <Button
                variant="outlined"
                color="primary"
                onClick={() => window.location.reload()}
              >
                Reload Page
              </Button>
            </Box>
          </Paper>
        </Container>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
