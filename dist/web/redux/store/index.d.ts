/**
 * Redux Store Configuration
 * Configures the Redux store with all slices and middleware
 */
export declare const store: import("@reduxjs/toolkit").EnhancedStore<{
    quality: import("../../types/redux.js").QualityState;
    dependency: import("../slices/dependencySlice.js").ExtendedDependencyState;
    ui: import("../../types/redux.js").UIState;
}, import("redux").UnknownAction, import("@reduxjs/toolkit").Tuple<[import("redux").StoreEnhancer<{
    dispatch: import("redux-thunk").ThunkDispatch<{
        quality: import("../../types/redux.js").QualityState;
        dependency: import("../slices/dependencySlice.js").ExtendedDependencyState;
        ui: import("../../types/redux.js").UIState;
    }, undefined, import("redux").UnknownAction>;
}>, import("redux").StoreEnhancer]>>;
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
//# sourceMappingURL=index.d.ts.map