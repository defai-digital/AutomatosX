/**
 * Redux Hooks
 * Type-safe hooks for accessing Redux state and dispatch
 */
import { TypedUseSelectorHook } from 'react-redux';
import type { RootState } from './store/index.js';
export declare const useAppDispatch: () => import("redux-thunk").ThunkDispatch<{
    quality: import("../types/redux.js").QualityState;
    dependency: import("./slices/dependencySlice.js").ExtendedDependencyState;
    ui: import("../types/redux.js").UIState;
}, undefined, import("redux").UnknownAction> & import("redux").Dispatch<import("redux").UnknownAction>;
export declare const useAppSelector: TypedUseSelectorHook<RootState>;
//# sourceMappingURL=hooks.d.ts.map