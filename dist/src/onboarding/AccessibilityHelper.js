/**
 * Accessibility Helper
 * Sprint 6 Day 57: Accessibility features for inclusive CLI/TUI experience
 */
/**
 * ARIA role types
 */
export var AriaRole;
(function (AriaRole) {
    AriaRole["NAVIGATION"] = "navigation";
    AriaRole["MAIN"] = "main";
    AriaRole["COMPLEMENTARY"] = "complementary";
    AriaRole["REGION"] = "region";
    AriaRole["SEARCH"] = "search";
    AriaRole["FORM"] = "form";
    AriaRole["BUTTON"] = "button";
    AriaRole["TEXTBOX"] = "textbox";
    AriaRole["LIST"] = "list";
    AriaRole["LISTITEM"] = "listitem";
    AriaRole["MENUBAR"] = "menubar";
    AriaRole["MENU"] = "menu";
    AriaRole["MENUITEM"] = "menuitem";
    AriaRole["ALERT"] = "alert";
    AriaRole["STATUS"] = "status";
    AriaRole["PROGRESSBAR"] = "progressbar";
    AriaRole["TABLE"] = "table";
})(AriaRole || (AriaRole = {}));
/**
 * Accessibility Helper
 */
export class AccessibilityHelper {
    static shortcuts = new Map();
    static announcements = [];
    /**
     * Initialize default keyboard shortcuts
     */
    static {
        // Navigation shortcuts
        this.registerShortcut('help', {
            keys: ['h', '?'],
            description: 'Show help and keyboard shortcuts',
            global: true,
        });
        this.registerShortcut('quit', {
            keys: ['q', 'Ctrl+C'],
            description: 'Quit application',
            global: true,
        });
        this.registerShortcut('back', {
            keys: ['Esc', 'b'],
            description: 'Go back to previous screen',
            global: true,
        });
        // Search shortcuts
        this.registerShortcut('search', {
            keys: ['/', 's'],
            description: 'Open search',
            action: 'ax find',
        });
        this.registerShortcut('filter', {
            keys: ['f'],
            description: 'Apply filters',
        });
        this.registerShortcut('clear-filters', {
            keys: ['c'],
            description: 'Clear all filters',
        });
        // Navigation shortcuts
        this.registerShortcut('next-result', {
            keys: ['j', 'ArrowDown'],
            description: 'Navigate to next result',
        });
        this.registerShortcut('prev-result', {
            keys: ['k', 'ArrowUp'],
            description: 'Navigate to previous result',
        });
        this.registerShortcut('first-result', {
            keys: ['g', 'Home'],
            description: 'Jump to first result',
        });
        this.registerShortcut('last-result', {
            keys: ['G', 'End'],
            description: 'Jump to last result',
        });
        // Action shortcuts
        this.registerShortcut('open', {
            keys: ['Enter', 'o'],
            description: 'Open selected item',
        });
        this.registerShortcut('copy', {
            keys: ['y'],
            description: 'Copy to clipboard',
        });
        this.registerShortcut('refresh', {
            keys: ['r'],
            description: 'Refresh results',
        });
    }
    /**
     * Register keyboard shortcut
     */
    static registerShortcut(id, shortcut) {
        this.shortcuts.set(id, shortcut);
    }
    /**
     * Get keyboard shortcut
     */
    static getShortcut(id) {
        return this.shortcuts.get(id);
    }
    /**
     * Get all keyboard shortcuts
     */
    static getAllShortcuts() {
        return new Map(this.shortcuts);
    }
    /**
     * Get global shortcuts
     */
    static getGlobalShortcuts() {
        return Array.from(this.shortcuts.values()).filter((s) => s.global);
    }
    /**
     * Format keyboard shortcuts for display
     */
    static formatShortcuts() {
        const lines = [];
        lines.push('Keyboard Shortcuts');
        lines.push('==================');
        lines.push('');
        // Group by category
        const global = Array.from(this.shortcuts.entries()).filter(([, s]) => s.global);
        const other = Array.from(this.shortcuts.entries()).filter(([, s]) => !s.global);
        if (global.length > 0) {
            lines.push('Global:');
            for (const [id, shortcut] of global) {
                lines.push(`  ${shortcut.keys.join(', ')}\t${shortcut.description}`);
            }
            lines.push('');
        }
        if (other.length > 0) {
            lines.push('Navigation & Actions:');
            for (const [id, shortcut] of other) {
                lines.push(`  ${shortcut.keys.join(', ')}\t${shortcut.description}`);
            }
        }
        return lines.join('\n');
    }
    /**
     * Announce message to screen reader
     */
    static announce(message, priority = 'polite', clear = false) {
        if (clear) {
            this.announcements = [];
        }
        this.announcements.push({ message, priority, clear });
        // In production, this would interact with screen reader APIs
        // For now, we just store the announcement
    }
    /**
     * Get pending announcements
     */
    static getAnnouncements() {
        return [...this.announcements];
    }
    /**
     * Clear announcements
     */
    static clearAnnouncements() {
        this.announcements = [];
    }
    /**
     * Create ARIA label
     */
    static createAriaLabel(metadata) {
        const parts = [];
        // Role
        parts.push(metadata.role);
        // Label
        parts.push(metadata.label);
        // Description
        if (metadata.description) {
            parts.push(metadata.description);
        }
        // State
        if (metadata.required) {
            parts.push('required');
        }
        if (metadata.disabled) {
            parts.push('disabled');
        }
        if (metadata.hidden) {
            parts.push('hidden');
        }
        // Hint
        if (metadata.hint) {
            parts.push(`Hint: ${metadata.hint}`);
        }
        return parts.join(', ');
    }
    /**
     * Format for screen reader
     */
    static formatForScreenReader(text, metadata) {
        if (!metadata) {
            return text;
        }
        const label = this.createAriaLabel(metadata);
        return `${label}. ${text}`;
    }
    /**
     * Generate navigation hints
     */
    static generateNavigationHints(context) {
        const hints = [];
        switch (context) {
            case 'search':
                hints.push('Press / or s to start search');
                hints.push('Press f to apply filters');
                hints.push('Press Enter to submit');
                break;
            case 'results':
                hints.push('Use j/k or arrow keys to navigate');
                hints.push('Press Enter or o to open');
                hints.push('Press y to copy');
                break;
            case 'menu':
                hints.push('Use arrow keys to navigate');
                hints.push('Press Enter to select');
                hints.push('Press Esc or b to go back');
                break;
            case 'form':
                hints.push('Press Tab to move between fields');
                hints.push('Press Enter to submit');
                hints.push('Press Esc to cancel');
                break;
        }
        hints.push('Press h or ? for all shortcuts');
        return hints.join('. ');
    }
    /**
     * Check if high contrast mode should be used
     */
    static shouldUseHighContrast() {
        // In production, this would check system preferences
        // For now, check environment variable
        return process.env.AUTOMATOSX_HIGH_CONTRAST === 'true';
    }
    /**
     * Check if reduced motion should be used
     */
    static shouldUseReducedMotion() {
        // In production, this would check system preferences
        // For now, check environment variable
        return process.env.AUTOMATOSX_REDUCED_MOTION === 'true';
    }
    /**
     * Get text size preference
     */
    static getTextSizePreference() {
        const size = process.env.AUTOMATOSX_TEXT_SIZE;
        if (size === 'small' || size === 'large') {
            return size;
        }
        return 'medium';
    }
    /**
     * Format progress for screen reader
     */
    static formatProgress(current, total, operation) {
        const percent = Math.round((current / total) * 100);
        return `${operation} ${percent}% complete. ${current} of ${total} items processed.`;
    }
    /**
     * Format error for screen reader
     */
    static formatError(code, message, remediation) {
        const parts = [];
        parts.push(`Error ${code}`);
        parts.push(message);
        if (remediation && remediation.length > 0) {
            parts.push('To fix this:');
            parts.push(...remediation.map((r, i) => `${i + 1}. ${r}`));
        }
        return parts.join('. ');
    }
    /**
     * Format list for screen reader
     */
    static formatList(items, listType = 'unordered') {
        const parts = [];
        parts.push(`${listType} list with ${items.length} items`);
        for (let i = 0; i < items.length; i++) {
            const prefix = listType === 'ordered' ? `${i + 1}.` : '•';
            parts.push(`${prefix} ${items[i]}`);
        }
        return parts.join('. ');
    }
    /**
     * Format table for screen reader
     */
    static formatTable(headers, rows) {
        const parts = [];
        parts.push(`Table with ${headers.length} columns and ${rows.length} rows`);
        parts.push(`Column headers: ${headers.join(', ')}`);
        for (let i = 0; i < rows.length; i++) {
            const rowData = headers.map((h, j) => `${h}: ${rows[i][j]}`).join(', ');
            parts.push(`Row ${i + 1}: ${rowData}`);
        }
        return parts.join('. ');
    }
    /**
     * Create accessible command help
     */
    static createAccessibleHelp(command, description, options) {
        const parts = [];
        parts.push(`Command: ${command}`);
        parts.push(description);
        if (Object.keys(options).length > 0) {
            parts.push('Options:');
            for (const [option, desc] of Object.entries(options)) {
                parts.push(`${option}: ${desc}`);
            }
        }
        return parts.join('. ');
    }
    /**
     * Get focus indicator style
     */
    static getFocusIndicatorStyle() {
        if (this.shouldUseHighContrast()) {
            return 'bold-outline';
        }
        return 'subtle-outline';
    }
    /**
     * Get animation duration
     */
    static getAnimationDuration() {
        if (this.shouldUseReducedMotion()) {
            return 0; // No animations
        }
        return 300; // 300ms default
    }
}
//# sourceMappingURL=AccessibilityHelper.js.map