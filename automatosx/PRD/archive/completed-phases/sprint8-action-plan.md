# Sprint 8: Web UI & LSP Server - Action Plan

**Sprint**: Sprint 8 (Days 71-80)
**Duration**: 10 days (2 weeks)
**Theme**: "Visual Intelligence & Editor Integration"
**Status**: Ready for Execution
**Created**: 2025-11-08

---

## Overview

This action plan provides tactical, day-by-day implementation guidance for Sprint 8. Each day includes:
- Detailed implementation steps
- Complete code examples
- Testing requirements
- Integration points
- Quality gates

**Focus**: Building production-ready Web UI and LSP Server for AutomatosX v2.

---

## Pre-Sprint Setup

### 1. Environment Verification

Run these checks before starting Day 71:

```bash
# Verify Sprint 7 completion
npm test  # Should have 400 tests passing from Sprint 7

# Check database schema
sqlite3 .automatosx/db/code-intelligence.db ".schema" | grep -E "(code_metrics|technical_debt|dependency_graph)"

# Verify ReScript build
cd packages/rescript-core && npm run build && cd ../..

# Check TypeScript compilation
npm run build:typescript
```

### 2. Install Web UI Dependencies

```bash
# React ecosystem
npm install react@^18.2.0 react-dom@^18.2.0
npm install react-router-dom@^6.20.0
npm install @reduxjs/toolkit@^2.0.0 react-redux@^9.0.0

# UI components
npm install @mui/material@^5.15.0 @mui/icons-material@^5.15.0
npm install @emotion/react@^11.11.0 @emotion/styled@^11.11.0
npm install recharts@^2.10.0
npm install d3@^7.8.0

# Dev dependencies
npm install --save-dev @types/react@^18.2.0 @types/react-dom@^18.2.0
npm install --save-dev @types/d3@^7.4.0
npm install --save-dev vite@^5.0.0
npm install --save-dev @vitejs/plugin-react@^4.2.0

# Build and verify
npm run build
```

### 3. Install LSP Dependencies

```bash
# Language Server Protocol
npm install vscode-languageserver@^9.0.0
npm install vscode-languageserver-textdocument@^1.0.0
npm install vscode-languageserver-protocol@^3.17.0
npm install vscode-uri@^3.0.0

# WebSocket for real-time
npm install ws@^8.16.0
npm install --save-dev @types/ws@^8.5.0
```

### 4. Create Directory Structure

```bash
# Web UI directories
mkdir -p src/web/components/{dashboard,quality,dependencies,queries,settings}
mkdir -p src/web/redux/{slices,store,middleware}
mkdir -p src/web/api
mkdir -p src/web/types
mkdir -p src/web/utils
mkdir -p src/web/hooks

# LSP directories
mkdir -p src/lsp/{server,handlers,providers,utils}
mkdir -p src/lsp/types

# VS Code extension directories
mkdir -p extensions/vscode/src/{commands,views,providers}

# Test directories
mkdir -p src/__tests__/web/{components,redux,api}
mkdir -p src/__tests__/lsp/{server,handlers,providers}
```

### 5. Configure Build Tools

Create `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist/web',
    lib: {
      entry: 'src/web/index.tsx',
      name: 'AutomatosXWeb',
      formats: ['es', 'umd'],
    },
    rollupOptions: {
      external: ['react', 'react-dom'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
});
```

---

## Week 1: Web UI Dashboard + LSP Foundation (Days 71-75)

---

## Day 71: React Dashboard Framework (40 tests)

**Goal**: Build the foundational React application with routing, state management, and component architecture.

**Estimated Time**: 8-10 hours

### Step 1: Application Shell (2 hours)

Create `src/web/App.tsx`:

```typescript
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { ThemeProvider, CssBaseline, Box } from '@mui/material';
import { store } from './redux/store.js';
import { theme } from './theme.js';
import { DashboardLayout } from './components/DashboardLayout.js';
import { HomePage } from './pages/HomePage.js';
import { QualityDashboard } from './pages/QualityDashboard.js';
import { DependencyGraph } from './pages/DependencyGraph.js';
import { TechnicalDebtDashboard } from './pages/TechnicalDebtDashboard.js';
import { QueryBuilder } from './pages/QueryBuilder.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';

export const App: React.FC = () => {
  return (
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <ErrorBoundary>
          <Router>
            <DashboardLayout>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/quality" element={<QualityDashboard />} />
                <Route path="/dependencies" element={<DependencyGraph />} />
                <Route path="/debt" element={<TechnicalDebtDashboard />} />
                <Route path="/queries" element={<QueryBuilder />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </DashboardLayout>
          </Router>
        </ErrorBoundary>
      </ThemeProvider>
    </Provider>
  );
};
```

Create `src/web/theme.ts`:

```typescript
import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#3b82f6', // Blue
    },
    secondary: {
      main: '#10b981', // Green
    },
    error: {
      main: '#ef4444', // Red
    },
    warning: {
      main: '#f59e0b', // Orange
    },
    background: {
      default: '#0f172a', // Dark blue
      paper: '#1e293b',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 700,
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
    },
    code: {
      fontFamily: '"Fira Code", "Courier New", monospace',
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
  },
});
```

### Step 2: Dashboard Layout (1.5 hours)

Create `src/web/components/DashboardLayout.tsx`:

```typescript
import React, { useState } from 'react';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Assessment as AssessmentIcon,
  AccountTree as AccountTreeIcon,
  Warning as WarningIcon,
  Search as SearchIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

const drawerWidth = 240;

interface MenuItem {
  text: string;
  icon: React.ReactElement;
  path: string;
}

const menuItems: MenuItem[] = [
  { text: 'Overview', icon: <DashboardIcon />, path: '/' },
  { text: 'Code Quality', icon: <AssessmentIcon />, path: '/quality' },
  { text: 'Dependencies', icon: <AccountTreeIcon />, path: '/dependencies' },
  { text: 'Technical Debt', icon: <WarningIcon />, path: '/debt' },
  { text: 'Query Builder', icon: <SearchIcon />, path: '/queries' },
  { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
];

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const drawer = (
    <Box>
      <Toolbar>
        <Typography variant="h6" noWrap component="div">
          AutomatosX v2
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => {
                navigate(item.path);
                setMobileOpen(false);
              }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div">
            {menuItems.find((item) => item.path === location.pathname)?.text || 'Dashboard'}
          </Typography>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
};
```

### Step 3: Redux Store Setup (2 hours)

Create `src/web/redux/store.ts`:

```typescript
import { configureStore } from '@reduxjs/toolkit';
import { projectsReducer } from './slices/projectsSlice.js';
import { metricsReducer } from './slices/metricsSlice.js';
import { queriesReducer } from './slices/queriesSlice.js';
import { settingsReducer } from './slices/settingsSlice.js';
import { uiReducer } from './slices/uiSlice.js';
import { apiMiddleware } from './middleware/apiMiddleware.js';

export const store = configureStore({
  reducer: {
    projects: projectsReducer,
    metrics: metricsReducer,
    queries: queriesReducer,
    settings: settingsReducer,
    ui: uiReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(apiMiddleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

Create `src/web/redux/slices/projectsSlice.ts`:

```typescript
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { apiClient } from '../../api/client.js';

export interface Project {
  id: string;
  name: string;
  path: string;
  language: string;
  filesCount: number;
  symbolsCount: number;
  lastIndexed: Date;
  status: 'indexed' | 'indexing' | 'error';
}

interface ProjectsState {
  projects: Project[];
  currentProject: Project | null;
  loading: boolean;
  error: string | null;
}

const initialState: ProjectsState = {
  projects: [],
  currentProject: null,
  loading: false,
  error: null,
};

export const fetchProjects = createAsyncThunk('projects/fetchProjects', async () => {
  const response = await apiClient.get<Project[]>('/api/projects');
  return response.data;
});

export const indexProject = createAsyncThunk(
  'projects/indexProject',
  async (path: string) => {
    const response = await apiClient.post<Project>('/api/projects/index', { path });
    return response.data;
  }
);

const projectsSlice = createSlice({
  name: 'projects',
  initialState,
  reducers: {
    setCurrentProject: (state, action: PayloadAction<Project>) => {
      state.currentProject = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProjects.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProjects.fulfilled, (state, action) => {
        state.loading = false;
        state.projects = action.payload;
      })
      .addCase(fetchProjects.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch projects';
      })
      .addCase(indexProject.pending, (state) => {
        state.loading = true;
      })
      .addCase(indexProject.fulfilled, (state, action) => {
        state.loading = false;
        state.projects.push(action.payload);
      })
      .addCase(indexProject.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to index project';
      });
  },
});

export const { setCurrentProject, clearError } = projectsSlice.actions;
export const projectsReducer = projectsSlice.reducer;
```

Create `src/web/redux/slices/metricsSlice.ts`:

```typescript
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { apiClient } from '../../api/client.js';

export interface CodeMetrics {
  complexity: {
    cyclomatic: number;
    cognitive: number;
    halstead: number;
  };
  maintainability: {
    index: number;
    rating: 'A' | 'B' | 'C' | 'D' | 'F';
  };
  duplication: {
    percentage: number;
    instances: number;
  };
  coverage: {
    lines: number;
    branches: number;
    functions: number;
  };
}

interface MetricsState {
  current: CodeMetrics | null;
  history: { timestamp: Date; metrics: CodeMetrics }[];
  loading: boolean;
  error: string | null;
}

const initialState: MetricsState = {
  current: null,
  history: [],
  loading: false,
  error: null,
};

export const fetchMetrics = createAsyncThunk(
  'metrics/fetchMetrics',
  async (projectId: string) => {
    const response = await apiClient.get<CodeMetrics>(`/api/metrics/${projectId}`);
    return response.data;
  }
);

export const fetchMetricsHistory = createAsyncThunk(
  'metrics/fetchHistory',
  async (params: { projectId: string; days: number }) => {
    const response = await apiClient.get<{ timestamp: Date; metrics: CodeMetrics }[]>(
      `/api/metrics/${params.projectId}/history?days=${params.days}`
    );
    return response.data;
  }
);

const metricsSlice = createSlice({
  name: 'metrics',
  initialState,
  reducers: {
    clearMetrics: (state) => {
      state.current = null;
      state.history = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMetrics.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMetrics.fulfilled, (state, action) => {
        state.loading = false;
        state.current = action.payload;
      })
      .addCase(fetchMetrics.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch metrics';
      })
      .addCase(fetchMetricsHistory.fulfilled, (state, action) => {
        state.history = action.payload;
      });
  },
});

export const { clearMetrics } = metricsSlice.actions;
export const metricsReducer = metricsSlice.reducer;
```

### Step 4: API Client (1.5 hours)

Create `src/web/api/client.ts`:

```typescript
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

export interface ApiConfig {
  baseURL: string;
  timeout: number;
  withCredentials?: boolean;
}

class ApiClient {
  private client: AxiosInstance;

  constructor(config: ApiConfig) {
    this.client = axios.create(config);

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add auth token if available
        const token = localStorage.getItem('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Handle unauthorized
          localStorage.removeItem('auth_token');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.get<T>(url, config);
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.post<T>(url, data, config);
  }

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.put<T>(url, data, config);
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.delete<T>(url, config);
  }
}

export const apiClient = new ApiClient({
  baseURL: process.env.VITE_API_URL || 'http://localhost:8080',
  timeout: 30000,
  withCredentials: true,
});
```

### Step 5: Error Boundary (1 hour)

Create `src/web/components/ErrorBoundary.tsx`:

```typescript
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import { Error as ErrorIcon } from '@mui/icons-material';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Error boundary caught:', error, errorInfo);
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
    window.location.href = '/';
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            backgroundColor: 'background.default',
          }}
        >
          <Paper
            sx={{
              p: 4,
              maxWidth: 600,
              textAlign: 'center',
            }}
          >
            <ErrorIcon sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
            <Typography variant="h4" gutterBottom>
              Something went wrong
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              {this.state.error?.message || 'An unexpected error occurred'}
            </Typography>
            <Button variant="contained" onClick={this.handleReset}>
              Go to Dashboard
            </Button>
            {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
              <Box sx={{ mt: 3, textAlign: 'left' }}>
                <Typography variant="caption" component="pre" sx={{ overflow: 'auto' }}>
                  {this.state.errorInfo.componentStack}
                </Typography>
              </Box>
            )}
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}
```

### Step 6: Custom Hooks (1 hour)

Create `src/web/hooks/useAppDispatch.ts`:

```typescript
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '../redux/store.js';

export const useAppDispatch = (): AppDispatch => useDispatch<AppDispatch>();
```

Create `src/web/hooks/useAppSelector.ts`:

```typescript
import { TypedUseSelectorHook, useSelector } from 'react-redux';
import type { RootState } from '../redux/store.js';

export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
```

Create `src/web/hooks/useWebSocket.ts`:

```typescript
import { useEffect, useRef, useState } from 'react';

export interface WebSocketMessage<T = any> {
  type: string;
  payload: T;
  timestamp: Date;
}

export const useWebSocket = (url: string) => {
  const ws = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);

  useEffect(() => {
    ws.current = new WebSocket(url);

    ws.current.onopen = () => {
      setIsConnected(true);
    };

    ws.current.onclose = () => {
      setIsConnected(false);
    };

    ws.current.onmessage = (event) => {
      const message = JSON.parse(event.data) as WebSocketMessage;
      setLastMessage(message);
    };

    return () => {
      ws.current?.close();
    };
  }, [url]);

  const send = (message: WebSocketMessage) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    }
  };

  return { isConnected, lastMessage, send };
};
```

### Step 7: Tests for Day 71 (40 tests, 2 hours)

Create `src/__tests__/web/App.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from '../../web/App.js';

describe('App Component', () => {
  it('should render without crashing', () => {
    render(<App />);
    expect(screen.getByText(/AutomatosX v2/i)).toBeInTheDocument();
  });

  it('should render navigation menu', () => {
    render(<App />);
    expect(screen.getByText(/Overview/i)).toBeInTheDocument();
    expect(screen.getByText(/Code Quality/i)).toBeInTheDocument();
    expect(screen.getByText(/Dependencies/i)).toBeInTheDocument();
  });
});
```

Create `src/__tests__/web/redux/projectsSlice.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { projectsReducer, setCurrentProject } from '../../../web/redux/slices/projectsSlice.js';
import type { Project } from '../../../web/redux/slices/projectsSlice.js';

describe('Projects Slice', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        projects: projectsReducer,
      },
    });
  });

  it('should have initial state', () => {
    const state = store.getState().projects;
    expect(state.projects).toEqual([]);
    expect(state.currentProject).toBeNull();
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('should set current project', () => {
    const project: Project = {
      id: '1',
      name: 'test-project',
      path: '/path/to/project',
      language: 'typescript',
      filesCount: 100,
      symbolsCount: 500,
      lastIndexed: new Date(),
      status: 'indexed',
    };

    store.dispatch(setCurrentProject(project));
    const state = store.getState().projects;
    expect(state.currentProject).toEqual(project);
  });
});
```

**Continue creating 38 more tests** covering:
- Navigation routing (8 tests)
- Redux actions and reducers (12 tests)
- API client methods (8 tests)
- Error boundary behavior (5 tests)
- Custom hooks (7 tests)

### Day 71 Quality Gate

**Before moving to Day 72, verify**:
- ✅ All 40 tests passing
- ✅ React app renders without errors
- ✅ Navigation between routes works
- ✅ Redux store updates correctly
- ✅ API client makes requests
- ✅ No TypeScript errors
- ✅ Linter clean

**Command**:
```bash
npm test -- src/__tests__/web/
npm run build
npm run lint
```

---

## Day 72-80: Implementation Outlines

### Day 72: Quality Dashboard UI (45 tests)
- Complexity charts (line, bar, trend)
- Maintainability gauge
- Duplication heatmap
- Interactive drill-down
- Export to PDF/PNG

### Day 73: Dependency Graph Visualization (40 tests)
- D3.js force-directed layout
- Node clustering
- Edge bundling
- Circular dependency highlighting
- Zoom and pan controls

### Day 74: LSP Server Foundation (50 tests)
- LSP protocol implementation
- Document management
- Go-to-definition handler
- Find references handler
- Hover provider

### Day 75: WebSocket Real-time Updates (35 tests)
- WebSocket server setup
- Event broadcasting
- Client connection management
- Real-time metrics updates
- Collaborative annotations

### Day 76: VS Code Extension (45 tests)
- Extension manifest
- Tree view provider
- Webview panels
- Command palette integration
- Settings configuration

### Day 77: Code Lens & Diagnostics (40 tests)
- Code lens provider
- Diagnostic publisher
- Quick fix actions
- Refactoring suggestions
- Performance warnings

### Day 78: Collaborative Annotations (35 tests)
- Annotation storage (SQLite)
- Annotation sync (WebSocket)
- Annotation UI (React)
- Commenting system
- User mentions

### Day 79: Performance Optimization (35 tests)
- React.memo optimization
- Virtualized lists
- Code splitting
- Lazy loading
- Bundle size reduction

### Day 80: Sprint Gate Review (35 tests)
- End-to-end testing
- Performance benchmarking
- Documentation completion
- Deployment guide
- Release preparation

---

## Daily Workflow

### Morning (1 hour)
1. Pull latest changes
2. Review previous day's work
3. Run full test suite
4. Plan today's tasks

### Implementation (5-6 hours)
1. Write tests first (TDD)
2. Implement feature
3. Run tests continuously
4. Commit frequently

### Testing (1-2 hours)
1. Run full test suite
2. Manual testing in browser
3. Fix any failures
4. Update documentation

### Wrap-up (30 min)
1. Code review
2. Push changes
3. Update progress tracking
4. Plan next day

---

## Testing Strategy

### Unit Tests (280 tests)
- Component rendering
- Redux state management
- API client calls
- Utility functions
- Custom hooks

### Integration Tests (80 tests)
- End-to-end user flows
- API integration
- WebSocket communication
- LSP protocol compliance

### E2E Tests (40 tests)
- Full user journeys
- Cross-browser testing
- Performance testing
- Accessibility testing

---

## Quality Gates

### Daily Gates
- All new tests passing
- No TypeScript errors
- Linter clean (ESLint + Prettier)
- Build succeeds
- No console errors/warnings

### Weekly Gates (Day 75, Day 80)
- Cumulative test count met
- Performance benchmarks passed
- Code coverage > 80%
- Documentation complete
- No critical bugs

---

## Sprint 8 Success Criteria

**Completion Requirements**:
- ✅ 400 tests passing (100%)
- ✅ Web UI fully functional
- ✅ LSP server operational
- ✅ VS Code extension published
- ✅ Real-time features working
- ✅ Performance targets met (<100ms P95)
- ✅ Documentation complete

**Deliverables**:
1. Production-ready Web dashboard
2. LSP server implementation
3. VS Code extension
4. Real-time collaboration system
5. Comprehensive test suite
6. User documentation
7. API documentation
8. Deployment guide

---

## Risk Management

### Technical Risks
- **React performance at scale** → Mitigation: Virtualization, memoization
- **LSP complexity** → Mitigation: Use vscode-languageserver library
- **WebSocket reliability** → Mitigation: Auto-reconnect, heartbeat

### Schedule Risks
- **Scope creep** → Mitigation: Strict PRD adherence
- **Integration delays** → Mitigation: Early API contracts

### Team Risks
- **React learning curve** → Mitigation: Pair programming, code examples
- **LSP protocol knowledge** → Mitigation: Reference implementations

---

## Resources

### Documentation
- React Docs: https://react.dev
- Redux Toolkit: https://redux-toolkit.js.org
- LSP Specification: https://microsoft.github.io/language-server-protocol
- VS Code Extension API: https://code.visualstudio.com/api

### Code Examples
- This action plan (Day 71 complete implementation)
- Sprint 8 PRD (architectural patterns)
- Reference projects: vscode-typescript-language-features

---

**Sprint 8 Action Plan - Ready for Execution**
**Next Step**: Begin Day 71 implementation following the detailed steps above.
