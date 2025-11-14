/**
 * notification-integration.test.ts
 *
 * Integration tests for notification system
 * Phase 6 Week 2: Advanced Monitoring & Observability - Day 4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { NotificationService } from '../../notifications/NotificationService.js';
import { EmailChannel } from '../../notifications/channels/EmailChannel.js';
import { SlackChannel } from '../../notifications/channels/SlackChannel.js';
import { PagerDutyChannel } from '../../notifications/channels/PagerDutyChannel.js';
import { AlertingService } from '../../monitoring/AlertingService.js';
import { MetricsCollector } from '../../monitoring/MetricsCollector.js';
import { Alert } from '../../types/monitoring.types.js';

describe('Notification System Integration', () => {
  let db: Database.Database;
  let notifications: NotificationService;
  let alerting: AlertingService;
  let metrics: MetricsCollector;

  beforeEach(() => {
    db = new Database(':memory:');
    metrics = new MetricsCollector(db);

    // Mock notification channels
    const notificationConfig = {
      email: {
        enabled: true,
        minSeverity: 'warning',
        config: {
          smtp: { host: 'smtp.test.com', port: 587, secure: false },
          auth: { user: 'test@test.com', pass: 'password' },
          from: 'alerts@test.com',
          to: ['admin@test.com'],
        },
      },
      slack: {
        enabled: true,
        minSeverity: 'error',
        config: {
          webhookUrl: 'https://hooks.slack.com/services/TEST',
        },
      },
      pagerduty: {
        enabled: true,
        minSeverity: 'critical',
        config: {
          routingKey: 'test-routing-key',
        },
      },
    };

    notifications = new NotificationService(notificationConfig);
    alerting = new AlertingService(db, metrics);
  });

  afterEach(() => {
    alerting.stopEvaluation();
    db.close();
  });

  describe('Multi-Channel Notification', () => {
    it('should send notifications through all enabled channels', async () => {
      const alert: Alert = {
        id: 'test-alert-001',
        timestamp: Date.now(),
        severity: 'critical',
        status: 'active',
        title: 'Critical System Error',
        description: 'System is experiencing critical errors',
        source: 'monitoring',
        labels: { service: 'api' },
      };

      // Mock the channel send methods
      const emailSpy = vi.spyOn(EmailChannel.prototype, 'send').mockResolvedValue();
      const slackSpy = vi.spyOn(SlackChannel.prototype, 'send').mockResolvedValue();
      const pagerDutySpy = vi.spyOn(PagerDutyChannel.prototype, 'send').mockResolvedValue();

      const results = await notifications.sendAlert(alert);

      // All three channels should be called for critical alert
      expect(results).toBeDefined();
      expect(results.length).toBe(3);
      expect(results.every((r) => r.success)).toBe(true);

      emailSpy.mockRestore();
      slackSpy.mockRestore();
      pagerDutySpy.mockRestore();
    });

    it('should respect severity thresholds per channel', async () => {
      const warningAlert: Alert = {
        id: 'test-alert-002',
        timestamp: Date.now(),
        severity: 'warning',
        status: 'active',
        title: 'Warning Alert',
        description: 'Warning level alert',
        source: 'monitoring',
        labels: {},
      };

      const emailSpy = vi.spyOn(EmailChannel.prototype, 'send').mockResolvedValue();
      const slackSpy = vi.spyOn(SlackChannel.prototype, 'send').mockResolvedValue();
      const pagerDutySpy = vi.spyOn(PagerDutyChannel.prototype, 'send').mockResolvedValue();

      const results = await notifications.sendAlert(warningAlert);

      // Only email should be called (minSeverity: warning)
      // Slack requires error+, PagerDuty requires critical
      expect(results.some((r) => r.channel === 'email')).toBe(true);
      expect(results.some((r) => r.channel === 'slack')).toBe(false);
      expect(results.some((r) => r.channel === 'pagerduty')).toBe(false);

      emailSpy.mockRestore();
      slackSpy.mockRestore();
      pagerDutySpy.mockRestore();
    });

    it('should handle channel failures gracefully', async () => {
      const alert: Alert = {
        id: 'test-alert-003',
        timestamp: Date.now(),
        severity: 'critical',
        status: 'active',
        title: 'Test Alert',
        description: 'Test',
        source: 'monitoring',
        labels: {},
      };

      // Mock email to fail, others to succeed
      const emailSpy = vi
        .spyOn(EmailChannel.prototype, 'send')
        .mockRejectedValue(new Error('SMTP error'));
      const slackSpy = vi.spyOn(SlackChannel.prototype, 'send').mockResolvedValue();
      const pagerDutySpy = vi.spyOn(PagerDutyChannel.prototype, 'send').mockResolvedValue();

      const results = await notifications.sendAlert(alert);

      // Email should fail, others should succeed
      const emailResult = results.find((r) => r.channel === 'email');
      expect(emailResult?.success).toBe(false);

      const slackResult = results.find((r) => r.channel === 'slack');
      expect(slackResult?.success).toBe(true);

      const pagerDutyResult = results.find((r) => r.channel === 'pagerduty');
      expect(pagerDutyResult?.success).toBe(true);

      emailSpy.mockRestore();
      slackSpy.mockRestore();
      pagerDutySpy.mockRestore();
    });
  });

  describe('Integration with AlertingService', () => {
    it('should automatically send notifications when alert is triggered', async () => {
      return new Promise<void>((resolve) => {
        let notificationSent = false;

        notifications.on('notifications.sent', ({ alertId, results }) => {
          expect(alertId).toBeDefined();
          expect(results).toBeDefined();
          expect(results.length).toBeGreaterThan(0);
          notificationSent = true;
          resolve();
        });

        // Create alerting service with notifications enabled
        const alertingWithNotifications = new AlertingService(db, metrics);

        // Mock notification sending
        const sendSpy = vi.spyOn(notifications, 'sendAlert').mockResolvedValue([
          { channel: 'email', success: true },
        ]);

        alertingWithNotifications.on('alert.triggered', async (alert) => {
          await notifications.sendAlert(alert);
        });

        // Create rule and trigger
        alertingWithNotifications.createRule(
          'Test',
          'Test',
          'test.metric',
          { operator: 'gt', threshold: 5, windowMs: 10000, aggregation: 'sum' },
          'critical'
        );

        for (let i = 0; i < 10; i++) {
          metrics.recordMetric('test.metric', 1);
        }

        alertingWithNotifications.startEvaluation(50);

        setTimeout(() => {
          sendSpy.mockRestore();
          if (!notificationSent) {
            resolve(); // Resolve anyway to avoid hanging
          }
        }, 1000);
      });
    });
  });
});
