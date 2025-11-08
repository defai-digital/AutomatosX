/**
 * TypeScriptParserService.test.ts
 *
 * Tests for TypeScript/JavaScript language parser using Tree-sitter
 * Includes comprehensive React/JSX detection tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { TypeScriptParserService } from '../TypeScriptParserService.js';
import { readFileSync } from 'fs';
import { join } from 'path';
describe('TypeScriptParserService', () => {
    let parser;
    beforeEach(() => {
        parser = new TypeScriptParserService();
    });
    describe('metadata', () => {
        it('should have correct language identifier', () => {
            expect(parser.language).toBe('typescript');
        });
        it('should support TypeScript/JavaScript file extensions', () => {
            expect(parser.extensions).toEqual(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
        });
    });
    describe('basic TypeScript parsing', () => {
        it('should parse empty file', () => {
            const result = parser.parse('');
            expect(result.symbols).toEqual([]);
            expect(result.parseTime).toBeGreaterThan(0);
            expect(result.nodeCount).toBeGreaterThan(0);
        });
        it('should extract function declarations', () => {
            const code = `
function hello() {
  return "Hello";
}

function greet(name: string) {
  return \`Hello, \${name}\`;
}
`;
            const result = parser.parse(code);
            const functions = result.symbols.filter(s => s.kind === 'function');
            expect(functions).toHaveLength(2);
            expect(functions[0].name).toBe('hello');
            expect(functions[0].line).toBe(2);
            expect(functions[1].name).toBe('greet');
            expect(functions[1].line).toBe(6);
        });
        it('should extract class declarations', () => {
            const code = `
class User {
  name: string;
  constructor(name: string) {
    this.name = name;
  }
}

class Admin extends User {
  permissions: string[];
}
`;
            const result = parser.parse(code);
            const classes = result.symbols.filter(s => s.kind === 'class');
            expect(classes).toHaveLength(2);
            expect(classes[0].name).toBe('User');
            expect(classes[0].line).toBe(2);
            expect(classes[1].name).toBe('Admin');
            expect(classes[1].line).toBe(9);
        });
        it('should extract interface declarations', () => {
            const code = `
interface User {
  name: string;
  email: string;
}

interface Admin extends User {
  permissions: string[];
}
`;
            const result = parser.parse(code);
            const interfaces = result.symbols.filter(s => s.kind === 'interface');
            expect(interfaces).toHaveLength(2);
            expect(interfaces[0].name).toBe('User');
            expect(interfaces[0].line).toBe(2);
            expect(interfaces[1].name).toBe('Admin');
            expect(interfaces[1].line).toBe(7);
        });
        it('should extract type aliases', () => {
            const code = `
type ID = string | number;

type User = {
  id: ID;
  name: string;
};
`;
            const result = parser.parse(code);
            const types = result.symbols.filter(s => s.kind === 'type');
            expect(types).toHaveLength(2);
            expect(types[0].name).toBe('ID');
            expect(types[0].line).toBe(2);
            expect(types[1].name).toBe('User');
            expect(types[1].line).toBe(4);
        });
        it('should extract enum declarations', () => {
            const code = `
enum Color {
  Red,
  Green,
  Blue
}

enum Status {
  Pending = 'PENDING',
  Active = 'ACTIVE',
  Completed = 'COMPLETED'
}
`;
            const result = parser.parse(code);
            const enums = result.symbols.filter(s => s.kind === 'enum');
            expect(enums).toHaveLength(2);
            expect(enums[0].name).toBe('Color');
            expect(enums[0].line).toBe(2);
            expect(enums[1].name).toBe('Status');
            expect(enums[1].line).toBe(8);
        });
        it('should extract constants and variables', () => {
            const code = `
const API_URL = 'https://api.example.com';
let counter = 0;
var legacyVar = 'old';
`;
            const result = parser.parse(code);
            expect(result.symbols).toHaveLength(3);
            expect(result.symbols[0].name).toBe('API_URL');
            expect(result.symbols[0].kind).toBe('constant');
            expect(result.symbols[0].line).toBe(2);
            expect(result.symbols[1].name).toBe('counter');
            expect(result.symbols[1].kind).toBe('variable');
            expect(result.symbols[1].line).toBe(3);
            expect(result.symbols[2].name).toBe('legacyVar');
            expect(result.symbols[2].kind).toBe('variable');
            expect(result.symbols[2].line).toBe(4);
        });
        it('should extract class methods', () => {
            const code = `
class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }

  subtract(a: number, b: number): number {
    return a - b;
  }
}
`;
            const result = parser.parse(code);
            const methods = result.symbols.filter(s => s.kind === 'method');
            expect(methods).toHaveLength(2);
            expect(methods[0].name).toBe('add');
            expect(methods[0].line).toBe(3);
            expect(methods[1].name).toBe('subtract');
            expect(methods[1].line).toBe(7);
        });
    });
    describe('React component detection', () => {
        it('should detect function components returning JSX', () => {
            const code = `
function Greeting(props) {
  return <h1>Hello, {props.name}!</h1>;
}
`;
            const result = parser.parse(code);
            expect(result.symbols).toHaveLength(1);
            expect(result.symbols[0].name).toBe('Greeting');
            expect(result.symbols[0].kind).toBe('function');
            expect(result.symbols[0].metadata?.isReactComponent).toBe(true);
        });
        it('should detect arrow function components with implicit return', () => {
            const code = `
const WelcomeMessage = ({ message }) => (
  <div className="welcome">
    <p>{message}</p>
  </div>
);
`;
            const result = parser.parse(code);
            expect(result.symbols).toHaveLength(1);
            expect(result.symbols[0].name).toBe('WelcomeMessage');
            expect(result.symbols[0].kind).toBe('function');
            expect(result.symbols[0].metadata?.isReactComponent).toBe(true);
            expect(result.symbols[0].metadata?.isArrowFunction).toBe(true);
        });
        it('should detect arrow function components with explicit return', () => {
            const code = `
const UserCard = ({ name, email }) => {
  return (
    <div className="user-card">
      <h2>{name}</h2>
      <p>{email}</p>
    </div>
  );
};
`;
            const result = parser.parse(code);
            expect(result.symbols).toHaveLength(1);
            expect(result.symbols[0].name).toBe('UserCard');
            expect(result.symbols[0].kind).toBe('function');
            expect(result.symbols[0].metadata?.isReactComponent).toBe(true);
            expect(result.symbols[0].metadata?.isArrowFunction).toBe(true);
        });
        it('should detect class components extending React.Component', () => {
            const code = `
class Timer extends React.Component {
  render() {
    return <div>Seconds: {this.state.seconds}</div>;
  }
}
`;
            const result = parser.parse(code);
            const classes = result.symbols.filter(s => s.kind === 'class');
            expect(classes).toHaveLength(1);
            expect(classes[0].name).toBe('Timer');
            expect(classes[0].metadata?.isReactComponent).toBe(true);
        });
        it('should detect class components extending Component', () => {
            const code = `
import { Component } from 'react';

class TodoList extends Component {
  render() {
    return <ul>{this.props.items.map(item => <li>{item}</li>)}</ul>;
  }
}
`;
            const result = parser.parse(code);
            const classes = result.symbols.filter(s => s.kind === 'class');
            expect(classes).toHaveLength(1);
            expect(classes[0].name).toBe('TodoList');
            expect(classes[0].metadata?.isReactComponent).toBe(true);
        });
        it('should detect PureComponent classes', () => {
            const code = `
class ExpensiveComponent extends React.PureComponent {
  render() {
    return <div>{this.props.data.map(item => <div>{item}</div>)}</div>;
  }
}
`;
            const result = parser.parse(code);
            const classes = result.symbols.filter(s => s.kind === 'class');
            expect(classes).toHaveLength(1);
            expect(classes[0].name).toBe('ExpensiveComponent');
            expect(classes[0].metadata?.isReactComponent).toBe(true);
        });
        it('should detect components returning JSX fragments', () => {
            const code = `
const FragmentExample = () => {
  return (
    <>
      <h1>Title</h1>
      <p>Paragraph</p>
    </>
  );
};
`;
            const result = parser.parse(code);
            expect(result.symbols).toHaveLength(1);
            expect(result.symbols[0].name).toBe('FragmentExample');
            expect(result.symbols[0].kind).toBe('function');
            expect(result.symbols[0].metadata?.isReactComponent).toBe(true);
        });
        it('should detect components with self-closing JSX', () => {
            const code = `
const ImageDisplay = ({ src, alt }) => {
  return <img src={src} alt={alt} />;
};
`;
            const result = parser.parse(code);
            expect(result.symbols).toHaveLength(1);
            expect(result.symbols[0].name).toBe('ImageDisplay');
            expect(result.symbols[0].kind).toBe('function');
            expect(result.symbols[0].metadata?.isReactComponent).toBe(true);
        });
        it('should NOT detect non-component functions as components', () => {
            const code = `
function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item, 0);
}

const formatDate = (date) => {
  return date.toISOString();
};
`;
            const result = parser.parse(code);
            expect(result.symbols).toHaveLength(2);
            expect(result.symbols[0].name).toBe('calculateTotal');
            expect(result.symbols[0].kind).toBe('function');
            expect(result.symbols[0].metadata?.isReactComponent).toBeUndefined();
            expect(result.symbols[1].name).toBe('formatDate');
            expect(result.symbols[1].kind).toBe('constant');
            expect(result.symbols[1].metadata?.isReactComponent).toBeUndefined();
        });
        it('should NOT detect regular classes as React components', () => {
            const code = `
class Calculator {
  add(a, b) {
    return a + b;
  }
}
`;
            const result = parser.parse(code);
            const classes = result.symbols.filter(s => s.kind === 'class');
            expect(classes).toHaveLength(1);
            expect(classes[0].name).toBe('Calculator');
            expect(classes[0].metadata?.isReactComponent).toBeUndefined();
        });
    });
    describe('React hooks detection', () => {
        it('should detect custom hooks with function declaration', () => {
            const code = `
function useCounter(initialValue = 0) {
  const [count, setCount] = useState(initialValue);
  return { count, setCount };
}
`;
            const result = parser.parse(code);
            // Find the useCounter hook (may have additional internal symbols)
            const useCounterHook = result.symbols.find(s => s.name === 'useCounter');
            expect(useCounterHook).toBeDefined();
            expect(useCounterHook?.kind).toBe('function');
            expect(useCounterHook?.metadata?.isHook).toBe(true);
        });
        it('should detect custom hooks with arrow function', () => {
            const code = `
const useToggle = (initialState = false) => {
  const [state, setState] = useState(initialState);
  const toggle = () => setState(s => !s);
  return [state, toggle];
};
`;
            const result = parser.parse(code);
            // Find the useToggle hook (may have additional internal symbols)
            const useToggleHook = result.symbols.find(s => s.name === 'useToggle');
            expect(useToggleHook).toBeDefined();
            expect(useToggleHook?.kind).toBe('function');
            expect(useToggleHook?.metadata?.isHook).toBe(true);
        });
        it('should detect multiple custom hooks', () => {
            const code = `
function useFetch(url) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  return { data, loading };
}

const usePrevious = (value) => {
  const ref = useRef();
  useEffect(() => { ref.current = value; }, [value]);
  return ref.current;
};

function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(initialValue);
  return [storedValue, setStoredValue];
}
`;
            const result = parser.parse(code);
            const hooks = result.symbols.filter(s => s.metadata?.isHook);
            expect(hooks).toHaveLength(3);
            expect(hooks[0].name).toBe('useFetch');
            expect(hooks[1].name).toBe('usePrevious');
            expect(hooks[2].name).toBe('useLocalStorage');
        });
        it('should NOT detect functions starting with "use" but lowercase after as hooks', () => {
            const code = `
function userLogin(email, password) {
  return fetch('/api/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
}

const username = 'john_doe';
`;
            const result = parser.parse(code);
            expect(result.symbols).toHaveLength(2);
            expect(result.symbols[0].name).toBe('userLogin');
            expect(result.symbols[0].kind).toBe('function');
            expect(result.symbols[0].metadata?.isHook).toBeUndefined();
            expect(result.symbols[1].name).toBe('username');
            expect(result.symbols[1].kind).toBe('constant');
            expect(result.symbols[1].metadata?.isHook).toBeUndefined();
        });
    });
    describe('React fixture files', () => {
        it('should parse sample-react-basic.tsx', () => {
            const fixturePath = join(__dirname, 'fixtures', 'react', 'sample-react-basic.tsx');
            const code = readFileSync(fixturePath, 'utf-8');
            const result = parser.parse(code);
            // Should extract components
            const components = result.symbols.filter(s => s.metadata?.isReactComponent);
            expect(components.length).toBeGreaterThan(0);
            // Check specific components
            const greetingComponent = result.symbols.find(s => s.name === 'Greeting');
            expect(greetingComponent).toBeDefined();
            expect(greetingComponent?.metadata?.isReactComponent).toBe(true);
            const welcomeComponent = result.symbols.find(s => s.name === 'WelcomeMessage');
            expect(welcomeComponent).toBeDefined();
            expect(welcomeComponent?.metadata?.isReactComponent).toBe(true);
            const timerClass = result.symbols.find(s => s.name === 'Timer');
            expect(timerClass).toBeDefined();
            expect(timerClass?.kind).toBe('class');
            expect(timerClass?.metadata?.isReactComponent).toBe(true);
            // Non-components should not be marked
            const calculateTotal = result.symbols.find(s => s.name === 'calculateTotal');
            expect(calculateTotal).toBeDefined();
            expect(calculateTotal?.metadata?.isReactComponent).toBeUndefined();
        });
        it('should parse sample-react-hooks.tsx', () => {
            const fixturePath = join(__dirname, 'fixtures', 'react', 'sample-react-hooks.tsx');
            const code = readFileSync(fixturePath, 'utf-8');
            const result = parser.parse(code);
            // Should extract custom hooks
            const hooks = result.symbols.filter(s => s.metadata?.isHook);
            expect(hooks.length).toBeGreaterThan(0);
            // Check specific hooks
            const useCounter = result.symbols.find(s => s.name === 'useCounter');
            expect(useCounter).toBeDefined();
            expect(useCounter?.metadata?.isHook).toBe(true);
            const useToggle = result.symbols.find(s => s.name === 'useToggle');
            expect(useToggle).toBeDefined();
            expect(useToggle?.metadata?.isHook).toBe(true);
            const useFetch = result.symbols.find(s => s.name === 'useFetch');
            expect(useFetch).toBeDefined();
            expect(useFetch?.metadata?.isHook).toBe(true);
            // Non-hooks should not be marked
            const userLogin = result.symbols.find(s => s.name === 'userLogin');
            expect(userLogin).toBeDefined();
            expect(userLogin?.metadata?.isHook).toBeUndefined();
        });
        it('should parse sample-react-patterns.tsx', () => {
            const fixturePath = join(__dirname, 'fixtures', 'react', 'sample-react-patterns.tsx');
            const code = readFileSync(fixturePath, 'utf-8');
            const result = parser.parse(code);
            // Should extract various components and hooks
            const components = result.symbols.filter(s => s.metadata?.isReactComponent);
            expect(components.length).toBeGreaterThan(0);
            // Check ThemeProvider component
            const themeProvider = result.symbols.find(s => s.name === 'ThemeProvider');
            expect(themeProvider).toBeDefined();
            expect(themeProvider?.metadata?.isReactComponent).toBe(true);
            // Check useTheme hook
            const useTheme = result.symbols.find(s => s.name === 'useTheme');
            expect(useTheme).toBeDefined();
            expect(useTheme?.metadata?.isHook).toBe(true);
            // Check usePagination hook
            const usePagination = result.symbols.find(s => s.name === 'usePagination');
            expect(usePagination).toBeDefined();
            expect(usePagination?.metadata?.isHook).toBe(true);
            // Check class components
            const mouseTracker = result.symbols.find(s => s.name === 'MouseTracker');
            expect(mouseTracker).toBeDefined();
            expect(mouseTracker?.kind).toBe('class');
            expect(mouseTracker?.metadata?.isReactComponent).toBe(true);
            const errorBoundary = result.symbols.find(s => s.name === 'ErrorBoundary');
            expect(errorBoundary).toBeDefined();
            expect(errorBoundary?.kind).toBe('class');
            expect(errorBoundary?.metadata?.isReactComponent).toBe(true);
        });
    });
});
//# sourceMappingURL=TypeScriptParserService.test.js.map