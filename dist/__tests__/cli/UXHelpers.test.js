/**
 * UX Helpers Tests
 * Sprint 6 Day 56: CLI/TUI user experience tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProgressBar, Spinner, FormatHelpers, Table, PromptHelpers, } from '../../cli/UXHelpers.js';
describe('ProgressBar', () => {
    let progressBar;
    beforeEach(() => {
        progressBar = new ProgressBar({ total: 100 });
    });
    describe('Progress Tracking', () => {
        it('should update progress', () => {
            const listener = vi.fn();
            progressBar.on('progress', listener);
            progressBar.update(50);
            expect(listener).toHaveBeenCalled();
            expect(listener).toHaveBeenCalledWith(expect.objectContaining({
                current: 50,
                total: 100,
                percent: 50,
            }));
        });
        it('should increment progress with tick', () => {
            progressBar.update(10);
            progressBar.tick(5);
            expect(progressBar.getPercent()).toBe(15);
        });
        it('should cap progress at total', () => {
            progressBar.update(150);
            expect(progressBar.getPercent()).toBe(100);
        });
        it('should emit complete event when finished', () => {
            const listener = vi.fn();
            progressBar.on('complete', listener);
            progressBar.update(100);
            expect(listener).toHaveBeenCalled();
        });
    });
    describe('Progress Calculations', () => {
        it('should calculate percentage correctly', () => {
            progressBar.update(25);
            expect(progressBar.getPercent()).toBe(25);
        });
        it('should calculate ETA', () => {
            progressBar.update(50);
            const eta = progressBar.getETA();
            expect(eta).toBeGreaterThanOrEqual(0);
        });
        it('should show zero ETA when complete', () => {
            progressBar.update(100);
            const eta = progressBar.getETA();
            expect(eta).toBe(0);
        });
    });
    describe('Progress Rendering', () => {
        it('should render progress bar', () => {
            progressBar.update(50);
            const rendered = progressBar.render();
            expect(rendered).toContain('█'); // Filled bar
            expect(rendered).toContain('50%');
            expect(rendered).toContain('50/100');
        });
        it('should render empty bar at start', () => {
            const rendered = progressBar.render();
            expect(rendered).toContain('░'); // Empty bar
            expect(rendered).toContain('0%');
        });
        it('should show complete when finished', () => {
            progressBar.update(100);
            const rendered = progressBar.render();
            expect(rendered).toContain('complete');
            expect(rendered).toContain('100%');
        });
    });
    describe('Progress Reset', () => {
        it('should reset progress', () => {
            const listener = vi.fn();
            progressBar.on('reset', listener);
            progressBar.update(50);
            progressBar.reset();
            expect(progressBar.getPercent()).toBe(0);
            expect(listener).toHaveBeenCalled();
        });
    });
    describe('Custom Configuration', () => {
        it('should use custom width', () => {
            const customBar = new ProgressBar({ total: 100, width: 20 });
            customBar.update(50);
            const rendered = customBar.render();
            // Width should affect bar length
            expect(rendered.length).toBeGreaterThan(0);
        });
        it('should use custom format', () => {
            const customBar = new ProgressBar({
                total: 100,
                format: 'Progress: :percent',
            });
            customBar.update(50);
            const rendered = customBar.render();
            expect(rendered).toContain('Progress: 50%');
        });
    });
});
describe('Spinner', () => {
    let spinner;
    beforeEach(() => {
        spinner = new Spinner('Loading...');
    });
    describe('Spinner Lifecycle', () => {
        it('should start spinner', () => {
            const listener = vi.fn();
            spinner.on('start', listener);
            spinner.start();
            expect(spinner.isRunning()).toBe(true);
            expect(listener).toHaveBeenCalled();
        });
        it('should stop spinner', () => {
            const listener = vi.fn();
            spinner.on('stop', listener);
            spinner.start();
            spinner.stop();
            expect(spinner.isRunning()).toBe(false);
            expect(listener).toHaveBeenCalled();
        });
        it('should not start if already running', () => {
            spinner.start();
            const firstRunning = spinner.isRunning();
            spinner.start(); // Try to start again
            expect(firstRunning).toBe(true);
            expect(spinner.isRunning()).toBe(true);
        });
        it('should not stop if not running', () => {
            expect(spinner.isRunning()).toBe(false);
            spinner.stop();
            expect(spinner.isRunning()).toBe(false);
        });
    });
    describe('Spinner Text', () => {
        it('should update spinner text', () => {
            const listener = vi.fn();
            spinner.on('text-updated', listener);
            spinner.setText('Processing...');
            expect(listener).toHaveBeenCalledWith({ text: 'Processing...' });
        });
        it('should render spinner with text', () => {
            const rendered = spinner.render();
            expect(rendered).toContain('Loading...');
            expect(rendered.length).toBeGreaterThan(0);
        });
    });
    describe('Spinner Frame', () => {
        it('should get current frame', () => {
            const frame = spinner.getFrame();
            expect(frame).toBeTruthy();
            expect(frame.length).toBeGreaterThan(0);
        });
    });
    describe('Spinner Final Text', () => {
        it('should use final text on stop', () => {
            const listener = vi.fn();
            spinner.on('stop', listener);
            spinner.start();
            spinner.stop('Done!');
            expect(listener).toHaveBeenCalledWith({ text: 'Done!' });
        });
    });
});
describe('FormatHelpers', () => {
    describe('Byte Formatting', () => {
        it('should format bytes', () => {
            expect(FormatHelpers.formatBytes(0)).toBe('0 B');
            expect(FormatHelpers.formatBytes(1024)).toBe('1.00 KB');
            expect(FormatHelpers.formatBytes(1024 * 1024)).toBe('1.00 MB');
            expect(FormatHelpers.formatBytes(1024 * 1024 * 1024)).toBe('1.00 GB');
        });
        it('should format partial bytes', () => {
            expect(FormatHelpers.formatBytes(1536)).toBe('1.50 KB');
            expect(FormatHelpers.formatBytes(2.5 * 1024 * 1024)).toBe('2.50 MB');
        });
    });
    describe('Duration Formatting', () => {
        it('should format milliseconds', () => {
            expect(FormatHelpers.formatDuration(500)).toBe('500ms');
            expect(FormatHelpers.formatDuration(999)).toBe('999ms');
        });
        it('should format seconds', () => {
            expect(FormatHelpers.formatDuration(5000)).toBe('5s');
            expect(FormatHelpers.formatDuration(45000)).toBe('45s');
        });
        it('should format minutes and seconds', () => {
            expect(FormatHelpers.formatDuration(90000)).toBe('1m 30s');
            expect(FormatHelpers.formatDuration(150000)).toBe('2m 30s');
        });
        it('should format hours and minutes', () => {
            expect(FormatHelpers.formatDuration(3600000)).toBe('1h 0m');
            expect(FormatHelpers.formatDuration(5400000)).toBe('1h 30m');
        });
    });
    describe('Number Formatting', () => {
        it('should format numbers with commas', () => {
            expect(FormatHelpers.formatNumber(1000)).toBe('1,000');
            expect(FormatHelpers.formatNumber(1000000)).toBe('1,000,000');
            expect(FormatHelpers.formatNumber(123456789)).toBe('123,456,789');
        });
        it('should not format small numbers', () => {
            expect(FormatHelpers.formatNumber(100)).toBe('100');
            expect(FormatHelpers.formatNumber(999)).toBe('999');
        });
    });
    describe('Percentage Formatting', () => {
        it('should format percentages', () => {
            expect(FormatHelpers.formatPercent(50, 100)).toBe('50.0%');
            expect(FormatHelpers.formatPercent(1, 3)).toBe('33.3%');
            expect(FormatHelpers.formatPercent(2, 3)).toBe('66.7%');
        });
        it('should handle zero total', () => {
            expect(FormatHelpers.formatPercent(0, 0)).toBe('NaN%');
        });
    });
    describe('Text Truncation', () => {
        it('should truncate long text', () => {
            const longText = 'This is a very long text that should be truncated';
            expect(FormatHelpers.truncate(longText, 20)).toBe('This is a very lo...');
        });
        it('should not truncate short text', () => {
            const shortText = 'Short text';
            expect(FormatHelpers.truncate(shortText, 20)).toBe('Short text');
        });
    });
    describe('Text Padding', () => {
        it('should pad text', () => {
            expect(FormatHelpers.pad('test', 10)).toBe('test      ');
            expect(FormatHelpers.pad('test', 10, '-')).toBe('test------');
        });
        it('should not pad if already long enough', () => {
            expect(FormatHelpers.pad('test', 4)).toBe('test');
        });
    });
    describe('Text Centering', () => {
        it('should center text', () => {
            const centered = FormatHelpers.center('test', 10);
            expect(centered).toBe('   test   ');
            expect(centered.length).toBe(10);
        });
        it('should handle odd padding', () => {
            const centered = FormatHelpers.center('test', 11);
            expect(centered.length).toBe(11);
        });
        it('should not pad if text is too long', () => {
            const centered = FormatHelpers.center('very long text', 5);
            expect(centered).toBe('very long text');
        });
    });
});
describe('Table', () => {
    let table;
    beforeEach(() => {
        table = new Table();
    });
    describe('Table Construction', () => {
        it('should set headers', () => {
            table.setHeaders(['Name', 'Age', 'City']);
            const rendered = table.render();
            expect(rendered).toContain('Name');
            expect(rendered).toContain('Age');
            expect(rendered).toContain('City');
        });
        it('should add single row', () => {
            table.setHeaders(['Name', 'Age']);
            table.addRow(['Alice', '30']);
            const rendered = table.render();
            expect(rendered).toContain('Alice');
            expect(rendered).toContain('30');
        });
        it('should add multiple rows', () => {
            table.setHeaders(['Name', 'Age']);
            table.addRows([
                ['Alice', '30'],
                ['Bob', '25'],
                ['Charlie', '35'],
            ]);
            const rendered = table.render();
            expect(rendered).toContain('Alice');
            expect(rendered).toContain('Bob');
            expect(rendered).toContain('Charlie');
        });
    });
    describe('Table Rendering', () => {
        it('should render table with separator', () => {
            table.setHeaders(['Name', 'Age']);
            table.addRow(['Alice', '30']);
            const rendered = table.render();
            expect(rendered).toContain('|'); // Column separator
            expect(rendered).toContain('-'); // Header separator
        });
        it('should auto-calculate column widths', () => {
            table.setHeaders(['Name', 'Age']);
            table.addRow(['Alice', '30']);
            table.addRow(['Bob', '25']);
            const rendered = table.render();
            // All rows should be aligned
            const lines = rendered.split('\n');
            const rowLengths = lines.filter((l) => l.length > 0).map((l) => l.length);
            // All non-empty rows should have same length
            expect(new Set(rowLengths).size).toBe(1);
        });
        it('should handle empty table', () => {
            const rendered = table.render();
            expect(rendered).toBe('');
        });
    });
    describe('Table Management', () => {
        it('should get row count', () => {
            table.addRow(['Alice', '30']);
            table.addRow(['Bob', '25']);
            expect(table.getRowCount()).toBe(2);
        });
        it('should clear table', () => {
            table.setHeaders(['Name', 'Age']);
            table.addRow(['Alice', '30']);
            table.clear();
            expect(table.getRowCount()).toBe(0);
            expect(table.render()).toBe('');
        });
    });
    describe('Table Width Adjustment', () => {
        it('should adjust to longest cell', () => {
            table.setHeaders(['Short', 'Long Header']);
            table.addRow(['A', 'B']);
            const rendered = table.render();
            // "Long Header" should determine column width
            expect(rendered).toContain('Long Header');
        });
        it('should adjust to longest row value', () => {
            table.setHeaders(['Name']);
            table.addRow(['Short']);
            table.addRow(['Very Long Name']);
            const rendered = table.render();
            // "Very Long Name" should determine column width
            expect(rendered).toContain('Very Long Name');
        });
    });
});
describe('PromptHelpers', () => {
    describe('Confirmation Prompts', () => {
        it('should return default confirmation value', async () => {
            const result = await PromptHelpers.confirm('Continue?', true);
            expect(result).toBe(true);
        });
        it('should return false by default', async () => {
            const result = await PromptHelpers.confirm('Continue?');
            expect(result).toBe(false);
        });
    });
    describe('Input Prompts', () => {
        it('should return default input value', async () => {
            const result = await PromptHelpers.input('Enter name:', 'Alice');
            expect(result).toBe('Alice');
        });
        it('should return empty string by default', async () => {
            const result = await PromptHelpers.input('Enter name:');
            expect(result).toBe('');
        });
    });
    describe('Choice Prompts', () => {
        it('should return default choice', async () => {
            const choices = ['Option A', 'Option B', 'Option C'];
            const result = await PromptHelpers.choice('Select option:', choices, 1);
            expect(result).toBe('Option B');
        });
        it('should return first choice by default', async () => {
            const choices = ['Option A', 'Option B'];
            const result = await PromptHelpers.choice('Select option:', choices);
            expect(result).toBe('Option A');
        });
    });
});
//# sourceMappingURL=UXHelpers.test.js.map