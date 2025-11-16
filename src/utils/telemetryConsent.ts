/**
 * telemetryConsent.ts
 * First-run telemetry consent prompt
 */

import inquirer from 'inquirer';
import { getTelemetryService, initializeTelemetryService } from '../services/TelemetryService.js';
import { TelemetryDAO } from '../database/dao/TelemetryDAO.js';
import Database from 'better-sqlite3';
import { getDatabasePath } from '../database/index.js';

/**
 * Check if telemetry has been configured (user has made a choice)
 */
export function isTelemetryConfigured(): boolean {
  try {
    const dbPath = getDatabasePath();
    const db = new Database(dbPath);
    const dao = new TelemetryDAO(db);

    const config = dao.getConfig();
    const configured = config !== null;

    db.close();
    return configured;
  } catch (error) {
    // If there's an error, assume not configured
    return false;
  }
}

/**
 * Show telemetry consent prompt on first run
 *
 * This prompt asks the user whether they want to:
 * - Enable telemetry (local only)
 * - Enable telemetry with remote submission
 * - Disable telemetry
 *
 * @returns Promise that resolves when the user has made a choice
 */
export async function showTelemetryConsent(): Promise<void> {
  console.log('\n📊 Welcome to AutomatosX!\n');
  console.log('To improve AutomatosX, we collect anonymous usage data.');
  console.log('This data helps us understand how the tool is used and prioritize improvements.\n');
  console.log('What we collect:');
  console.log('  ✓ Command usage (which commands you run)');
  console.log('  ✓ Query performance (how long operations take)');
  console.log('  ✓ Error occurrences (what errors happen)');
  console.log('  ✓ Parser invocations (which languages are used)\n');
  console.log('What we DO NOT collect:');
  console.log('  ✗ File paths or names');
  console.log('  ✗ Code content');
  console.log('  ✗ User identifiers');
  console.log('  ✗ Personal information\n');
  console.log('For full details, see: PRIVACY.md\n');

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'telemetryChoice',
      message: 'How would you like to configure telemetry?',
      choices: [
        {
          name: 'Enable (local only) - Store data locally for debugging',
          value: 'local',
        },
        {
          name: 'Enable (with remote submission) - Help improve AutomatosX',
          value: 'remote',
        },
        {
          name: 'Disable - Do not collect any data',
          value: 'disabled',
        },
      ],
      default: 'local',
    },
  ]);

  const service = getTelemetryService();
  await service.initialize();

  switch (answers.telemetryChoice) {
    case 'local':
      await service.enable(false); // Local only
      console.log('\n✓ Telemetry enabled (local only)');
      console.log('  Data will be stored locally in your database.');
      console.log('  View stats with: ax telemetry stats');
      console.log('  Export data with: ax telemetry export');
      console.log('  Disable anytime with: ax telemetry disable\n');
      break;

    case 'remote':
      await service.enable(true); // With remote submission
      console.log('\n✓ Telemetry enabled (with remote submission)');
      console.log('  Data will be sent to help improve AutomatosX.');
      console.log('  View stats with: ax telemetry stats');
      console.log('  Disable anytime with: ax telemetry disable\n');
      break;

    case 'disabled':
      await service.disable();
      console.log('\n✓ Telemetry disabled');
      console.log('  No data will be collected.');
      console.log('  Enable anytime with: ax telemetry enable\n');
      break;
  }
}

/**
 * Check if telemetry consent is needed and show prompt if required
 *
 * This should be called at the start of CLI execution (in src/cli/index.ts)
 *
 * @returns Promise that resolves when consent check is complete
 */
export async function checkTelemetryConsent(): Promise<void> {
  // Only show consent prompt if telemetry hasn't been configured yet
  if (!isTelemetryConfigured()) {
    await showTelemetryConsent();
  }
}
