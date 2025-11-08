/**
 * sample-react-hooks.tsx
 *
 * Custom React hooks and advanced hook patterns
 * Tests hook detection with "use" prefix naming convention
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
// Custom hook - should be detected as hook
function useCounter(initialValue = 0) {
    const [count, setCount] = useState(initialValue);
    const increment = useCallback(() => {
        setCount(c => c + 1);
    }, []);
    const decrement = useCallback(() => {
        setCount(c => c - 1);
    }, []);
    const reset = useCallback(() => {
        setCount(initialValue);
    }, [initialValue]);
    return { count, increment, decrement, reset };
}
// Custom hook with arrow function - should be detected as hook
const useToggle = (initialState = false) => {
    const [state, setState] = useState(initialState);
    const toggle = useCallback(() => {
        setState(s => !s);
    }, []);
    return [state, toggle];
};
// Custom hook for fetching data
function useFetch(url) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        fetch(url)
            .then(res => res.json())
            .then(data => {
            if (!cancelled) {
                setData(data);
                setLoading(false);
            }
        })
            .catch(err => {
            if (!cancelled) {
                setError(err);
                setLoading(false);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [url]);
    return { data, loading, error };
}
// Custom hook with useRef
function usePrevious(value) {
    const ref = useRef();
    useEffect(() => {
        ref.current = value;
    }, [value]);
    return ref.current;
}
// Custom hook with useMemo
const useFilteredList = (items, filterFn) => {
    return useMemo(() => {
        return items.filter(filterFn);
    }, [items, filterFn]);
};
// Custom hook for local storage
function useLocalStorage(key, initialValue) {
    const [storedValue, setStoredValue] = useState(() => {
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        }
        catch (error) {
            return initialValue;
        }
    });
    const setValue = (value) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
        }
        catch (error) {
            console.error(error);
        }
    };
    return [storedValue, setValue];
}
// Custom hook with multiple hooks composition
function useDebounce(value, delay) {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
}
// Custom hook for window dimensions
const useWindowSize = () => {
    const [windowSize, setWindowSize] = useState({
        width: window.innerWidth,
        height: window.innerHeight,
    });
    useEffect(() => {
        const handleResize = () => {
            setWindowSize({
                width: window.innerWidth,
                height: window.innerHeight,
            });
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    return windowSize;
};
// Custom hook for async data
function useAsync(asyncFunction, immediate = true) {
    const [status, setStatus] = useState('idle');
    const [value, setValue] = useState(null);
    const [error, setError] = useState(null);
    const execute = useCallback(() => {
        setStatus('pending');
        setValue(null);
        setError(null);
        return asyncFunction()
            .then((response) => {
            setValue(response);
            setStatus('success');
        })
            .catch((error) => {
            setError(error);
            setStatus('error');
        });
    }, [asyncFunction]);
    useEffect(() => {
        if (immediate) {
            execute();
        }
    }, [execute, immediate]);
    return { execute, status, value, error };
}
// Custom hook with event listener
function useEventListener(eventName, handler, element = window) {
    const savedHandler = useRef(handler);
    useEffect(() => {
        savedHandler.current = handler;
    }, [handler]);
    useEffect(() => {
        const eventListener = (event) => savedHandler.current(event);
        element.addEventListener(eventName, eventListener);
        return () => {
            element.removeEventListener(eventName, eventListener);
        };
    }, [eventName, element]);
}
// Custom hook for media query
const useMediaQuery = (query) => {
    const [matches, setMatches] = useState(false);
    useEffect(() => {
        const media = window.matchMedia(query);
        if (media.matches !== matches) {
            setMatches(media.matches);
        }
        const listener = () => setMatches(media.matches);
        media.addEventListener('change', listener);
        return () => media.removeEventListener('change', listener);
    }, [matches, query]);
    return matches;
};
// Function that starts with "use" but is NOT a hook (lowercase after "use")
function userLogin(email, password) {
    return fetch('/api/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
    }).then(res => res.json());
}
// Constant that starts with "use" but is NOT a hook
const username = 'john_doe';
// Component using custom hooks
function CounterComponent() {
    const { count, increment, decrement, reset } = useCounter(0);
    return (<div>
      <p>Count: {count}</p>
      <button onClick={increment}>+</button>
      <button onClick={decrement}>-</button>
      <button onClick={reset}>Reset</button>
    </div>);
}
// Component using custom toggle hook
const ToggleComponent = () => {
    const [isOn, toggle] = useToggle(false);
    return (<button onClick={toggle}>
      {isOn ? 'ON' : 'OFF'}
    </button>);
};
// Export for testing
export { useCounter, useToggle, useFetch, usePrevious, useFilteredList, useLocalStorage, useDebounce, useWindowSize, useAsync, useEventListener, useMediaQuery, userLogin, username, CounterComponent, ToggleComponent, };
//# sourceMappingURL=sample-react-hooks.js.map