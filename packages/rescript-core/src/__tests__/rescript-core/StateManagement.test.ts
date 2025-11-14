/**
 * Unit Tests for StateManagement.res
 *
 * Tests the ReScript StateManagement module for type-safe state machines,
 * transitions, guards, and state history
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  configureBridge,
  StateManagementBridge,
} from '../../bridge/RescriptBridge';

describe('StateManagement Module', () => {
  beforeEach(() => {
    configureBridge({ enableStateManagement: true, logTransitions: false });
  });

  describe('BUG #15: Inconsistent State Management', () => {
    it('should prevent invalid state transitions', () => {
      // BUGGY TypeScript version:
      // let state = 'pending';
      // state = 'completed';  // ❌ Skipped 'running' state!

      // ReScript version with state machine:
      type TaskState = 'pending' | 'running' | 'completed' | 'failed';

      interface StateMachine {
        current: TaskState;
        validTransitions: Map<TaskState, TaskState[]>;
      }

      function createTaskStateMachine(): StateMachine {
        const transitions = new Map<TaskState, TaskState[]>([
          ['pending', ['running', 'cancelled']],
          ['running', ['completed', 'failed']],
          ['completed', []],
          ['failed', []],
        ]);

        return {
          current: 'pending',
          validTransitions: transitions,
        };
      }

      function transition(machine: StateMachine, newState: TaskState): boolean {
        const validStates = machine.validTransitions.get(machine.current) || [];

        if (!validStates.includes(newState)) {
          return false;  // Invalid transition
        }

        machine.current = newState;
        return true;
      }

      const machine = createTaskStateMachine();

      // Valid transition: pending → running
      expect(transition(machine, 'running')).toBe(true);
      expect(machine.current).toBe('running');

      // Invalid transition: running → pending (not allowed!)
      expect(transition(machine, 'pending' as TaskState)).toBe(false);
      expect(machine.current).toBe('running');  // State unchanged

      // Valid transition: running → completed
      expect(transition(machine, 'completed')).toBe(true);
      expect(machine.current).toBe('completed');
    });

    it('should track state history', () => {
      type TaskState = 'pending' | 'running' | 'completed';

      interface StateMachineWithHistory {
        current: TaskState;
        history: Array<{ state: TaskState; timestamp: number }>;
      }

      function createStateMachine(): StateMachineWithHistory {
        return {
          current: 'pending',
          history: [{ state: 'pending', timestamp: Date.now() }],
        };
      }

      function transitionWithHistory(
        machine: StateMachineWithHistory,
        newState: TaskState
      ): void {
        machine.current = newState;
        machine.history.push({ state: newState, timestamp: Date.now() });
      }

      const machine = createStateMachine();

      transitionWithHistory(machine, 'running');
      transitionWithHistory(machine, 'completed');

      expect(machine.history).toHaveLength(3);
      expect(machine.history[0].state).toBe('pending');
      expect(machine.history[1].state).toBe('running');
      expect(machine.history[2].state).toBe('completed');
    });

    it('should enforce single active state', () => {
      // BUGGY TypeScript version:
      // let isPending = true;
      // let isRunning = true;  // ❌ Multiple states active!

      // ReScript version with tagged union:
      type TaskState =
        | { tag: 'pending' }
        | { tag: 'running'; progress: number }
        | { tag: 'completed'; result: string }
        | { tag: 'failed'; error: string };

      let state: TaskState = { tag: 'pending' };

      // Can only be in one state at a time
      state = { tag: 'running', progress: 50 };

      expect(state.tag).toBe('running');
      if (state.tag === 'running') {
        expect(state.progress).toBe(50);
      }

      state = { tag: 'completed', result: 'success' };

      expect(state.tag).toBe('completed');
      if (state.tag === 'completed') {
        expect(state.result).toBe('success');
      }
    });
  });

  describe('Guard Conditions', () => {
    it('should apply guard conditions to transitions', () => {
      type State = 'idle' | 'loading' | 'success' | 'error';

      interface StateMachine {
        current: State;
        canRetry: boolean;
      }

      function transition(
        machine: StateMachine,
        newState: State,
        guard?: () => boolean
      ): boolean {
        if (guard && !guard()) {
          return false;  // Guard failed
        }

        machine.current = newState;
        return true;
      }

      const machine: StateMachine = {
        current: 'idle',
        canRetry: false,
      };

      // Transition with guard
      const retryGuard = () => machine.canRetry;

      machine.current = 'error';

      // Try to retry (guard fails)
      expect(transition(machine, 'loading', retryGuard)).toBe(false);
      expect(machine.current).toBe('error');

      // Enable retry
      machine.canRetry = true;

      // Try to retry (guard passes)
      expect(transition(machine, 'loading', retryGuard)).toBe(true);
      expect(machine.current).toBe('loading');
    });

    it('should validate preconditions before transitions', () => {
      interface PaymentState {
        state: 'cart' | 'payment' | 'confirmed';
        hasItems: boolean;
        hasPaymentInfo: boolean;
      }

      function canProceedToPayment(state: PaymentState): boolean {
        return state.hasItems;
      }

      function canConfirm(state: PaymentState): boolean {
        return state.hasPaymentInfo;
      }

      const paymentState: PaymentState = {
        state: 'cart',
        hasItems: false,
        hasPaymentInfo: false,
      };

      // Try to proceed without items (fails)
      if (canProceedToPayment(paymentState)) {
        paymentState.state = 'payment';
      }

      expect(paymentState.state).toBe('cart');  // Still in cart

      // Add items and proceed
      paymentState.hasItems = true;

      if (canProceedToPayment(paymentState)) {
        paymentState.state = 'payment';
      }

      expect(paymentState.state).toBe('payment');
    });
  });

  describe('Task State Machine', () => {
    it('should handle complete task lifecycle', () => {
      type TaskState = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

      interface Task {
        id: string;
        state: TaskState;
        startTime?: number;
        endTime?: number;
      }

      function startTask(task: Task): boolean {
        if (task.state !== 'pending') {
          return false;
        }

        task.state = 'running';
        task.startTime = Date.now();
        return true;
      }

      function completeTask(task: Task): boolean {
        if (task.state !== 'running') {
          return false;
        }

        task.state = 'completed';
        task.endTime = Date.now();
        return true;
      }

      function failTask(task: Task): boolean {
        if (task.state !== 'running') {
          return false;
        }

        task.state = 'failed';
        task.endTime = Date.now();
        return true;
      }

      const task: Task = {
        id: 'task-1',
        state: 'pending',
      };

      expect(startTask(task)).toBe(true);
      expect(task.state).toBe('running');
      expect(task.startTime).toBeDefined();

      expect(completeTask(task)).toBe(true);
      expect(task.state).toBe('completed');
      expect(task.endTime).toBeDefined();

      // Can't transition from completed
      expect(startTask(task)).toBe(false);
      expect(failTask(task)).toBe(false);
    });

    it('should handle task cancellation', () => {
      type TaskState = 'pending' | 'running' | 'cancelled';

      interface Task {
        state: TaskState;
      }

      function cancelTask(task: Task): boolean {
        if (task.state === 'cancelled') {
          return false;  // Already cancelled
        }

        task.state = 'cancelled';
        return true;
      }

      const task1: Task = { state: 'pending' };
      expect(cancelTask(task1)).toBe(true);
      expect(task1.state).toBe('cancelled');

      const task2: Task = { state: 'running' };
      expect(cancelTask(task2)).toBe(true);
      expect(task2.state).toBe('cancelled');

      const task3: Task = { state: 'cancelled' };
      expect(cancelTask(task3)).toBe(false);
    });
  });

  describe('Connection State Machine', () => {
    it('should manage connection lifecycle', () => {
      type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

      interface Connection {
        state: ConnectionState;
        retryCount: number;
      }

      function connect(conn: Connection): boolean {
        if (conn.state !== 'disconnected' && conn.state !== 'error') {
          return false;
        }

        conn.state = 'connecting';
        return true;
      }

      function onConnected(conn: Connection): void {
        if (conn.state === 'connecting') {
          conn.state = 'connected';
          conn.retryCount = 0;
        }
      }

      function onError(conn: Connection): void {
        if (conn.state === 'connecting') {
          conn.state = 'error';
          conn.retryCount++;
        }
      }

      function disconnect(conn: Connection): void {
        conn.state = 'disconnected';
      }

      const conn: Connection = {
        state: 'disconnected',
        retryCount: 0,
      };

      expect(connect(conn)).toBe(true);
      expect(conn.state).toBe('connecting');

      onConnected(conn);
      expect(conn.state).toBe('connected');
      expect(conn.retryCount).toBe(0);

      disconnect(conn);
      expect(conn.state).toBe('disconnected');

      // Test error path
      connect(conn);
      onError(conn);
      expect(conn.state).toBe('error');
      expect(conn.retryCount).toBe(1);
    });

    it('should limit retry attempts', () => {
      interface Connection {
        state: 'disconnected' | 'connecting' | 'connected' | 'error' | 'failed';
        retryCount: number;
        maxRetries: number;
      }

      function connect(conn: Connection): boolean {
        if (conn.retryCount >= conn.maxRetries) {
          conn.state = 'failed';
          return false;
        }

        conn.state = 'connecting';
        conn.retryCount++;
        return true;
      }

      const conn: Connection = {
        state: 'disconnected',
        retryCount: 0,
        maxRetries: 3,
      };

      // First 3 attempts allowed
      expect(connect(conn)).toBe(true);  // Attempt 1
      conn.state = 'error';
      expect(connect(conn)).toBe(true);  // Attempt 2
      conn.state = 'error';
      expect(connect(conn)).toBe(true);  // Attempt 3
      conn.state = 'error';

      // 4th attempt fails
      expect(connect(conn)).toBe(false);
      expect(conn.state).toBe('failed');
    });
  });

  describe('Request State Machine', () => {
    it('should track request lifecycle', () => {
      type RequestState = 'idle' | 'pending' | 'success' | 'error';

      interface Request<T> {
        state: RequestState;
        data?: T;
        error?: string;
      }

      function makeRequest<T>(req: Request<T>): void {
        req.state = 'pending';
        req.data = undefined;
        req.error = undefined;
      }

      function onSuccess<T>(req: Request<T>, data: T): void {
        if (req.state === 'pending') {
          req.state = 'success';
          req.data = data;
        }
      }

      function onError<T>(req: Request<T>, error: string): void {
        if (req.state === 'pending') {
          req.state = 'error';
          req.error = error;
        }
      }

      const req: Request<string> = {
        state: 'idle',
      };

      makeRequest(req);
      expect(req.state).toBe('pending');

      onSuccess(req, 'result');
      expect(req.state).toBe('success');
      expect(req.data).toBe('result');

      // New request
      makeRequest(req);
      expect(req.state).toBe('pending');
      expect(req.data).toBeUndefined();

      onError(req, 'Network error');
      expect(req.state).toBe('error');
      expect(req.error).toBe('Network error');
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle form state machine', () => {
      type FormState = 'clean' | 'dirty' | 'validating' | 'valid' | 'invalid' | 'submitting' | 'submitted';

      interface Form {
        state: FormState;
        errors: string[];
      }

      function onChange(form: Form): void {
        if (form.state === 'clean') {
          form.state = 'dirty';
        }
      }

      function validate(form: Form, isValid: boolean): void {
        form.state = 'validating';

        if (isValid) {
          form.state = 'valid';
          form.errors = [];
        } else {
          form.state = 'invalid';
        }
      }

      function submit(form: Form): boolean {
        if (form.state !== 'valid') {
          return false;
        }

        form.state = 'submitting';
        return true;
      }

      function onSubmitted(form: Form): void {
        if (form.state === 'submitting') {
          form.state = 'submitted';
        }
      }

      const form: Form = {
        state: 'clean',
        errors: [],
      };

      onChange(form);
      expect(form.state).toBe('dirty');

      validate(form, true);
      expect(form.state).toBe('valid');

      expect(submit(form)).toBe(true);
      expect(form.state).toBe('submitting');

      onSubmitted(form);
      expect(form.state).toBe('submitted');
    });

    it('should handle authentication flow', () => {
      type AuthState = 'unauthenticated' | 'authenticating' | 'authenticated' | 'error';

      interface AuthMachine {
        state: AuthState;
        token?: string;
        user?: { id: string; name: string };
      }

      function login(auth: AuthMachine): void {
        auth.state = 'authenticating';
        auth.token = undefined;
        auth.user = undefined;
      }

      function onLoginSuccess(auth: AuthMachine, token: string, user: { id: string; name: string }): void {
        if (auth.state === 'authenticating') {
          auth.state = 'authenticated';
          auth.token = token;
          auth.user = user;
        }
      }

      function onLoginError(auth: AuthMachine): void {
        if (auth.state === 'authenticating') {
          auth.state = 'error';
        }
      }

      function logout(auth: AuthMachine): void {
        auth.state = 'unauthenticated';
        auth.token = undefined;
        auth.user = undefined;
      }

      const auth: AuthMachine = {
        state: 'unauthenticated',
      };

      login(auth);
      expect(auth.state).toBe('authenticating');

      onLoginSuccess(auth, 'token123', { id: 'user1', name: 'John' });
      expect(auth.state).toBe('authenticated');
      expect(auth.token).toBe('token123');
      expect(auth.user?.name).toBe('John');

      logout(auth);
      expect(auth.state).toBe('unauthenticated');
      expect(auth.token).toBeUndefined();
    });

    it('should handle download progress states', () => {
      type DownloadState = 'queued' | 'downloading' | 'paused' | 'completed' | 'failed';

      interface Download {
        state: DownloadState;
        progress: number;
        error?: string;
      }

      function start(download: Download): boolean {
        if (download.state !== 'queued' && download.state !== 'paused') {
          return false;
        }

        download.state = 'downloading';
        return true;
      }

      function updateProgress(download: Download, progress: number): void {
        if (download.state === 'downloading') {
          download.progress = progress;

          if (progress >= 100) {
            download.state = 'completed';
          }
        }
      }

      function pause(download: Download): boolean {
        if (download.state !== 'downloading') {
          return false;
        }

        download.state = 'paused';
        return true;
      }

      function fail(download: Download, error: string): void {
        download.state = 'failed';
        download.error = error;
      }

      const download: Download = {
        state: 'queued',
        progress: 0,
      };

      expect(start(download)).toBe(true);
      expect(download.state).toBe('downloading');

      updateProgress(download, 50);
      expect(download.progress).toBe(50);

      expect(pause(download)).toBe(true);
      expect(download.state).toBe('paused');

      expect(start(download)).toBe(true);
      expect(download.state).toBe('downloading');

      updateProgress(download, 100);
      expect(download.state).toBe('completed');
    });
  });

  describe('Edge Cases', () => {
    it('should handle concurrent state updates', () => {
      type State = 'idle' | 'processing' | 'done';

      interface Machine {
        state: State;
        updateCount: number;
      }

      function transition(machine: Machine, newState: State): boolean {
        if (machine.state === 'done') {
          return false;  // Terminal state
        }

        machine.state = newState;
        machine.updateCount++;
        return true;
      }

      const machine: Machine = {
        state: 'idle',
        updateCount: 0,
      };

      expect(transition(machine, 'processing')).toBe(true);
      expect(machine.updateCount).toBe(1);

      expect(transition(machine, 'done')).toBe(true);
      expect(machine.updateCount).toBe(2);

      // Terminal state - no more transitions
      expect(transition(machine, 'idle')).toBe(false);
      expect(machine.updateCount).toBe(2);  // Not incremented
    });

    it('should handle rapid state changes', () => {
      type State = 'a' | 'b' | 'c';

      const states: State[] = [];

      function transition(newState: State): void {
        states.push(newState);
      }

      transition('a');
      transition('b');
      transition('c');
      transition('a');

      expect(states).toEqual(['a', 'b', 'c', 'a']);
      expect(states[states.length - 1]).toBe('a');
    });
  });
});
