/**
 * sample-react-basic.tsx
 *
 * Basic React components and hooks for testing TypeScript parser
 * Tests function components, class components, and built-in hooks
 */
import React from 'react';
declare function Greeting(props: {
    name: string;
}): any;
declare const WelcomeMessage: ({ message }: {
    message: string;
}) => any;
declare const UserCard: ({ name, email }: {
    name: string;
    email: string;
}) => any;
declare function Counter(): any;
declare class Timer extends React.Component<{}, {
    seconds: number;
}> {
    interval?: NodeJS.Timeout;
    constructor(props: {});
    componentDidMount(): void;
    componentWillUnmount(): void;
    render(): any;
}
import { Component } from 'react';
declare class TodoList extends Component<{
    items: string[];
}> {
    render(): any;
}
declare const ToggleButton: () => any;
declare function calculateTotal(items: number[]): number;
declare const API_URL = "https://api.example.com";
declare const formatDate: (date: Date) => string;
declare function UserProfile({ userId }: {
    userId: string;
}): any;
declare const FragmentExample: () => any;
declare const ImageDisplay: ({ src, alt }: {
    src: string;
    alt: string;
}) => any;
export { Greeting, WelcomeMessage, UserCard, Counter, Timer, TodoList, ToggleButton, UserProfile, FragmentExample, ImageDisplay, calculateTotal, formatDate, API_URL, };
//# sourceMappingURL=sample-react-basic.d.ts.map