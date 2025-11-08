/**
 * sample-react-hooks.tsx
 *
 * Custom React hooks and advanced hook patterns
 * Tests hook detection with "use" prefix naming convention
 */
declare function useCounter(initialValue?: number): {
    count: any;
    increment: any;
    decrement: any;
    reset: any;
};
declare const useToggle: (initialState?: boolean) => readonly [any, any];
declare function useFetch<T>(url: string): {
    data: any;
    loading: any;
    error: any;
};
declare function usePrevious<T>(value: T): any;
declare const useFilteredList: <T>(items: T[], filterFn: (item: T) => boolean) => any;
declare function useLocalStorage<T>(key: string, initialValue: T): readonly [any, (value: T | ((val: T) => T)) => void];
declare function useDebounce<T>(value: T, delay: number): any;
declare const useWindowSize: () => any;
declare function useAsync<T>(asyncFunction: () => Promise<T>, immediate?: boolean): {
    execute: any;
    status: any;
    value: any;
    error: any;
};
declare function useEventListener(eventName: string, handler: (event: Event) => void, element?: HTMLElement | Window): void;
declare const useMediaQuery: (query: string) => boolean;
declare function userLogin(email: string, password: string): Promise<void>;
declare const username = "john_doe";
declare function CounterComponent(): any;
declare const ToggleComponent: () => any;
export { useCounter, useToggle, useFetch, usePrevious, useFilteredList, useLocalStorage, useDebounce, useWindowSize, useAsync, useEventListener, useMediaQuery, userLogin, username, CounterComponent, ToggleComponent, };
//# sourceMappingURL=sample-react-hooks.d.ts.map