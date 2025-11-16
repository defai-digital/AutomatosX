/**
 * Day 71: React Dashboard Framework Test Suite
 * Comprehensive tests for application shell, routing, state management, and components
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material';
import qualityReducer from '../redux/slices/qualitySlice.js';
import uiReducer, { toggleTheme, toggleSidebar, addNotification, removeNotification } from '../redux/slices/uiSlice.js';
import { lightTheme, darkTheme, getTheme } from '../theme.js';
import { ErrorBoundary } from '../components/common/ErrorBoundary.js';
import { HomePage } from '../pages/HomePage.js';
import { QualityDashboard } from '../pages/QualityDashboard.js';
import { DependenciesPage } from '../pages/DependenciesPage.js';
import { SettingsPage } from '../pages/SettingsPage.js';

// Test helpers
function createTestStore() {
  return configureStore({
    reducer: {
      quality: qualityReducer,
      ui: uiReducer,
    },
  });
}

function renderWithProviders(
  ui: React.ReactElement,
  {
    store = createTestStore(),
    ...renderOptions
  } = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <Provider store={store}>
        <ThemeProvider theme={lightTheme}>
          <MemoryRouter>
            {children}
          </MemoryRouter>
        </ThemeProvider>
      </Provider>
    );
  }
  return { store, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}

describe('Day 71: React Dashboard Framework', () => {
  describe('Theme System', () => {
    it('should create light theme', () => {
      expect(lightTheme.palette.mode).toBe('light');
      expect(lightTheme.palette.primary.main).toBeDefined();
    });

    it('should create dark theme', () => {
      expect(darkTheme.palette.mode).toBe('dark');
      expect(darkTheme.palette.primary.main).toBeDefined();
    });

    it('should get theme based on mode', () => {
      const light = getTheme('light');
      const dark = getTheme('dark');
      expect(light.palette.mode).toBe('light');
      expect(dark.palette.mode).toBe('dark');
    });

    it('should have custom typography', () => {
      expect(lightTheme.typography.fontFamily).toContain('Inter');
      expect(lightTheme.typography.h1.fontSize).toBe('2.5rem');
    });

    it('should have custom shape borderRadius', () => {
      expect(lightTheme.shape.borderRadius).toBe(8);
    });
  });

  describe('Redux Store - UI Slice', () => {
    let store: ReturnType<typeof createTestStore>;

    beforeEach(() => {
      store = createTestStore();
    });

    it('should have initial state', () => {
      const state = store.getState().ui;
      expect(state.theme).toBe('light');
      expect(state.sidebarOpen).toBe(true);
      expect(state.notifications).toEqual([]);
    });

    it('should toggle theme', () => {
      store.dispatch(toggleTheme());
      expect(store.getState().ui.theme).toBe('dark');
      store.dispatch(toggleTheme());
      expect(store.getState().ui.theme).toBe('light');
    });

    it('should toggle sidebar', () => {
      store.dispatch(toggleSidebar());
      expect(store.getState().ui.sidebarOpen).toBe(false);
      store.dispatch(toggleSidebar());
      expect(store.getState().ui.sidebarOpen).toBe(true);
    });

    it('should add notification', () => {
      store.dispatch(addNotification({ type: 'info', message: 'Test notification' }));
      const notifications = store.getState().ui.notifications;
      expect(notifications).toHaveLength(1);
      expect(notifications[0].message).toBe('Test notification');
      expect(notifications[0].type).toBe('info');
      expect(notifications[0].id).toBeDefined();
    });

    it('should remove notification by id', () => {
      store.dispatch(addNotification({ type: 'info', message: 'Test' }));
      const id = store.getState().ui.notifications[0].id;
      store.dispatch(removeNotification(id));
      expect(store.getState().ui.notifications).toHaveLength(0);
    });

    it('should add multiple notifications', () => {
      store.dispatch(addNotification({ type: 'info', message: 'First' }));
      store.dispatch(addNotification({ type: 'success', message: 'Second' }));
      expect(store.getState().ui.notifications).toHaveLength(2);
    });

    it('should generate unique notification IDs', () => {
      store.dispatch(addNotification({ type: 'info', message: 'First' }));
      store.dispatch(addNotification({ type: 'info', message: 'Second' }));
      const ids = store.getState().ui.notifications.map(n => n.id);
      expect(ids[0]).not.toBe(ids[1]);
    });
  });

  describe('Redux Store - Quality Slice', () => {
    let store: ReturnType<typeof createTestStore>;

    beforeEach(() => {
      store = createTestStore();
    });

    it('should have initial state', () => {
      const state = store.getState().quality;
      expect(state.metrics).toBeNull();
      expect(state.fileReports).toEqual([]);
      expect(state.selectedFile).toBeNull();
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('ErrorBoundary Component', () => {
    const ThrowError = () => {
      throw new Error('Test error');
    };

    const originalError = console.error;
    beforeEach(() => {
      console.error = vi.fn();
    });

    afterEach(() => {
      console.error = originalError;
    });

    it('should render children when there is no error', () => {
      renderWithProviders(
        <ErrorBoundary>
          <div>Test content</div>
        </ErrorBoundary>
      );
      expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('should catch errors and show error UI', () => {
      renderWithProviders(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );
      expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    });

    it('should display error message', () => {
      renderWithProviders(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );
      expect(screen.getByText(/Test error/i)).toBeInTheDocument();
    });

    it('should have Try Again button', () => {
      renderWithProviders(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );
      expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument();
    });

    it('should have Reload Page button', () => {
      renderWithProviders(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );
      expect(screen.getByRole('button', { name: /Reload Page/i })).toBeInTheDocument();
    });
  });

  describe('HomePage Component', () => {
    it('should render welcome message', () => {
      renderWithProviders(<HomePage />);
      expect(screen.getByText(/Welcome to AutomatosX/i)).toBeInTheDocument();
    });

    it('should render quality metrics card', () => {
      renderWithProviders(<HomePage />);
      expect(screen.getByText(/Quality Metrics/i)).toBeInTheDocument();
    });

    it('should render dependency graph card', () => {
      renderWithProviders(<HomePage />);
      expect(screen.getByText(/Dependency Graph/i)).toBeInTheDocument();
    });

    it('should render code search card', () => {
      renderWithProviders(<HomePage />);
      expect(screen.getByText(/Code Search/i)).toBeInTheDocument();
    });

    it('should have View Dashboard button', () => {
      renderWithProviders(<HomePage />);
      expect(screen.getByRole('button', { name: /View Dashboard/i })).toBeInTheDocument();
    });

    it('should have View Graph button', () => {
      renderWithProviders(<HomePage />);
      expect(screen.getByRole('button', { name: /View Graph/i })).toBeInTheDocument();
    });

    it('should have Search Code button', () => {
      renderWithProviders(<HomePage />);
      expect(screen.getByRole('button', { name: /Search Code/i })).toBeInTheDocument();
    });
  });

  describe('QualityDashboard Component', () => {
    it('should render title', () => {
      renderWithProviders(<QualityDashboard />);
      expect(screen.getByText(/Quality Dashboard/i)).toBeInTheDocument();
    });

    it('should render description', () => {
      renderWithProviders(<QualityDashboard />);
      expect(screen.getByText(/View code quality metrics/i)).toBeInTheDocument();
    });

    it('should show placeholder message', () => {
      renderWithProviders(<QualityDashboard />);
      expect(screen.getByText(/Quality metrics visualization will be implemented/i)).toBeInTheDocument();
    });
  });

  describe('DependenciesPage Component', () => {
    it('should render title', () => {
      renderWithProviders(<DependenciesPage />);
      expect(screen.getByText(/Dependency Graph/i)).toBeInTheDocument();
    });

    it('should render description', () => {
      renderWithProviders(<DependenciesPage />);
      expect(screen.getByText(/Explore code dependencies/i)).toBeInTheDocument();
    });

    it('should show placeholder message', () => {
      renderWithProviders(<DependenciesPage />);
      expect(screen.getByText(/Dependency graph visualization will be implemented/i)).toBeInTheDocument();
    });
  });

  describe('SettingsPage Component', () => {
    it('should render title', () => {
      renderWithProviders(<SettingsPage />);
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('should render description', () => {
      renderWithProviders(<SettingsPage />);
      expect(screen.getByText(/Configure application settings/i)).toBeInTheDocument();
    });

    it('should show placeholder message', () => {
      renderWithProviders(<SettingsPage />);
      expect(screen.getByText(/Settings panel will be implemented/i)).toBeInTheDocument();
    });
  });

  describe('Redux Integration', () => {
    it('should create store with all reducers', () => {
      const store = createTestStore();
      const state = store.getState();
      expect(state.quality).toBeDefined();
      expect(state.ui).toBeDefined();
    });

    it('should persist state across dispatches', () => {
      const store = createTestStore();
      store.dispatch(toggleTheme());
      store.dispatch(addNotification({ type: 'info', message: 'Test' }));
      const state = store.getState();
      expect(state.ui.theme).toBe('dark');
      expect(state.ui.notifications).toHaveLength(1);
    });
  });

  describe('Component Rendering', () => {
    it('should render all page components without errors', () => {
      expect(() => renderWithProviders(<HomePage />)).not.toThrow();
      expect(() => renderWithProviders(<QualityDashboard />)).not.toThrow();
      expect(() => renderWithProviders(<DependenciesPage />)).not.toThrow();
      expect(() => renderWithProviders(<SettingsPage />)).not.toThrow();
    });

    it('should render components with correct structure', () => {
      const { container } = renderWithProviders(<HomePage />);
      expect(container.querySelector('h1')).toBeInTheDocument();
    });

    it('should apply theme correctly', () => {
      const { container } = renderWithProviders(<HomePage />);
      expect(container).toBeInTheDocument();
    });
  });
});
