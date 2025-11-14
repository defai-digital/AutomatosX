/**
 * Test Setup
 * Configures testing environment for React components
 */
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
// Cleanup after each test
afterEach(() => {
    cleanup();
});
//# sourceMappingURL=setup.js.map