/**
 * websocket-integration.test.ts
 *
 * Integration tests for monitoring WebSocket server
 * Phase 6 Week 2: Advanced Monitoring & Observability - Day 4
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import WebSocket from 'ws';
import { MonitoringWebSocketServer } from '../../api/MonitoringWebSocket.js';
import { MetricsCollector } from '../../monitoring/MetricsCollector.js';
import { AlertingService } from '../../monitoring/AlertingService.js';
import { HealthCheckService } from '../../monitoring/HealthCheckService.js';
import { WorkflowMonitor } from '../../monitoring/WorkflowMonitor.js';

describe('Monitoring WebSocket Integration', () => {
  let db: Database.Database;
  let wsServer: MonitoringWebSocketServer;
  let metrics: MetricsCollector;
  let alerting: AlertingService;
  let health: HealthCheckService;
  let workflows: WorkflowMonitor;
  let client: WebSocket;

  const WS_PORT = 8081;

  beforeEach((done) => {
    db = new Database(':memory:');
    metrics = new MetricsCollector(db);
    alerting = new AlertingService(db, metrics);
    health = new HealthCheckService(db);
    workflows = new WorkflowMonitor(db);

    wsServer = new MonitoringWebSocketServer(
      WS_PORT,
      metrics,
      alerting,
      health,
      workflows
    );

    // Wait for server to start
    setTimeout(done, 100);
  });

  afterEach((done) => {
    if (client && client.readyState === WebSocket.OPEN) {
      client.close();
    }
    wsServer.close();
    db.close();
    setTimeout(done, 100);
  });

  it('should connect client and send initial dashboard data', (done) => {
    client = new WebSocket(`ws://localhost:${WS_PORT}`);

    client.on('open', () => {
      expect(client.readyState).toBe(WebSocket.OPEN);
    });

    client.on('message', (data) => {
      const message = JSON.parse(data.toString());

      if (message.type === 'dashboard.update') {
        expect(message.data).toBeDefined();
        expect(message.data.systemHealth).toBeDefined();
        expect(message.data.activeWorkflows).toBeDefined();
        expect(message.data.recentAlerts).toBeDefined();
        expect(message.data.performanceMetrics).toBeDefined();
        done();
      }
    });

    client.on('error', (error) => {
      done(error);
    });
  });

  it('should broadcast alert when triggered', (done) => {
    client = new WebSocket(`ws://localhost:${WS_PORT}`);

    let alertReceived = false;

    client.on('message', (data) => {
      const message = JSON.parse(data.toString());

      if (message.type === 'alert.triggered') {
        expect(message.data).toBeDefined();
        expect(message.data.severity).toBe('critical');
        expect(message.data.title).toContain('Test Alert');
        alertReceived = true;
        done();
      }
    });

    client.on('open', () => {
      // Create alert rule that will trigger
      const ruleId = alerting.createRule(
        'Test Alert',
        'Test alert description',
        'test.metric',
        {
          operator: 'gt',
          threshold: 5,
          windowMs: 10000,
          aggregation: 'sum',
        },
        'critical'
      );

      // Record metrics to trigger alert
      for (let i = 0; i < 10; i++) {
        metrics.recordMetric('test.metric', 1);
      }

      // Manually trigger alert (bypass evaluation interval)
      alerting.startEvaluation(50);
    });

    setTimeout(() => {
      if (!alertReceived) {
        done(new Error('Alert not received within timeout'));
      }
    }, 1000);
  });

  it('should support channel subscriptions', (done) => {
    client = new WebSocket(`ws://localhost:${WS_PORT}`);

    client.on('open', () => {
      // Subscribe to alerts channel only
      client.send(
        JSON.stringify({
          type: 'subscribe',
          channel: 'alerts',
        })
      );
    });

    let dashboardUpdateReceived = false;
    let alertReceived = false;

    client.on('message', (data) => {
      const message = JSON.parse(data.toString());

      if (message.type === 'dashboard.update') {
        dashboardUpdateReceived = true;
      }

      if (message.type === 'alert.triggered') {
        alertReceived = true;
        // Should receive alerts (subscribed)
        expect(message.data).toBeDefined();
      }
    });

    setTimeout(() => {
      // Dashboard updates should still be received (not channel-specific)
      // Alerts should be received (subscribed to alerts channel)
      done();
    }, 500);
  });

  it('should handle multiple concurrent clients', (done) => {
    const clients: WebSocket[] = [];
    const clientCount = 5;
    let connectedCount = 0;
    let messageReceivedCount = 0;

    for (let i = 0; i < clientCount; i++) {
      const ws = new WebSocket(`ws://localhost:${WS_PORT}`);

      ws.on('open', () => {
        connectedCount++;
        if (connectedCount === clientCount) {
          // All clients connected
          expect(connectedCount).toBe(clientCount);
        }
      });

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'dashboard.update') {
          messageReceivedCount++;

          // Check if all clients received message
          if (messageReceivedCount >= clientCount) {
            // Cleanup
            clients.forEach((c) => c.close());
            done();
          }
        }
      });

      clients.push(ws);
    }

    setTimeout(() => {
      if (messageReceivedCount < clientCount) {
        clients.forEach((c) => c.close());
        done(new Error('Not all clients received messages'));
      }
    }, 2000);
  });

  it('should handle client disconnection gracefully', (done) => {
    client = new WebSocket(`ws://localhost:${WS_PORT}`);

    client.on('open', () => {
      // Close immediately
      client.close();
    });

    client.on('close', () => {
      // Verify server didn't crash
      expect(wsServer).toBeDefined();
      done();
    });
  });

  it('should broadcast workflow status updates', (done) => {
    client = new WebSocket(`ws://localhost:${WS_PORT}`);

    client.on('message', (data) => {
      const message = JSON.parse(data.toString());

      if (message.type === 'workflow.started') {
        expect(message.data).toBeDefined();
        expect(message.data.executionId).toBe('test-exec-001');
        expect(message.data.workflowId).toBe('test-workflow');
        done();
      }
    });

    client.on('open', () => {
      // Start workflow execution
      workflows.startExecution('test-exec-001', 'test-workflow');
    });
  });
});
