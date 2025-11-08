/**
 * sample-react-patterns.tsx
 *
 * Modern React patterns and advanced component architectures
 * Tests HOCs, render props, Context, compound components, and advanced patterns
 */
import React, { createContext, useContext, useState } from 'react';
const ThemeContext = createContext(undefined);
function ThemeProvider({ children }) {
    const [theme, setTheme] = useState('light');
    const toggleTheme = () => {
        setTheme(theme === 'light' ? 'dark' : 'light');
    };
    return (<ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>);
}
// Custom hook for consuming context
function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider');
    }
    return context;
}
// Component using context
const ThemedButton = () => {
    const { theme, toggleTheme } = useTheme();
    return (<button onClick={toggleTheme} style={{
            backgroundColor: theme === 'light' ? '#fff' : '#333',
            color: theme === 'light' ? '#333' : '#fff',
        }}>
      Toggle Theme
    </button>);
};
// HOC that adds loading functionality
function withLoading(Component) {
    return function WithLoadingComponent({ loading, ...props }) {
        if (loading) {
            return <div>Loading...</div>;
        }
        return <Component {...props}/>;
    };
}
// Component to be enhanced
const UserList = ({ users }) => {
    return (<ul>
      {users.map((user, index) => (<li key={index}>{user}</li>))}
    </ul>);
};
// Enhanced component with HOC
const UserListWithLoading = withLoading(UserList);
class MouseTracker extends React.Component {
    constructor(props) {
        super(props);
        this.state = { x: 0, y: 0 };
    }
    handleMouseMove = (event) => {
        this.setState({
            x: event.clientX,
            y: event.clientY,
        });
    };
    render() {
        return (<div onMouseMove={this.handleMouseMove}>
        {this.props.render(this.state)}
      </div>);
    }
}
// Component using render prop
const MouseDisplay = () => {
    return (<MouseTracker render={({ x, y }) => (<div>
          Mouse position: ({x}, {y})
        </div>)}/>);
};
const TabsContext = createContext(undefined);
function Tabs({ children, defaultTab }) {
    const [activeTab, setActiveTab] = useState(defaultTab);
    return (<TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className="tabs">{children}</div>
    </TabsContext.Provider>);
}
function TabList({ children }) {
    return <div className="tab-list">{children}</div>;
}
function Tab({ id, children }) {
    const context = useContext(TabsContext);
    if (!context)
        throw new Error('Tab must be used within Tabs');
    const { activeTab, setActiveTab } = context;
    return (<button className={activeTab === id ? 'active' : ''} onClick={() => setActiveTab(id)}>
      {children}
    </button>);
}
function TabPanel({ id, children }) {
    const context = useContext(TabsContext);
    if (!context)
        throw new Error('TabPanel must be used within Tabs');
    const { activeTab } = context;
    if (activeTab !== id)
        return null;
    return <div className="tab-panel">{children}</div>;
}
// Compound component usage
const TabsExample = () => {
    return (<Tabs defaultTab="home">
      <TabList>
        <Tab id="home">Home</Tab>
        <Tab id="profile">Profile</Tab>
        <Tab id="settings">Settings</Tab>
      </TabList>
      <TabPanel id="home">
        <h1>Home Content</h1>
      </TabPanel>
      <TabPanel id="profile">
        <h1>Profile Content</h1>
      </TabPanel>
      <TabPanel id="settings">
        <h1>Settings Content</h1>
      </TabPanel>
    </Tabs>);
};
const FormInput = ({ value, onChange, placeholder }) => {
    return (<input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}/>);
};
function ControlledForm() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const handleSubmit = (e) => {
        e.preventDefault();
        console.log('Submitted:', { name, email });
    };
    return (<form onSubmit={handleSubmit}>
      <FormInput value={name} onChange={setName} placeholder="Name"/>
      <FormInput value={email} onChange={setEmail} placeholder="Email"/>
      <button type="submit">Submit</button>
    </form>);
}
function usePagination(allItems, itemsPerPage) {
    const [page, setPage] = useState(1);
    const totalPages = Math.ceil(allItems.length / itemsPerPage);
    const startIndex = (page - 1) * itemsPerPage;
    const items = allItems.slice(startIndex, startIndex + itemsPerPage);
    const nextPage = () => {
        setPage(p => Math.min(p + 1, totalPages));
    };
    const prevPage = () => {
        setPage(p => Math.max(p - 1, 1));
    };
    const goToPage = (newPage) => {
        setPage(Math.max(1, Math.min(newPage, totalPages)));
    };
    return { items, page, totalPages, nextPage, prevPage, goToPage };
}
// Component using pagination hook
function PaginatedList({ items }) {
    const { items: currentItems, page, totalPages, nextPage, prevPage } = usePagination(items, 10);
    return (<div>
      <ul>
        {currentItems.map((item, index) => (<li key={index}>{item}</li>))}
      </ul>
      <div>
        <button onClick={prevPage} disabled={page === 1}>
          Previous
        </button>
        <span>
          Page {page} of {totalPages}
        </span>
        <button onClick={nextPage} disabled={page === totalPages}>
          Next
        </button>
      </div>
    </div>);
}
class ExpensiveComponent extends React.PureComponent {
    render() {
        console.log('Rendering ExpensiveComponent');
        return (<div>
        {this.props.data.map((item, index) => (<div key={index}>{item}</div>))}
      </div>);
    }
}
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, errorInfo) {
        console.error('Error caught by boundary:', error, errorInfo);
    }
    render() {
        if (this.state.hasError) {
            return this.props.fallback || <div>Something went wrong.</div>;
        }
        return this.props.children;
    }
}
// Export for testing
export { ThemeProvider, useTheme, ThemedButton, withLoading, UserList, UserListWithLoading, MouseTracker, MouseDisplay, Tabs, TabList, Tab, TabPanel, TabsExample, FormInput, ControlledForm, usePagination, PaginatedList, ExpensiveComponent, ErrorBoundary, };
//# sourceMappingURL=sample-react-patterns.js.map