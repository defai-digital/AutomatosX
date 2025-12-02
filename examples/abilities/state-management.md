# State Management

Manage application state effectively using appropriate patterns and tools.

## State Classification

### 1. Local State
- Component-specific state (form inputs, UI toggles)
- Use: useState, useReducer
- Keep state close to where it's used

### 2. Shared State
- State shared between multiple components
- Use: Context API for theme, auth, locale
- Avoid Context for frequently changing values (causes re-renders)

### 3. Server State
- Data fetched from APIs
- Use: React Query, SWR, or Apollo Client
- Benefits: caching, background updates, optimistic UI
- Don't store server data in global state

### 4. Global Application State
- Complex state shared across the app
- Use: Redux Toolkit, Zustand, Jotai, or Recoil
- Examples: shopping cart, user preferences, app config

## Choosing the Right Tool

| State Type | Tool | Use Case |
|------------|------|----------|
| Local UI | useState | Form inputs, modals, dropdowns |
| Computed | useMemo | Derived values, expensive calculations |
| Shared Simple | Context | Theme, auth status, locale |
| Server Data | React Query/SWR | API data, caching, refetching |
| Global Complex | Redux/Zustand | Cart, multi-step forms, app-wide config |

## Best Practices

### State Placement
- Keep state as local as possible
- Lift state up only when necessary
- Avoid prop drilling (use Context or state management library)
- Co-locate state with components that use it

### State Updates
- Never mutate state directly (use immutable updates)
- Use functional updates for state that depends on previous value
- Batch related state updates
- Avoid excessive state splitting (group related state)

### Performance
- Memoize expensive computations (useMemo)
- Memoize callbacks (useCallback)
- Use state selectors to prevent unnecessary re-renders
- Split contexts to avoid re-rendering unrelated components

### Context API Guidelines
- Create separate contexts for separate concerns
- Don't put frequently changing values in Context (causes re-renders)
- Use Context for truly global, infrequently changing data
- Consider useMemo for context values

### Redux Toolkit Guidelines
- Use createSlice for reducers
- Use createAsyncThunk for async actions
- Use selectors with reselect for derived data
- Normalize complex nested state
- Keep business logic in reducers, not components

### React Query/SWR Guidelines
- Set appropriate staleTime and cacheTime
- Use queryKey properly (includes dependencies)
- Implement optimistic updates for better UX
- Handle loading and error states
- Use mutations for POST/PUT/DELETE

## Anti-Patterns to Avoid

❌ Storing server data in Redux (use React Query instead)
❌ Putting everything in global state
❌ Mutating state directly
❌ Using Context for high-frequency updates
❌ Over-fetching data (fetch only what you need)
❌ Ignoring loading and error states
❌ Complex state logic in components (move to reducers/hooks)

## Quick Checklist

- [ ] State is placed at appropriate level (local vs shared)
- [ ] Using correct tool for state type
- [ ] Server state managed by React Query/SWR
- [ ] State updates are immutable
- [ ] Performance optimizations applied (memoization, selectors)
- [ ] Loading and error states handled
- [ ] No prop drilling (use Context or state library)
