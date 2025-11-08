/**
 * sample-react-patterns.tsx
 *
 * Modern React patterns and advanced component architectures
 * Tests HOCs, render props, Context, compound components, and advanced patterns
 */
import React, { ReactNode, ComponentType } from 'react';
declare function ThemeProvider({ children }: {
    children: ReactNode;
}): any;
declare function useTheme(): any;
declare const ThemedButton: () => any;
interface WithLoadingProps {
    loading: boolean;
}
declare function withLoading<P extends object>(Component: ComponentType<P>): ComponentType<P & WithLoadingProps>;
declare const UserList: ({ users }: {
    users: string[];
}) => any;
declare const UserListWithLoading: ComponentType<P & WithLoadingProps>;
interface MousePosition {
    x: number;
    y: number;
}
interface MouseTrackerProps {
    render: (position: MousePosition) => ReactNode;
}
declare class MouseTracker extends React.Component<MouseTrackerProps, MousePosition> {
    constructor(props: MouseTrackerProps);
    handleMouseMove: (event: React.MouseEvent) => void;
    render(): any;
}
declare const MouseDisplay: () => any;
declare function Tabs({ children, defaultTab }: {
    children: ReactNode;
    defaultTab: string;
}): any;
declare function TabList({ children }: {
    children: ReactNode;
}): any;
declare function Tab({ id, children }: {
    id: string;
    children: ReactNode;
}): any;
declare function TabPanel({ id, children }: {
    id: string;
    children: ReactNode;
}): any;
declare const TabsExample: () => any;
interface FormInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}
declare const FormInput: ({ value, onChange, placeholder }: FormInputProps) => any;
declare function ControlledForm(): any;
interface Paginated<T> {
    items: T[];
    page: number;
    totalPages: number;
    nextPage: () => void;
    prevPage: () => void;
    goToPage: (page: number) => void;
}
declare function usePagination<T>(allItems: T[], itemsPerPage: number): Paginated<T>;
declare function PaginatedList({ items }: {
    items: string[];
}): any;
interface ExpensiveComponentProps {
    data: number[];
}
declare class ExpensiveComponent extends React.PureComponent<ExpensiveComponentProps> {
    render(): any;
}
interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode;
}
interface ErrorBoundaryState {
    hasError: boolean;
    error?: Error;
}
declare class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps);
    static getDerivedStateFromError(error: Error): {
        hasError: boolean;
        error: Error;
    };
    componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void;
    render(): any;
}
export { ThemeProvider, useTheme, ThemedButton, withLoading, UserList, UserListWithLoading, MouseTracker, MouseDisplay, Tabs, TabList, Tab, TabPanel, TabsExample, FormInput, ControlledForm, usePagination, PaginatedList, ExpensiveComponent, ErrorBoundary, };
//# sourceMappingURL=sample-react-patterns.d.ts.map