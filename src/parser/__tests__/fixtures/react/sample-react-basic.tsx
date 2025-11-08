/**
 * sample-react-basic.tsx
 *
 * Basic React components and hooks for testing TypeScript parser
 * Tests function components, class components, and built-in hooks
 */

import React, { useState, useEffect, useContext } from 'react';

// Function component returning JSX
function Greeting(props: { name: string }) {
  return <h1>Hello, {props.name}!</h1>;
}

// Arrow function component with implicit return
const WelcomeMessage = ({ message }: { message: string }) => (
  <div className="welcome">
    <p>{message}</p>
  </div>
);

// Arrow function component with explicit return
const UserCard = ({ name, email }: { name: string; email: string }) => {
  return (
    <div className="user-card">
      <h2>{name}</h2>
      <p>{email}</p>
    </div>
  );
};

// Function component with hooks
function Counter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    document.title = `Count: ${count}`;
  }, [count]);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  );
}

// Class component extending React.Component
class Timer extends React.Component<{}, { seconds: number }> {
  interval?: NodeJS.Timeout;

  constructor(props: {}) {
    super(props);
    this.state = { seconds: 0 };
  }

  componentDidMount() {
    this.interval = setInterval(() => {
      this.setState({ seconds: this.state.seconds + 1 });
    }, 1000);
  }

  componentWillUnmount() {
    if (this.interval) clearInterval(this.interval);
  }

  render() {
    return <div>Seconds: {this.state.seconds}</div>;
  }
}

// Class component extending Component
import { Component } from 'react';

class TodoList extends Component<{ items: string[] }> {
  render() {
    return (
      <ul>
        {this.props.items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    );
  }
}

// Arrow function component with useState
const ToggleButton = () => {
  const [isOn, setIsOn] = useState(false);

  return (
    <button onClick={() => setIsOn(!isOn)}>
      {isOn ? 'ON' : 'OFF'}
    </button>
  );
};

// Regular function (not a component - no JSX)
function calculateTotal(items: number[]): number {
  return items.reduce((sum, item) => sum + item, 0);
}

// Regular constant (not a component)
const API_URL = 'https://api.example.com';

// Arrow function (not a component - no JSX)
const formatDate = (date: Date): string => {
  return date.toISOString();
};

// Component with multiple hooks
function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const theme = useContext(ThemeContext);

  useEffect(() => {
    fetch(`/api/users/${userId}`)
      .then(res => res.json())
      .then(data => {
        setUser(data);
        setLoading(false);
      });
  }, [userId]);

  if (loading) return <div>Loading...</div>;

  return (
    <div className={theme}>
      <h1>{user?.name}</h1>
    </div>
  );
}

// Fragment component
const FragmentExample = () => {
  return (
    <>
      <h1>Title</h1>
      <p>Paragraph</p>
    </>
  );
};

// Self-closing JSX component
const ImageDisplay = ({ src, alt }: { src: string; alt: string }) => {
  return <img src={src} alt={alt} />;
};

// Context definition (not a component)
const ThemeContext = React.createContext('light');

// Export for testing
export {
  Greeting,
  WelcomeMessage,
  UserCard,
  Counter,
  Timer,
  TodoList,
  ToggleButton,
  UserProfile,
  FragmentExample,
  ImageDisplay,
  calculateTotal,
  formatDate,
  API_URL,
};
